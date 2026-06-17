/**
 * The scheduler models the rail's "it resolves later" nature. Every pending
 * resource registers a timer here; the dev panel can fast-forward (fire now) or
 * the timeScale shrinks every wait. This is the single place delays live.
 */
import { timing } from "./config";

interface Scheduled {
  key: string;
  fn: () => void;
  timer: ReturnType<typeof setTimeout>;
}

const scheduled = new Map<string, Scheduled>();

/** Schedule `fn` to run after `ms × timeScale`. Re-scheduling the same key cancels the prior. */
export function schedule(key: string, fn: () => void, ms: number) {
  cancel(key);
  const delay = Math.max(0, Math.round(ms * timing.timeScale));
  const timer = setTimeout(() => {
    scheduled.delete(key);
    fn();
  }, delay);
  scheduled.set(key, { key, fn, timer });
}

/** Fire a scheduled task immediately (dev panel "fast-forward"). */
export function fastForward(key: string) {
  const s = scheduled.get(key);
  if (!s) return false;
  clearTimeout(s.timer);
  scheduled.delete(key);
  s.fn();
  return true;
}

/** Fire every pending task right now. */
export function fastForwardAll() {
  [...scheduled.keys()].forEach(fastForward);
}

export function cancel(key: string) {
  const s = scheduled.get(key);
  if (s) {
    clearTimeout(s.timer);
    scheduled.delete(key);
  }
}

export function pendingKeys(): string[] {
  return [...scheduled.keys()];
}

export function clearAll() {
  scheduled.forEach((s) => clearTimeout(s.timer));
  scheduled.clear();
}
