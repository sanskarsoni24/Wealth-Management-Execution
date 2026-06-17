/**
 * client.ts — THE ONLY MODULE THE APP IMPORTS FROM THE RAIL.
 *
 * It is the seam that production replaces with real HTTP calls to YOUR backend.
 * Every function here returns a *consumer-shaped* view: plain names, plain status
 * words, human copy. Rail vocabulary (clientCode/UCC, schemeCode, navDate, mandate
 * internals) is stripped here and NEVER crosses into src/app. That boundary is what
 * enforces the cardinal rule: the customer never sees the rail.
 */
import { store } from "./store";
import { getScheme, getSchemeBySlug, RECOMMENDED_FIRST, SCHEMES, type Scheme } from "./schemes";
import { personaForPan } from "./seed";
import { humanDate, weekday, iso, businessDayOnOrAfter, nextBusinessDay } from "./dates";
import { timing } from "./config";

import { kycCheck, ekycStart, ekycSendAadhaarOtp, ekycVerifyAadhaar, ekycLiveness, ekycRetryOtp } from "./machines/kyc";
import { accountCreate, bankVerify } from "./machines/account";
import { mandateCreate } from "./machines/mandate";
import { orderCreate, orderCancel } from "./machines/orders";
import { paymentCreate, paymentApprove, paymentAbandon } from "./machines/payments";
import { stpCreate, swpCreate, planEnd } from "./machines/plans";
import {
  sipCreate, sipPause, sipResume, sipCancel, sipStepUp, raiseCeiling, sipFailInstalment, type SipResult, type StepUpResult,
} from "./machines/sip";

import type { Nominee } from "./types";

const POLL = (ms: number) => Math.max(400, Math.round(ms / 4));

// ── PAN validation (format only; no real KYC) ────────────────────────────────
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
export function isValidPan(pan: string): boolean {
  return PAN_RE.test(pan.trim().toUpperCase());
}

// ── Seeded session (onboarding removed — boot straight into a set-up investor) ──
export interface SeededSession { accountId: string; holderName: string; pan: string }
export function seededSession(): SeededSession {
  const acc = [...store.accounts.values()].find((a) => a.status === "ACTIVE");
  return acc
    ? { accountId: acc.accountId, holderName: acc.holderName, pan: acc.pan }
    : { accountId: "acc_seed_aarav", holderName: "Aarav Apte", pan: "AAAPA1111A" };
}

// ── Resolver / identity ───────────────────────────────────────────────────────
export interface IdentitySubmit {
  pan: string;
  mobile: string;
}
export function submitIdentity({ pan }: IdentitySubmit): { kycId: string } {
  const rec = kycCheck(pan.trim().toUpperCase());
  return { kycId: rec.kycId };
}

export type IdentityPhase =
  | "checking"
  | "verified_returning" // verified + account exists -> fast path
  | "verified_new" // verified but no account yet -> set up account
  | "needs_verification" // not found / incomplete
  | "on_hold"
  | "service_down";

export interface IdentityResult {
  phase: IdentityPhase;
  isIncomplete: boolean;
  holderName: string;
  accountId?: string;
}

export function getIdentity(kycId: string): IdentityResult {
  const rec = store.kyc.get(kycId);
  if (!rec) return { phase: "checking", isIncomplete: false, holderName: "" };
  const persona = personaForPan(rec.pan);
  const holderName = persona?.name ?? "there";
  if (!rec.resolved) return { phase: "checking", isIncomplete: false, holderName };

  if (rec.status === "VERIFIED") {
    const acc = [...store.accounts.values()].find(
      (a) => a.pan === rec.pan && a.status === "ACTIVE",
    );
    if (acc) return { phase: "verified_returning", isIncomplete: false, holderName, accountId: acc.accountId };
    return { phase: "verified_new", isIncomplete: false, holderName };
  }
  if (rec.status === "ON_HOLD") return { phase: "on_hold", isIncomplete: false, holderName };
  if (rec.status === "SERVICE_DOWN") return { phase: "service_down", isIncomplete: false, holderName };
  // NOT_FOUND or INCOMPLETE
  return { phase: "needs_verification", isIncomplete: rec.status === "INCOMPLETE", holderName };
}

