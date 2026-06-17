/** Gate 4 — Orders (purchase / redeem). Maps to /transaction/NORMAL. Returns ACCEPTED, never "allotted". */
import { store, nextId } from "../store";
import { schedule } from "../scheduler";
import { emit } from "../bus";
import { timing } from "../config";
import { computeCutoff } from "../dates";
import { getScheme } from "../schemes";
import type { OrderResource, OrderType } from "../types";

interface OrderInput {
  accountId: string;
  type: OrderType;
  schemeCode: string;
  toSchemeCode?: string; // switch destination
  amount: number;
  unitsRedeemed?: number;
  allUnits?: boolean;
  idempotencyKey: string;
  cutoffForcePassed?: boolean; // from dev-panel cutoff jump
}

/**
 * POST /orders — idempotent. Re-sending the same idempotencyKey returns the SAME
 * order (acceptance #9). Returns ACCEPTED immediately with a cutoff-aware navDate.
 */
export function orderCreate(input: OrderInput): OrderResource {
  const existingId = store.idempotency.get(input.idempotencyKey);
  if (existingId) {
    const existing = store.orders.get(existingId);
    if (existing) return existing;
  }

  const id = nextId("ord");
  const cutoff = computeCutoff(timing.cutoffHour, new Date(), input.cutoffForcePassed);
  const rec: OrderResource = {
    orderId: id,
    accountId: input.accountId,
    type: input.type,
    schemeCode: input.schemeCode,
    toSchemeCode: input.toSchemeCode,
    amount: input.amount,
    unitsRedeemed: input.unitsRedeemed,
    allUnits: input.allUnits,
    status: "ACCEPTED",
    navDate: cutoff.navDate,
    cutoffPassed: cutoff.cutoffPassed,
    idempotencyKey: input.idempotencyKey,
    createdAt: Date.now(),
  };
  store.orders.set(id, rec);
  store.idempotency.set(input.idempotencyKey, id);
  emit({ resource: "order", id, from: "-", to: "ACCEPTED", detail: "Order accepted by exchange" });

  if (input.type === "REDEEM") scheduleRedeemPayout(id);
  if (input.type === "SWITCH") scheduleSwitch(id);
  // PURCHASE waits for payment success before CONFIRMED; allotment after that.
  return rec;
}

/**
 * A switch is a sell from A then a buy into B — two legs that can price on different
 * days. CONFIRMED = "in motion" (sold from A, buying B). ALLOTTED = units in B. If the
 * buy leg fails, the amount is RETURNED (we never silently lose it).
 */
function scheduleSwitch(orderId: string) {
  const ord = store.orders.get(orderId);
  if (!ord) return;
  schedule(`ord:switch-sell:${orderId}`, () => {
    ord.status = "CONFIRMED"; // sold from A, money in motion
    // remove units sold from the source holding
    const from = [...store.holdings.values()].find(
      (h) => h.accountId === ord.accountId && h.schemeCode === ord.schemeCode,
    );
    if (from) {
      if (ord.allUnits) from.units = 0;
      else from.units = +Math.max(0, from.units - ord.amount / from.currentNav).toFixed(2);
    }
    emit({ resource: "order", id: orderId, from: "ACCEPTED", to: "CONFIRMED", detail: "Sold from source — money in motion" });

    schedule(`ord:switch-buy:${orderId}`, () => {
      const forced = store.forces.order;
      store.forces.order = undefined;
      if (forced === "REJECTED") {
        ord.status = "SWITCH_RETURNED";
        ord.rejectReason = "The destination fund couldn’t accept the buy — the amount is being returned to your account.";
        emit({ resource: "order", id: orderId, from: "CONFIRMED", to: "SWITCH_RETURNED", detail: ord.rejectReason });
        return;
      }
      const toScheme = ord.toSchemeCode ? getScheme(ord.toSchemeCode) : undefined;
      const navB = toScheme?.nav ?? 100;
      ord.nav = navB;
      ord.units = +(ord.amount / navB).toFixed(2);
      ord.status = "ALLOTTED";
      emit({ resource: "order", id: orderId, from: "CONFIRMED", to: "ALLOTTED", detail: `${ord.units} units allotted in destination` });
      // add to / create the destination holding
      const existing = [...store.holdings.values()].find(
        (h) => h.accountId === ord.accountId && h.schemeCode === ord.toSchemeCode,
      );
      if (existing) {
        const cost = existing.units * existing.avgNav + ord.units * navB;
        existing.units = +(existing.units + ord.units).toFixed(2);
        existing.avgNav = +(cost / existing.units).toFixed(2);
        existing.currentNav = navB;
      } else {
        const hid = nextId("hld");
        store.holdings.set(hid, {
          holdingId: hid, accountId: ord.accountId, schemeCode: ord.toSchemeCode!,
          units: ord.units, avgNav: navB, currentNav: navB,
          exitLoadPct: 0, lockedUntil: toScheme?.isElss ? "2029-06-17" : null,
        });
      }
    }, timing.allotmentMs);
  }, Math.round(timing.allotmentMs * 0.4));
}

