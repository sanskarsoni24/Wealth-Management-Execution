/**
 * Dev controls — the demo superpower. The dev panel talks to the rail through this
 * surface only. None of this exists in production; it's how a presenter forces
 * outcomes, fast-forwards delays, jumps the NAV cutoff, and narrates the rail.
 */
import { store } from "./store";
import { seed } from "./seed";
import { setTiming, resetTiming, timing, DEFAULT_TIMING } from "./config";
import { fastForwardAll, clearAll } from "./scheduler";
import { forceActivePayment } from "./machines/payments";
import { clearLog, emit } from "./bus";
import type { ForceableOutcome } from "./types";

/** Queue a forced outcome for the NEXT applicable resolution. */
export function forceNext(patch: ForceableOutcome) {
  Object.assign(store.forces, patch);
}

/**
 * Resolve the currently-pending payment immediately (or queue for the next one). Unlike
 * the other gates, a pending UPI collect is usually already on-screen, so forcing it
 * should apply now rather than waiting for the user to approve.
 */
export function forcePayment(status: NonNullable<ForceableOutcome["payment"]>) {
  forceActivePayment(status);
}

export function getForces(): ForceableOutcome {
  return { ...store.forces };
}

export function clearForces() {
  store.forces = {};
}

/** Fast-forward every pending resource to its terminal state. */
export function fastForward() {
  fastForwardAll();
}

export function setTimeScale(scale: number) {
  setTiming({ timeScale: scale });
}

export function setCutoffHour(hour: number) {
  setTiming({ cutoffHour: hour });
}

export function getTiming() {
  return { ...timing };
}

/** Reset all in-memory state to the seeded personas. */
export function resetAll() {
  clearAll();
  clearLog();
  resetTiming();
  seed();
  emit({ resource: "system", id: "-", from: "-", to: "RESET", detail: "State reset to seeded personas" });
}

export { DEFAULT_TIMING };
