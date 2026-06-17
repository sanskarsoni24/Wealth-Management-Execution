/** Gate 3 — Mandate (auto-debit permission). Maps to /registration/product/MANDATE. Async, bank-approved. */
import { store, nextId } from "../store";
import { schedule } from "../scheduler";
import { emit } from "../bus";
import { timing } from "../config";
import { UNSUPPORTED_IFSC_PREFIX } from "../seed";
import type { MandateResource, MandateStatus } from "../types";

interface MandateInput {
  accountId: string;
  maxAmount: number;
  ifsc: string;
  bankLast4: string;
}

/** PENDING -> APPROVED (after mandateApproveMs) | REJECTED | UNSUPPORTED_BANK. */
export function mandateCreate(input: MandateInput): MandateResource {
  const id = nextId("mnd");
  const rec: MandateResource = {
    mandateId: id,
    accountId: input.accountId,
    maxAmount: input.maxAmount,
    bankLast4: input.bankLast4,
    status: "PENDING",
  };
  store.mandates.set(id, rec);
  emit({ resource: "mandate", id, from: "-", to: "PENDING", detail: "Sent to bank for approval" });

  // Unsupported bank resolves immediately (synchronous reject at registration).
  if (input.ifsc.toUpperCase().startsWith(UNSUPPORTED_IFSC_PREFIX)) {
    rec.status = "UNSUPPORTED_BANK";
    emit({ resource: "mandate", id, from: "PENDING", to: "UNSUPPORTED_BANK", detail: "Bank not supported" });
    return rec;
  }

  schedule(`mnd:${id}`, () => {
    const forced = store.forces.mandate;
    const status: MandateStatus = forced ?? "APPROVED";
    store.forces.mandate = undefined;
    rec.status = status;
    emit({ resource: "mandate", id, from: "PENDING", to: status, detail: `Mandate ${status}` });
    // When a mandate approves, flip any AWAITING_MANDATE SIPs on this account to ACTIVE.
    if (status === "APPROVED") activateSipsForMandate(id);
  }, timing.mandateApproveMs);

  return rec;
}

import { onMandateApproved } from "./sip";
function activateSipsForMandate(mandateId: string) {
  store.sips.forEach((sip) => {
    if (sip.mandateId === mandateId && sip.status === "AWAITING_MANDATE") {
      onMandateApproved(sip.sipId);
    }
  });
}