// ── e-KYC ──────────────────────────────────────────────────────────────────────
export function startEkyc(pan: string): { ekycId: string } {
  return { ekycId: ekycStart(pan).ekycId };
}
export type EkycPhase =
  | "aadhaar_entry"
  | "aadhaar_sending"
  | "aadhaar_otp"
  | "liveness_ready"
  | "liveness_checking"
  | "submitted"
  | "done"
  | "failed";
export interface EkycView {
  phase: EkycPhase;
  failReason?: string;
  pollMs: number;
}
export function getEkyc(ekycId: string): EkycView {
  const rec = store.ekyc.get(ekycId);
  const pollMs = POLL(timing.ekycStepMs);
  if (!rec) return { phase: "aadhaar_entry", pollMs };
  switch (rec.step) {
    case "STARTED": return { phase: "aadhaar_entry", pollMs };
    case "AADHAAR_SENT": return { phase: "aadhaar_otp", pollMs };
    case "AADHAAR_VERIFIED": return { phase: "liveness_ready", pollMs };
    case "LIVENESS_OK": return { phase: "submitted", pollMs };
    case "SUBMITTED": return { phase: "submitted", pollMs };
    case "VERIFIED": return { phase: "done", pollMs };
    case "FAILED": return { phase: "failed", failReason: rec.failReason, pollMs };
  }
}
export const sendAadhaarOtp = (ekycId: string) => ekycSendAadhaarOtp(ekycId);
export const verifyAadhaar = (ekycId: string, bad?: boolean) => ekycVerifyAadhaar(ekycId, bad);
export const submitLiveness = (ekycId: string, fail?: boolean) => ekycLiveness(ekycId, fail);
export const retryAadhaarOtp = (ekycId: string) => ekycRetryOtp(ekycId);

// ── Account + bank ───────────────────────────────────────────────────────────
export interface CreateAccountInput {
  pan: string;
  holderName: string;
  taxResident: boolean;
  nominee: Nominee | null;
  nomineeOptOut: boolean;
}
export function createAccount(input: CreateAccountInput): { accountId: string } {
  return { accountId: accountCreate(input).accountId };
}
export interface AccountView {
  status: "creating" | "active";
  holderName: string;
  taxResident: boolean;
  nominee: Nominee | null;
  bank: { bankName: string; last4: string; status: "none" | "pending" | "verified" | "name_mismatch" | "failed" };
  pollMs: number;
}
export function getAccount(accountId: string): AccountView | undefined {
  const a = store.accounts.get(accountId);
  if (!a) return undefined;
  const bankStatusMap = {
    PENDING: "pending", VERIFIED: "verified", NAME_MISMATCH: "name_mismatch", FAILED: "failed",
  } as const;
  return {
    status: a.status === "ACTIVE" ? "active" : "creating",
    holderName: a.holderName,
    taxResident: a.taxResident,
    nominee: a.nominee,
    bank: a.bank
      ? { bankName: a.bank.bankName, last4: a.bank.last4, status: bankStatusMap[a.bank.status] }
      : { bankName: "", last4: "", status: "none" },
    pollMs: POLL(timing.uccCreateMs),
  };
}
export interface VerifyBankInput {
  accountId: string;
  accountNumber: string;
  ifsc: string;
  bankName: string;
}
export const verifyBank = (input: VerifyBankInput) => { bankVerify(input); };

