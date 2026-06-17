/**
 * In-memory store. Everything resets on reload — no DB, no persistence. This
 * mirrors production topology only in shape: in prod, YOUR backend holds the
 * encrypted NSE creds + whitelisted IP and persists real records. Here it's Maps.
 */
import type {
  AccountResource,
  EkycResource,
  ForceableOutcome,
  Holding,
  KycResource,
  MandateResource,
  OrderResource,
  PaymentResource,
  PlanResource,
  SipResource,
} from "./types";

export interface Store {
  kyc: Map<string, KycResource>;
  ekyc: Map<string, EkycResource>;
  accounts: Map<string, AccountResource>;
  mandates: Map<string, MandateResource>;
  orders: Map<string, OrderResource>;
  payments: Map<string, PaymentResource>;
  sips: Map<string, SipResource>;
  plans: Map<string, PlanResource>;
  holdings: Map<string, Holding>;
  // idempotency: key -> resourceId
  idempotency: Map<string, string>;
  // dev-panel "force next outcome" queue
  forces: ForceableOutcome;
  // the most recent PENDING payment (so the dev panel can resolve "the" payment)
  activePaymentId?: string;
  seq: number;
}

export const store: Store = blank();

function blank(): Store {
  return {
    kyc: new Map(),
    ekyc: new Map(),
    accounts: new Map(),
    mandates: new Map(),
    orders: new Map(),
    payments: new Map(),
    sips: new Map(),
    plans: new Map(),
    holdings: new Map(),
    idempotency: new Map(),
    forces: {},
    seq: 0,
  };
}

export function clearStore() {
  const fresh = blank();
  (Object.keys(fresh) as (keyof Store)[]).forEach((k) => {
    // @ts-expect-error reassign in place to keep the same exported reference
    store[k] = fresh[k];
  });
}

export function nextId(prefix: string): string {
  store.seq += 1;
  return `${prefix}_${store.seq.toString().padStart(4, "0")}`;
}
