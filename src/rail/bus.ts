/**
 * Tiny pub/sub event bus. This is how the rail pushes "webhooks" to the app
 * (payment resolution especially) AND how the dev panel's live transition log
 * narrates what the rail is doing. In production this is replaced by real webhook
 * callbacks + SSE/websocket fan-out from your backend.
 */

export interface TransitionEvent {
  resource: string; // "payment" | "order" | "kyc" | ...
  id: string;
  from: string;
  to: string;
  detail: string;
  at: number;
}

type Handler = (e: TransitionEvent) => void;

const handlers = new Set<Handler>();
const log: TransitionEvent[] = [];

export function emit(e: Omit<TransitionEvent, "at">) {
  const full: TransitionEvent = { ...e, at: Date.now() };
  log.unshift(full);
  if (log.length > 200) log.pop();
  handlers.forEach((h) => h(full));
}

export function subscribe(h: Handler): () => void {
  handlers.add(h);
  return () => handlers.delete(h);
}

export function getLog(): TransitionEvent[] {
  return log;
}

export function clearLog() {
  log.length = 0;
}