// ── Mandate (auto-pay) ─────────────────────────────────────────────────────────
export interface CreateMandateInput {
  accountId: string;
  maxAmount: number;
  ifsc: string;
  bankLast4: string;
}
export function createMandate(input: CreateMandateInput): { mandateId: string } {
  return { mandateId: mandateCreate(input).mandateId };
}
export type MandatePhase = "approving" | "approved" | "rejected" | "unsupported";
export function getMandate(mandateId: string): { phase: MandatePhase; ceiling: number; pollMs: number } | undefined {
  const m = store.mandates.get(mandateId);
  if (!m) return undefined;
  const map = { PENDING: "approving", APPROVED: "approved", REJECTED: "rejected", UNSUPPORTED_BANK: "unsupported" } as const;
  return { phase: map[m.status], ceiling: m.maxAmount, pollMs: POLL(timing.mandateApproveMs) };
}
/** Returning user's existing approved mandate (or null). */
export function approvedMandateFor(accountId: string): { mandateId: string; ceiling: number } | null {
  const m = [...store.mandates.values()].find((x) => x.accountId === accountId && x.status === "APPROVED");
  return m ? { mandateId: m.mandateId, ceiling: m.maxAmount } : null;
}

// ── Orders ──────────────────────────────────────────────────────────────────────
export interface PlaceOrderInput {
  accountId: string;
  fundSlug: string;
  amount: number;
  idempotencyKey: string;
  cutoffForcePassed?: boolean;
}
export function placeOrder(input: PlaceOrderInput): { orderId: string } {
  const schemeCode = getSchemeBySlug(input.fundSlug)!.schemeCode;
  return {
    orderId: orderCreate({ ...input, schemeCode, type: "PURCHASE" }).orderId,
  };
}
export interface PlaceRedeemInput {
  accountId: string;
  fundSlug: string;
  amount: number; // indicative payout
  unitsRedeemed?: number;
  allUnits?: boolean;
  idempotencyKey: string;
  cutoffForcePassed?: boolean;
}
export function placeRedeem(input: PlaceRedeemInput): { orderId: string } {
  const schemeCode = getSchemeBySlug(input.fundSlug)!.schemeCode;
  return { orderId: orderCreate({ ...input, schemeCode, type: "REDEEM" }).orderId };
}
export interface PlaceSwitchInput {
  accountId: string;
  fromFundSlug: string;
  toFundSlug: string;
  amount: number;
  allUnits?: boolean;
  idempotencyKey: string;
  cutoffForcePassed?: boolean;
}
export function placeSwitch(input: PlaceSwitchInput): { orderId: string } {
  const schemeCode = getSchemeBySlug(input.fromFundSlug)!.schemeCode;
  const toSchemeCode = getSchemeBySlug(input.toFundSlug)!.schemeCode;
  return {
    orderId: orderCreate({
      accountId: input.accountId, schemeCode, toSchemeCode, amount: input.amount,
      allUnits: input.allUnits, idempotencyKey: input.idempotencyKey,
      cutoffForcePassed: input.cutoffForcePassed, type: "SWITCH",
    }).orderId,
  };
}

export type OrderPhase =
  | "received" | "accepted" | "confirmed" | "allotted"
  | "processing" | "paid_out" | "payout_bounced" | "switch_returned"
  | "rejected" | "cancelled";
export interface OrderView {
  phase: OrderPhase;
  type: "purchase" | "redeem" | "switch";
  schemeName: string; // source fund
  toSchemeName?: string; // switch destination
  fundSlug: string;
  amount: number;
  units?: number;
  nav?: number;
  realisedAmount?: number;
  navDate: string; // human "18 Jun"
  cutoffPassed: boolean;
  rejectReason?: string;
  bankLast4?: string;
  pollMs: number;
}
export function getOrder(orderId: string): OrderView | undefined {
  const o = store.orders.get(orderId);
  if (!o) return undefined;
  const scheme = getScheme(o.schemeCode);
  const toScheme = o.toSchemeCode ? getScheme(o.toSchemeCode) : undefined;
  const acc = store.accounts.get(o.accountId);
  const phaseMap: Record<string, OrderPhase> = {
    ACCEPTED: "accepted",
    CONFIRMED: "confirmed",
    ALLOTTED: "allotted",
    PROCESSING: "processing",
    PAID_OUT: "paid_out",
    PAYOUT_BOUNCED: "payout_bounced",
    SWITCH_RETURNED: "switch_returned",
    REJECTED: "rejected",
    CANCELLED: "cancelled",
  };
  const typeMap = { PURCHASE: "purchase", REDEEM: "redeem", SWITCH: "switch" } as const;
  return {
    phase: phaseMap[o.status],
    type: typeMap[o.type],
    schemeName: scheme?.name ?? "your fund",
    toSchemeName: toScheme?.name,
    fundSlug: scheme?.slug ?? "",
    amount: o.amount,
    units: o.units,
    nav: o.nav,
    realisedAmount: o.realisedAmount,
    navDate: humanDate(o.navDate),
    cutoffPassed: o.cutoffPassed,
    rejectReason: o.rejectReason,
    bankLast4: acc?.bank?.last4,
    pollMs: POLL(timing.allotmentMs),
  };
}
export const cancelOrder = (orderId: string) => orderCancel(orderId);

