/** Gate 5 — UPI payment. Maps to /payments/purchase_payment + upi_status_check webhook. */
import { store, nextId } from "../store";
import { schedule, cancel } from "../scheduler";
import { emit } from "../bus";
import { timing } from "../config";
import { onPaymentSuccess } from "./orders";
import type { PaymentMethod, PaymentResource, PaymentStatus } from "../types";

interface PaymentInput {
  orderId: string;
  amount: number;
  method?: PaymentMethod;
  idempotencyKey: string;
}

/**
 * POST /payments — PENDING with an expiry. A UPI collect needs the user to APPROVE in
 * their UPI app, so it does NOT auto-resolve: if nothing approves it, it EXPIRES (models
 * a real collect timeout — this is what makes "let it time out" reachable). Resolution
 * fires on the bus = the "webhook" the payment screen reacts to live.
 */
export function paymentCreate(input: PaymentInput): PaymentResource {
  const existingId = store.idempotency.get(input.idempotencyKey);
  if (existingId) {
    const existing = store.payments.get(existingId);
    if (existing) return existing;
  }

  const id = nextId("pay");
  const method = input.method ?? "UPI";
  const expiresAt = Date.now() + timing.paymentExpiryMs * timing.timeScale;
  const rec: PaymentResource = {
    paymentId: id,
    orderId: input.orderId,
    amount: input.amount,
    method,
    status: "PENDING",
    expiresAt,
    idempotencyKey: input.idempotencyKey,
  };
  store.payments.set(id, rec);
  store.idempotency.set(input.idempotencyKey, id);
  store.activePaymentId = id;
  emit({ resource: "payment", id, from: "-", to: "PENDING", detail: `${method} payment initiated` });

  if (method === "MANDATE") {
    // Pay-using-auto-pay: no app-switch; the bank debits on its own schedule -> SUCCESS.
    schedule(`pay:mandate:${id}`, () => {
      const forced = store.forces.payment;
      store.forces.payment = undefined;
      if (forced === "DEBITED_BUT_FAILED") return resolve(id, "FAILED", true);
      if (forced) return resolve(id, forced as PaymentStatus);
      return resolve(id, "SUCCESS");
    }, timing.paymentResolveMs);
  } else {
    // UPI / net-banking: explicit approval needed; otherwise auto-EXPIRE (collect timeout).
    schedule(`pay:expire:${id}`, () => resolve(id, "EXPIRED"), timing.paymentExpiryMs);
  }
  return rec;
}

/** Net-banking: the user returned without completing payment. No money taken. */
export function paymentAbandon(id: string) {
  const rec = store.payments.get(id);
  if (!rec || rec.status !== "PENDING") return;
  cancel(`pay:expire:${id}`);
  rec.status = "FAILED";
  rec.abandoned = true;
  if (store.activePaymentId === id) store.activePaymentId = undefined;
  emit({ resource: "payment", id, from: "PENDING", to: "ABANDONED", detail: "Returned without paying" });
}

/** The user approved in their UPI app. Resolve to SUCCESS, unless a force is queued. */
export function paymentApprove(id: string) {
  const forced = store.forces.payment;
  store.forces.payment = undefined;
  if (forced === "DEBITED_BUT_FAILED") return resolve(id, "FAILED", true);
  if (forced) return resolve(id, forced as PaymentStatus);
  return resolve(id, "SUCCESS");
}

function resolve(id: string, status: PaymentStatus, debitedButFailed = false) {
  const rec = store.payments.get(id);
  if (!rec || rec.status !== "PENDING") return; // already terminal
  cancel(`pay:expire:${id}`);
  cancel(`pay:mandate:${id}`);
  rec.status = status;
  rec.debitedButFailed = debitedButFailed;
  if (store.activePaymentId === id) store.activePaymentId = undefined;
  emit({
    resource: "payment",
    id,
    from: "PENDING",
    to: debitedButFailed ? "FAILED (debited)" : status,
    detail: debitedButFailed ? "Money left account but unconfirmed" : `Payment ${status}`,
  });
  // Webhook side-effect: on success the linked order proceeds to CONFIRMED -> ALLOTTED.
  if (status === "SUCCESS") onPaymentSuccess(rec.orderId);
}

/**
 * Dev panel: resolve the currently-pending payment immediately to a chosen outcome.
 * If none is pending, queue it for the next payment instead.
 */
export function forceActivePayment(status: PaymentStatus | "DEBITED_BUT_FAILED") {
  const id = store.activePaymentId;
  const rec = id ? store.payments.get(id) : undefined;
  if (rec && rec.status === "PENDING") {
    if (status === "DEBITED_BUT_FAILED") resolve(id!, "FAILED", true);
    else resolve(id!, status);
  } else {
    store.forces.payment = status;
  }
}
