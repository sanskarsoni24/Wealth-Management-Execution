/** Systematic plans — SIP. Maps to /registration/product/SIP + SIPUMRN. Decoupled from mandate approval. */
import { store, nextId } from "../store";
import { emit } from "../bus";
import { businessDayOnOrAfter, iso, nextBusinessDay } from "../dates";
import type { SipResource } from "../types";

interface SipInput {
  accountId: string;
  schemeCode: string;
  amount: number;
  frequency: "monthly" | "weekly";
  dayOfMonth: number;
  mandateId: string;
}

export interface SipResult {
  sip?: SipResource;
  exceedsMandate?: { sipAmount: number; ceiling: number };
}

/**
 * Create a SIP. The governing rule: it is created even if the mandate isn't approved
 * yet (AWAITING_MANDATE) so the user leaves with certainty. Validates amount <= ceiling.
 */
export function sipCreate(input: SipInput): SipResult {
  const mandate = store.mandates.get(input.mandateId);
  if (mandate && input.amount > mandate.maxAmount) {
    return { exceedsMandate: { sipAmount: input.amount, ceiling: mandate.maxAmount } };
  }

  const id = nextId("sip");
  const approved = mandate?.status === "APPROVED";
  const rec: SipResource = {
    sipId: id,
    accountId: input.accountId,
    schemeCode: input.schemeCode,
    amount: input.amount,
    frequency: input.frequency,
    dayOfMonth: input.dayOfMonth,
    mandateId: input.mandateId,
    status: approved ? "ACTIVE" : "AWAITING_MANDATE",
    firstDebitDate: approved ? computeFirstDebit(input.dayOfMonth).date : null,
    startsNextCycle: approved ? computeFirstDebit(input.dayOfMonth).nextCycle : false,
  };
  store.sips.set(id, rec);
  emit({ resource: "sip", id, from: "-", to: rec.status, detail: `SIP ${rec.status}` });
  return { sip: rec };
}

/** Called when the SIP's mandate approves: flip to ACTIVE with a concrete first-debit date. */
export function onMandateApproved(sipId: string) {
  const sip = store.sips.get(sipId);
  if (!sip || sip.status !== "AWAITING_MANDATE") return;
  const { date, nextCycle } = computeFirstDebit(sip.dayOfMonth);
  sip.status = "ACTIVE";
  sip.firstDebitDate = date;
  sip.startsNextCycle = nextCycle;
  emit({ resource: "sip", id: sipId, from: "AWAITING_MANDATE", to: "ACTIVE", detail: `First debit ${date}` });
}

/**
 * First debit = the chosen day this month if still ahead, else next month; shifted to
 * a business day. `nextCycle` = true if the chosen date had already passed (PRD §3.3.4).
 */
function computeFirstDebit(dayOfMonth: number): { date: string; nextCycle: boolean } {
  const now = new Date();
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), dayOfMonth);
  let nextCycle = false;
  let target = thisMonth;
  if (thisMonth.getTime() <= now.getTime()) {
    target = new Date(now.getFullYear(), now.getMonth() + 1, dayOfMonth);
    nextCycle = true;
  }
  return { date: iso(businessDayOnOrAfter(target)), nextCycle };
}

export function sipPause(sipId: string) {
  const sip = store.sips.get(sipId);
  if (!sip) return;
  sip.status = "PAUSED";
  emit({ resource: "sip", id: sipId, from: "ACTIVE", to: "PAUSED", detail: "SIP paused" });
}

export function sipResume(sipId: string) {
  const sip = store.sips.get(sipId);
  if (!sip) return;
  sip.status = "ACTIVE";
  emit({ resource: "sip", id: sipId, from: "PAUSED", to: "ACTIVE", detail: "SIP resumed" });
}

export function sipCancel(sipId: string) {
  const sip = store.sips.get(sipId);
  if (!sip) return;
  sip.status = "CANCELLED";
  emit({ resource: "sip", id: sipId, from: sip.status, to: "CANCELLED", detail: "SIP cancelled" });
}

export interface StepUpResult {
  ok: boolean;
  exceedsMandate?: { newAmount: number; ceiling: number };
}

export function sipStepUp(sipId: string, newAmount: number): StepUpResult {
  const sip = store.sips.get(sipId);
  if (!sip) return { ok: false };
  const mandate = store.mandates.get(sip.mandateId);
  if (mandate && newAmount > mandate.maxAmount) {
    return { ok: false, exceedsMandate: { newAmount, ceiling: mandate.maxAmount } };
  }
  sip.amount = newAmount;
  emit({ resource: "sip", id: sipId, from: "ACTIVE", to: "ACTIVE", detail: `Stepped up to ₹${newAmount}` });
  return { ok: true };
}

/** Demo: a single instalment fails (insufficient funds) — auto-retry, no penalty. */
export function sipFailInstalment(sipId: string, clear = false) {
  const sip = store.sips.get(sipId);
  if (!sip) return;
  sip.lastInstalmentFailed = !clear;
  emit({ resource: "sip", id: sipId, from: "ACTIVE", to: "ACTIVE", detail: clear ? "Instalment retry cleared" : "Instalment failed (low balance)" });
}

/** Raise the ceiling on the SIP's mandate (the "raise your limit" affordance). */
export function raiseCeiling(sipId: string, newCeiling: number) {
  const sip = store.sips.get(sipId);
  if (!sip) return;
  const mandate = store.mandates.get(sip.mandateId);
  if (mandate) {
    mandate.maxAmount = newCeiling;
    emit({ resource: "mandate", id: mandate.mandateId, from: "APPROVED", to: "APPROVED", detail: `Ceiling raised to ₹${newCeiling}` });
  }
}