// ── Payments ────────────────────────────────────────────────────────────────────
export type PayMethod = "UPI" | "NETBANKING" | "MANDATE";
export interface StartPaymentInput {
  orderId: string;
  amount: number;
  method?: PayMethod;
  idempotencyKey: string;
}
export function startPayment(input: StartPaymentInput): { paymentId: string } {
  return { paymentId: paymentCreate(input).paymentId };
}
/** The user approved the collect in their UPI app / at the bank. */
export const approvePayment = (paymentId: string) => paymentApprove(paymentId);
/** Net-banking: the user came back without completing payment. */
export const abandonPayment = (paymentId: string) => paymentAbandon(paymentId);
export type PaymentPhase = "initiating" | "pending" | "success" | "failed" | "expired" | "rejected";
export interface PaymentView {
  phase: PaymentPhase;
  method: PayMethod;
  amount: number;
  expiresAt: number;
  debitedButFailed: boolean;
  abandoned: boolean;
  orderId: string;
  pollMs: number;
}
export function getPayment(paymentId: string): PaymentView | undefined {
  const p = store.payments.get(paymentId);
  if (!p) return undefined;
  const map = { PENDING: "pending", SUCCESS: "success", FAILED: "failed", EXPIRED: "expired", REJECTED: "rejected" } as const;
  return {
    phase: map[p.status],
    method: p.method,
    amount: p.amount,
    expiresAt: p.expiresAt,
    debitedButFailed: !!p.debitedButFailed,
    abandoned: !!p.abandoned,
    orderId: p.orderId,
    pollMs: 800,
  };
}
/** Which methods are available for this account + amount (auto-pay only if approved & within ceiling). */
export interface PayMethodOption { method: PayMethod; label: string; available: boolean; reason?: string; note: string }
export function paymentMethods(accountId: string, amount: number): PayMethodOption[] {
  const mandate = approvedMandateFor(accountId);
  return [
    { method: "UPI", label: "UPI", available: true, note: "Best for most users · instant approval in your UPI app" },
    { method: "NETBANKING", label: "Net-banking", available: true, note: "No UPI needed · approve on your bank’s page" },
    {
      method: "MANDATE", label: "Pay using your auto-pay",
      available: !!mandate && amount <= (mandate?.ceiling ?? 0),
      reason: !mandate ? "No active auto-pay on this account" : amount > (mandate?.ceiling ?? 0) ? `Above your ₹${mandate?.ceiling.toLocaleString("en-IN")} auto-pay limit` : undefined,
      note: mandate ? `No app-switch · within your ₹${mandate.ceiling.toLocaleString("en-IN")} limit` : "Set up auto-pay first",
    },
  ];
}

