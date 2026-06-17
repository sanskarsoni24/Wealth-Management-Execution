/**
 * Systematic plans beyond SIP — STP (fund→fund) and SWP (fund→bank).
 * Maps to NSE /registration/product/STP and /SWP. Neither needs a bank mandate the way
 * SIP does: STP is fund-to-fund (no debit), SWP pays out to an already-linked bank. So
 * they confirm synchronously with a concrete first date; the honesty is about depletion
 * and the "in motion" nature, surfaced in the UI.
 */
import { store, nextId } from "../store";
import { emit } from "../bus";
import { businessDayOnOrAfter, iso } from "../dates";
import type { PlanResource } from "../types";

function firstDate(dayOfMonth: number): string {
  const now = new Date();
  let target = new Date(now.getFullYear(), now.getMonth(), dayOfMonth);
  if (target.getTime() <= now.getTime()) target = new Date(now.getFullYear(), now.getMonth() + 1, dayOfMonth);
  return iso(businessDayOnOrAfter(target));
}

interface StpInput {
  accountId: string;
  fromSchemeCode: string;
  toSchemeCode: string;
  amount: number;
  frequency: "monthly" | "weekly";
  dayOfMonth: number;
}
export function stpCreate(input: StpInput): PlanResource {
  const id = nextId("stp");
  const rec: PlanResource = {
    planId: id, kind: "STP", accountId: input.accountId,
    fromSchemeCode: input.fromSchemeCode, toSchemeCode: input.toSchemeCode,
    amount: input.amount, frequency: input.frequency, dayOfMonth: input.dayOfMonth,
    firstDate: firstDate(input.dayOfMonth), status: "ACTIVE",
  };
  store.plans.set(id, rec);
  emit({ resource: "plan", id, from: "-", to: "ACTIVE", detail: "STP set" });
  return rec;
}

interface SwpInput {
  accountId: string;
  fromSchemeCode: string;
  amount: number;
  frequency: "monthly" | "weekly";
  dayOfMonth: number;
  bankLast4: string;
}
export function swpCreate(input: SwpInput): PlanResource {
  const id = nextId("swp");
  const rec: PlanResource = {
    planId: id, kind: "SWP", accountId: input.accountId,
    fromSchemeCode: input.fromSchemeCode, amount: input.amount,
    frequency: input.frequency, dayOfMonth: input.dayOfMonth,
    firstDate: firstDate(input.dayOfMonth), bankLast4: input.bankLast4, status: "ACTIVE",
  };
  store.plans.set(id, rec);
  emit({ resource: "plan", id, from: "-", to: "ACTIVE", detail: "SWP set" });
  return rec;
}

export function planEnd(planId: string) {
  const p = store.plans.get(planId);
  if (!p) return;
  p.status = "ENDED";
  emit({ resource: "plan", id: planId, from: "ACTIVE", to: "ENDED", detail: "Plan ended" });
}