/** Called by payments when money succeeds: ACCEPTED -> CONFIRMED, then -> ALLOTTED later. */
export function onPaymentSuccess(orderId: string) {
  const ord = store.orders.get(orderId);
  if (!ord || ord.type !== "PURCHASE") return;
  if (ord.status !== "ACCEPTED") return;
  ord.status = "CONFIRMED";
  emit({ resource: "order", id: orderId, from: "ACCEPTED", to: "CONFIRMED", detail: "Payment confirmed" });

  schedule(`ord:allot:${orderId}`, () => {
    const forced = store.forces.order;
    store.forces.order = undefined;
    if (forced === "REJECTED") {
      ord.status = "REJECTED";
      ord.rejectReason = "The fund could not complete this order (scheme limit).";
      emit({ resource: "order", id: orderId, from: "CONFIRMED", to: "REJECTED", detail: ord.rejectReason });
      return;
    }
    const scheme = getScheme(ord.schemeCode);
    const nav = scheme?.nav ?? 100;
    ord.nav = nav;
    ord.units = +(ord.amount / nav).toFixed(2);
    ord.status = "ALLOTTED";
    emit({ resource: "order", id: orderId, from: "CONFIRMED", to: "ALLOTTED", detail: `${ord.units} units allotted` });
    // Materialise / top up a holding for this account+scheme.
    upsertHolding(ord);
  }, timing.allotmentMs);
}

function upsertHolding(ord: OrderResource) {
  const scheme = getScheme(ord.schemeCode);
  const existing = [...store.holdings.values()].find(
    (h) => h.accountId === ord.accountId && h.schemeCode === ord.schemeCode,
  );
  if (existing) {
    const totalCost = existing.units * existing.avgNav + (ord.units ?? 0) * (ord.nav ?? 0);
    existing.units = +(existing.units + (ord.units ?? 0)).toFixed(2);
    existing.avgNav = +(totalCost / existing.units).toFixed(2);
    existing.currentNav = ord.nav ?? existing.currentNav;
  } else {
    const id = nextId("hld");
    store.holdings.set(id, {
      holdingId: id,
      accountId: ord.accountId,
      schemeCode: ord.schemeCode,
      units: ord.units ?? 0,
      avgNav: ord.nav ?? 0,
      currentNav: ord.nav ?? 0,
      exitLoadPct: scheme?.isElss ? 0 : 0,
      lockedUntil: scheme?.isElss ? "2029-06-17" : null,
    });
  }
}

function scheduleRedeemPayout(orderId: string) {
  const ord = store.orders.get(orderId);
  if (!ord) return;
  schedule(`ord:proc:${orderId}`, () => {
    ord.status = "PROCESSING";
    emit({ resource: "order", id: orderId, from: "ACCEPTED", to: "PROCESSING", detail: "Withdrawal processing" });
    schedule(`ord:pay:${orderId}`, () => {
      const forced = store.forces.order;
      store.forces.order = undefined;
      if (forced === "REJECTED") {
        ord.status = "PAYOUT_BOUNCED";
        emit({ resource: "order", id: orderId, from: "PROCESSING", to: "PAYOUT_BOUNCED", detail: "Payout bounced" });
        return;
      }
      ord.realisedAmount = Math.round(ord.amount * 1.005); // realised ~ indicative
      ord.status = "PAID_OUT";
      emit({ resource: "order", id: orderId, from: "PROCESSING", to: "PAID_OUT", detail: `₹${ord.realisedAmount} paid` });
      // reduce units from the holding
      const h = [...store.holdings.values()].find(
        (x) => x.accountId === ord.accountId && x.schemeCode === ord.schemeCode,
      );
      if (h) {
        if (ord.allUnits) h.units = 0;
        else if (ord.unitsRedeemed) h.units = +(h.units - ord.unitsRedeemed).toFixed(2);
      }
    }, timing.redeemPayoutMs);
  }, timing.redeemPayoutMs);
}

/** Cancel allowed only while cutoffPassed=false and status ACCEPTED. */
export function orderCancel(orderId: string): { ok: boolean; reason?: string } {
  const ord = store.orders.get(orderId);
  if (!ord) return { ok: false, reason: "Order not found." };
  if (ord.cutoffPassed || ord.status !== "ACCEPTED") {
    return {
      ok: false,
      reason: "This is already being processed, so it can’t be cancelled today — you can cancel from next cycle.",
    };
  }
  ord.status = "CANCELLED";
  emit({ resource: "order", id: orderId, from: "ACCEPTED", to: "CANCELLED", detail: "Order cancelled" });
  return { ok: true };
}