// ── SIP ───────────────────────────────────────────────────────────────────────
export interface CreateSipInput {
  accountId: string;
  fundSlug: string;
  amount: number;
  frequency: "monthly" | "weekly";
  dayOfMonth: number;
  mandateId: string;
}
export function createSip(input: CreateSipInput): SipResult {
  const schemeCode = getSchemeBySlug(input.fundSlug)!.schemeCode;
  return sipCreate({ ...input, schemeCode });
}
export type SipPhase = "awaiting_mandate" | "active" | "paused" | "cancelled";
export interface SipView {
  sipId: string;
  phase: SipPhase;
  autopayPhase: MandatePhase; // bank approval state of the underlying mandate
  schemeName: string;
  fundSlug: string;
  amount: number;
  frequency: "monthly" | "weekly";
  dayOfMonth: number;
  firstDebitDate: string | null; // human
  startsNextCycle: boolean;
  ceiling: number;
  lastInstalmentFailed: boolean;
  pollMs: number;
}
function sipView(sipId: string): SipView | undefined {
  const s = store.sips.get(sipId);
  if (!s) return undefined;
  const scheme = getScheme(s.schemeCode);
  const mandate = store.mandates.get(s.mandateId);
  const map = { AWAITING_MANDATE: "awaiting_mandate", ACTIVE: "active", PAUSED: "paused", CANCELLED: "cancelled" } as const;
  const mMap = { PENDING: "approving", APPROVED: "approved", REJECTED: "rejected", UNSUPPORTED_BANK: "unsupported" } as const;
  return {
    sipId: s.sipId,
    phase: map[s.status],
    autopayPhase: mandate ? mMap[mandate.status] : "approving",
    schemeName: scheme?.name ?? "your fund",
    fundSlug: scheme?.slug ?? "",
    amount: s.amount,
    frequency: s.frequency,
    dayOfMonth: s.dayOfMonth,
    firstDebitDate: s.firstDebitDate ? humanDate(s.firstDebitDate) : null,
    startsNextCycle: s.startsNextCycle,
    ceiling: mandate?.maxAmount ?? 0,
    lastInstalmentFailed: !!s.lastInstalmentFailed,
    pollMs: POLL(timing.mandateApproveMs),
  };
}
export function getSip(sipId: string): SipView | undefined {
  return sipView(sipId);
}
export function listSips(accountId: string): SipView[] {
  return [...store.sips.values()]
    .filter((s) => s.accountId === accountId && s.status !== "CANCELLED")
    .map((s) => sipView(s.sipId)!)
    .filter(Boolean);
}
/** Preview the first-debit date for a chosen day, with a holiday-shift note (PRD §3.3.1). */
export function previewFirstDebit(dayOfMonth: number): { human: string; shifted: boolean; tappedHuman: string } {
  const now = new Date();
  let target = new Date(now.getFullYear(), now.getMonth(), dayOfMonth);
  if (target.getTime() <= now.getTime()) target = new Date(now.getFullYear(), now.getMonth() + 1, dayOfMonth);
  const tappedIso = iso(target);
  const effective = businessDayOnOrAfter(target);
  const effIso = iso(effective);
  return { human: humanDate(effIso), shifted: effIso !== tappedIso, tappedHuman: humanDate(tappedIso) };
}

export const pauseSip = (id: string) => sipPause(id);
export const resumeSip = (id: string) => sipResume(id);
export const cancelSip = (id: string) => sipCancel(id);
export const stepUpSip = (id: string, amt: number): StepUpResult => sipStepUp(id, amt);
export const raiseSipCeiling = (id: string, ceiling: number) => raiseCeiling(id, ceiling);
export const simulateInstalmentFail = (id: string, clear?: boolean) => sipFailInstalment(id, clear);

