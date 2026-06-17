/**
 * Timing config for the mock rail. Every async resource resolves on one of these
 * timers, multiplied by `timeScale`. The dev panel mutates this live so a presenter
 * can fast-forward a multi-day journey into seconds.
 *
 * These mirror `mock-backend.md`. In production NONE of this exists — the real rail's
 * timing is dictated by NSE/banks/SEBI cutoffs. Here we simulate it so the UX for the
 * delays (which ARE the product) can be designed and demoed.
 */
export interface TimingConfig {
  kycCheckMs: number;
  ekycStepMs: number;
  uccCreateMs: number;
  pennyDropMs: number;
  mandateApproveMs: number;
  paymentResolveMs: number;
  paymentExpiryMs: number;
  allotmentMs: number;
  redeemPayoutMs: number;
  cutoffHour: number; // IST hour after which orders price at next business day
  timeScale: number; // multiplies all timers; 0.05 = "fast-forward demo"
}

export const DEFAULT_TIMING: TimingConfig = {
  kycCheckMs: 800,
  ekycStepMs: 1200,
  uccCreateMs: 3000,
  pennyDropMs: 2000,
  mandateApproveMs: 8000,
  paymentResolveMs: 6000,
  paymentExpiryMs: 30000,
  allotmentMs: 15000,
  redeemPayoutMs: 12000,
  cutoffHour: 15,
  timeScale: 1,
};

// Live, mutable copy the scheduler reads from.
export const timing: TimingConfig = { ...DEFAULT_TIMING };

export function setTiming(patch: Partial<TimingConfig>) {
  Object.assign(timing, patch);
}

export function resetTiming() {
  Object.assign(timing, DEFAULT_TIMING);
}
