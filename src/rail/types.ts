/**
 * Rail resource types. These carry the "internal reality" — including fields the
 * customer must NEVER see (clientCode, navDate, etc.). The app layer only ever
 * receives the consumer-shaped view models returned by `client.ts`, which strips
 * this vocabulary out. Keeping the rail's truth here is deliberate: it's what the
 * engineering team maps to the real NSE fields (see endpoints.md).
 */

export type KycStatus =
  | "VERIFIED"
  | "NOT_FOUND"
  | "INCOMPLETE"
  | "ON_HOLD"
  | "SERVICE_DOWN";

export interface KycResource {
  kycId: string;
  pan: string;
  resolved: boolean; // false while the check is still running
  status: KycStatus;
  statusDetail: string;
}

export type EkycStep =
  | "STARTED"
  | "AADHAAR_SENT"
  | "AADHAAR_VERIFIED"
  | "LIVENESS_OK"
  | "SUBMITTED"
  | "VERIFIED"
  | "FAILED";

export interface EkycResource {
  ekycId: string;
  pan: string;
  step: EkycStep;
  failReason?: string;
}

export type BankStatus = "PENDING" | "VERIFIED" | "NAME_MISMATCH" | "FAILED";

export interface BankDetail {
  accountNumber: string;
  ifsc: string;
  bankName: string;
  last4: string;
  status: BankStatus;
}

export type AccountStatus = "PENDING" | "ACTIVE";

export interface Nominee {
  name: string;
  relationship: string;
  sharePct: number;
}

export interface AccountResource {
  accountId: string;
  pan: string;
  holderName: string;
  taxResident: boolean; // true = resident India (in-scope), false = foreign (out of v1 scope)
  clientCode: string | null; // RAIL-ONLY (UCC). Never rendered.
  status: AccountStatus;
  nominee: Nominee | null;
  nomineeOptOut: boolean;
  bank: BankDetail | null;
}

export type MandateStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "UNSUPPORTED_BANK";

export interface MandateResource {
  mandateId: string;
  accountId: string;
  maxAmount: number; // the debit ceiling
  bankLast4: string;
  status: MandateStatus;
}

export type OrderType = "PURCHASE" | "REDEEM" | "SWITCH";
export type OrderStatus =
  | "ACCEPTED"
  | "CONFIRMED"
  | "ALLOTTED" // purchase / switch terminal success
  | "PROCESSING" // redeem
  | "PAID_OUT" // redeem terminal success
  | "PAYOUT_BOUNCED"
  | "SWITCH_RETURNED" // sold from A but buy into B failed -> amount returned
  | "REJECTED"
  | "CANCELLED";

export interface OrderResource {
  orderId: string;
  accountId: string;
  type: OrderType;
  schemeCode: string; // source fund (for switch, the fund sold FROM)
  toSchemeCode?: string; // switch: the fund bought INTO
  amount: number; // purchase: invest amount; redeem/switch: indicative moved amount
  unitsRedeemed?: number;
  allUnits?: boolean;
  status: OrderStatus;
  navDate: string; // ISO date the order is priced on (cutoff-aware)
  cutoffPassed: boolean;
  // populated at terminal:
  units?: number; // purchase / switch allotment into destination
  nav?: number;
  realisedAmount?: number; // redeem payout
  rejectReason?: string;
  idempotencyKey: string;
  createdAt: number;
}

// Systematic transfer/withdrawal plans (STP fund→fund, SWP fund→bank).
export type PlanKind = "STP" | "SWP";
export interface PlanResource {
  planId: string;
  kind: PlanKind;
  accountId: string;
  fromSchemeCode: string;
  toSchemeCode?: string; // STP only
  amount: number;
  frequency: "monthly" | "weekly";
  dayOfMonth: number;
  firstDate: string; // ISO
  bankLast4?: string; // SWP only
  status: "ACTIVE" | "PAUSED" | "ENDED";
}

export type PaymentStatus =
  | "PENDING"
  | "SUCCESS"
  | "FAILED"
  | "EXPIRED"
  | "REJECTED";

export type PaymentMethod = "UPI" | "NETBANKING" | "MANDATE";
export interface PaymentResource {
  paymentId: string;
  orderId: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  expiresAt: number; // wall-clock ms for the live timer
  debitedButFailed?: boolean; // worst case: money left account but status FAILED
  abandoned?: boolean; // net-banking: came back without paying
  idempotencyKey: string;
}

export type SipStatus = "AWAITING_MANDATE" | "ACTIVE" | "PAUSED" | "CANCELLED";

export interface SipResource {
  sipId: string;
  accountId: string;
  schemeCode: string;
  amount: number;
  frequency: "monthly" | "weekly";
  dayOfMonth: number;
  mandateId: string;
  status: SipStatus;
  firstDebitDate: string | null; // concrete once mandate approves
  startsNextCycle: boolean; // approved-after-chosen-date case
  lastInstalmentFailed?: boolean;
}

export interface Holding {
  holdingId: string;
  accountId: string;
  schemeCode: string;
  units: number;
  avgNav: number;
  currentNav: number;
  pendingAllotment?: boolean; // units still being allotted -> can't redeem yet
  exitLoadPct: number; // e.g. 1% if redeemed early
  lockedUntil?: string | null; // ELSS lock-in ISO date
}

// A consumer-shaped envelope every async fetch returns to the app.
export interface RailEnvelope<T> {
  id: string;
  status: string;
  statusDetail: string;
  nextPollAfterMs: number;
  data: T;
}

export type ForceableOutcome = {
  kyc?: KycStatus;
  pennyDrop?: BankStatus;
  mandate?: MandateStatus;
  payment?: PaymentStatus | "DEBITED_BUT_FAILED";
  order?: "ALLOTTED" | "REJECTED";
};