// ── STP / SWP plans (§4.2, §4.3) ─────────────────────────────────────────────
export interface CreateStpInput {
  accountId: string; fromFundSlug: string; toFundSlug: string;
  amount: number; frequency: "monthly" | "weekly"; dayOfMonth: number;
}
export function createStp(input: CreateStpInput): { planId: string } {
  return {
    planId: stpCreate({
      accountId: input.accountId,
      fromSchemeCode: getSchemeBySlug(input.fromFundSlug)!.schemeCode,
      toSchemeCode: getSchemeBySlug(input.toFundSlug)!.schemeCode,
      amount: input.amount, frequency: input.frequency, dayOfMonth: input.dayOfMonth,
    }).planId,
  };
}
export interface CreateSwpInput {
  accountId: string; fromFundSlug: string;
  amount: number; frequency: "monthly" | "weekly"; dayOfMonth: number; bankLast4: string;
}
export function createSwp(input: CreateSwpInput): { planId: string } {
  return {
    planId: swpCreate({
      accountId: input.accountId,
      fromSchemeCode: getSchemeBySlug(input.fromFundSlug)!.schemeCode,
      amount: input.amount, frequency: input.frequency, dayOfMonth: input.dayOfMonth, bankLast4: input.bankLast4,
    }).planId,
  };
}
export interface PlanView {
  planId: string;
  kind: "stp" | "swp";
  fromName: string;
  toName?: string;
  amount: number;
  frequency: "monthly" | "weekly";
  firstDate: string; // human
  bankLast4?: string;
  status: "active" | "paused" | "ended";
}
function planView(planId: string): PlanView | undefined {
  const p = store.plans.get(planId);
  if (!p) return undefined;
  return {
    planId: p.planId,
    kind: p.kind === "STP" ? "stp" : "swp",
    fromName: getScheme(p.fromSchemeCode)?.name ?? "fund",
    toName: p.toSchemeCode ? getScheme(p.toSchemeCode)?.name : undefined,
    amount: p.amount,
    frequency: p.frequency,
    firstDate: humanDate(p.firstDate),
    bankLast4: p.bankLast4,
    status: p.status.toLowerCase() as "active" | "paused" | "ended",
  };
}
export function getPlan(planId: string): PlanView | undefined { return planView(planId); }
export function listPlans(accountId: string): PlanView[] {
  return [...store.plans.values()]
    .filter((p) => p.accountId === accountId && p.status !== "ENDED")
    .map((p) => planView(p.planId)!)
    .filter(Boolean);
}
export const endPlan = (planId: string) => planEnd(planId);

/** Rough depletion estimate for an SWP (years a holding lasts at a payout rate). */
export function swpDepletionYears(holdingId: string, payoutPerPeriod: number, frequency: "monthly" | "weekly"): number {
  const h = getHolding(holdingId);
  if (!h || payoutPerPeriod <= 0) return 0;
  const periodsPerYear = frequency === "monthly" ? 12 : 52;
  return +(h.currentValue / (payoutPerPeriod * periodsPerYear)).toFixed(1);
}

// ── Portfolio / holdings ─────────────────────────────────────────────────────
export interface HoldingView {
  holdingId: string;
  schemeName: string;
  fundSlug: string;
  category: string;
  units: number;
  currentValue: number;
  investedValue: number;
  returnPct: number;
  pendingAllotment: boolean;
  exitLoadPct: number;
  lockedUntil: string | null; // human full date or null
  lockedUntilIso: string | null;
}
export function getPortfolio(accountId: string): HoldingView[] {
  return [...store.holdings.values()]
    .filter((h) => h.accountId === accountId && h.units > 0)
    .map((h) => holdingView(h.holdingId)!)
    .filter(Boolean);
}
import { humanDateFull } from "./dates";
export function getHolding(holdingId: string): HoldingView | undefined {
  return holdingView(holdingId);
}
function holdingView(holdingId: string): HoldingView | undefined {
  const h = store.holdings.get(holdingId);
  if (!h) return undefined;
  const scheme = getScheme(h.schemeCode);
  const currentValue = +(h.units * h.currentNav).toFixed(0);
  const investedValue = +(h.units * h.avgNav).toFixed(0);
  return {
    holdingId: h.holdingId,
    schemeName: scheme?.name ?? "fund",
    fundSlug: scheme?.slug ?? "",
    category: scheme?.category ?? "",
    units: h.units,
    currentValue,
    investedValue,
    returnPct: investedValue ? +(((currentValue - investedValue) / investedValue) * 100).toFixed(1) : 0,
    pendingAllotment: !!h.pendingAllotment,
    exitLoadPct: h.exitLoadPct,
    lockedUntil: h.lockedUntil ? humanDateFull(h.lockedUntil) : null,
    lockedUntilIso: h.lockedUntil ?? null,
  };
}

// ── Fund catalog (consumer-shaped — NO schemeCode crosses into the app) ──────
export interface FundView {
  slug: string;
  name: string;
  category: string;
  riskWords: string;
  minAmount: number;
  multiple: number;
  sipMin: number;
  nav: number;
  rationale: string;
  oneYear: number;
  threeYear: number;
  isElss: boolean;
  recommendedForFirstTimer: boolean;
  closedToNew: boolean;
}
function toFund(s: Scheme): FundView {
  return {
    slug: s.slug, name: s.name, category: s.category, riskWords: s.riskWords,
    minAmount: s.minAmount, multiple: s.multiple, sipMin: s.sipMin, nav: s.nav,
    rationale: s.rationale, oneYear: s.oneYear, threeYear: s.threeYear,
    isElss: !!s.isElss, recommendedForFirstTimer: !!s.recommendedForFirstTimer,
    closedToNew: !!s.closedToNew,
  };
}
/** Look up a fund by its consumer slug. */
export function getFund(slug: string): FundView | undefined {
  const s = getSchemeBySlug(slug);
  return s ? toFund(s) : undefined;
}
/** All funds open to new money (for switch/STP destination pickers). */
export function listFunds(opts: { excludeSlug?: string; openOnly?: boolean } = {}): FundView[] {
  return SCHEMES
    .filter((s) => (opts.openOnly ? !s.closedToNew : true))
    .filter((s) => s.slug !== opts.excludeSlug)
    .map(toFund);
}
export const RECOMMENDED_FUND: FundView = toFund(RECOMMENDED_FIRST);

// ── Redemption quote (indicative — honest that it's not final until NAV strikes) ──
export interface RedeemQuote {
  grossValue: number;
  exitLoadPct: number;
  exitLoadAmount: number;
  indicativeNet: number;
  expectedCreditHuman: string;
  locked: boolean;
  lockedUntil: string | null;
  minBalance: number;
}
const REDEEM_MIN_BALANCE = 500;
export function redeemQuote(holdingId: string, opts: { amount?: number; allUnits?: boolean }): RedeemQuote | undefined {
  const h = getHolding(holdingId);
  if (!h) return undefined;
  const gross = opts.allUnits ? h.currentValue : Math.min(opts.amount ?? 0, h.currentValue);
  const exitLoadAmount = Math.round((gross * h.exitLoadPct) / 100);
  // payout lands ~T+2 business days
  let d = new Date();
  for (let i = 0; i < 3; i++) d = nextBusinessDay(d);
  return {
    grossValue: gross,
    exitLoadPct: h.exitLoadPct,
    exitLoadAmount,
    indicativeNet: gross - exitLoadAmount,
    expectedCreditHuman: humanDate(iso(d)),
    locked: !!h.lockedUntilIso && new Date(h.lockedUntilIso) > new Date(),
    lockedUntil: h.lockedUntil,
    minBalance: REDEEM_MIN_BALANCE,
  };
}

// ── Cutoff (for the live countdown object) ───────────────────────────────────
import { computeCutoff } from "./dates";
export interface CutoffView {
  cutoffPassed: boolean;
  navDateHuman: string;
  navWeekday: string;
  cutoffLabel: string; // "3:00 PM"
  msUntilCutoff: number;
}
export function getCutoff(forcePassed?: boolean): CutoffView {
  const c = computeCutoff(timing.cutoffHour, new Date(), forcePassed);
  const hour12 = ((timing.cutoffHour + 11) % 12) + 1;
  const ampm = timing.cutoffHour >= 12 ? "PM" : "AM";
  return {
    cutoffPassed: c.cutoffPassed,
    navDateHuman: humanDate(c.navDate),
    navWeekday: weekday(c.navDate),
    cutoffLabel: `${hour12}:00 ${ampm}`,
    msUntilCutoff: c.msUntilCutoff,
  };
}
