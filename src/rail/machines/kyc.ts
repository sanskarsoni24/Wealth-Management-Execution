/** Gate 1 — KYC identity check + resumable e-KYC. Maps to NSE KYC_CHECK + EKYCREG. */
import { store, nextId } from "../store";
import { schedule } from "../scheduler";
import { emit } from "../bus";
import { timing } from "../config";
import { personaForPan } from "../seed";
import type { EkycResource, EkycStep, KycResource, KycStatus } from "../types";

const KYC_DETAIL: Record<KycStatus, string> = {
  VERIFIED: "Identity verified",
  NOT_FOUND: "No identity record found",
  INCOMPLETE: "Existing record is incomplete",
  ON_HOLD: "Manual review required",
  SERVICE_DOWN: "Verification partner unreachable",
};

/** POST /kyc/check — resolves after kycCheckMs to one of five outcomes. */
export function kycCheck(pan: string): KycResource {
  const id = nextId("kyc");
  const rec: KycResource = {
    kycId: id,
    pan,
    resolved: false,
    status: "NOT_FOUND", // unused until resolved=true
    statusDetail: "Checking…",
  };
  store.kyc.set(id, rec);

  schedule(`kyc:${id}`, () => {
    // dev-panel force wins, else persona, else NOT_FOUND
    const forced = store.forces.kyc;
    const persona = personaForPan(pan);
    const status: KycStatus = forced ?? persona?.kyc ?? "NOT_FOUND";
    store.forces.kyc = undefined;
    rec.resolved = true;
    rec.status = status;
    rec.statusDetail = KYC_DETAIL[status];
    emit({ resource: "kyc", id, from: "CHECKING", to: status, detail: KYC_DETAIL[status] });
  }, timing.kycCheckMs);

  return rec;
}

const EKYC_FLOW: EkycStep[] = [
  "STARTED",
  "AADHAAR_SENT",
  "AADHAAR_VERIFIED",
  "LIVENESS_OK",
  "SUBMITTED",
  "VERIFIED",
];

export function ekycStart(pan: string): EkycResource {
  const id = nextId("ekyc");
  const rec: EkycResource = { ekycId: id, pan, step: "STARTED" };
  store.ekyc.set(id, rec);
  emit({ resource: "ekyc", id, from: "-", to: "STARTED", detail: "e-KYC started" });
  return rec;
}

/** Advance one step. `fail` forces FAILED at the current step (dev panel / liveness fail). */
export function ekycAdvance(ekycId: string, fail?: string): EkycResource | undefined {
  const rec = store.ekyc.get(ekycId);
  if (!rec) return undefined;
  if (fail) {
    const from = rec.step;
    rec.step = "FAILED";
    rec.failReason = fail;
    emit({ resource: "ekyc", id: ekycId, from, to: "FAILED", detail: fail });
    return rec;
  }
  const idx = EKYC_FLOW.indexOf(rec.step);
  if (idx >= 0 && idx < EKYC_FLOW.length - 1) {
    const from = rec.step;
    rec.step = EKYC_FLOW[idx + 1];
    rec.failReason = undefined;
    emit({ resource: "ekyc", id: ekycId, from, to: rec.step, detail: `e-KYC ${rec.step}` });
  }
  return rec;
}

/** Send the Aadhaar OTP (async at the partner), then the app verifies it. */
export function ekycSendAadhaarOtp(ekycId: string) {
  const rec = store.ekyc.get(ekycId);
  if (!rec) return;
  // Only advance STARTED -> AADHAAR_SENT. If already at/after AADHAAR_SENT, a resend
  // is cosmetic (the OTP entry stays put) and must not skip the OTP step.
  if (rec.step !== "STARTED") return;
  schedule(`ekyc:otp:${ekycId}`, () => ekycAdvance(ekycId), timing.ekycStepMs);
}

/** Return a FAILED e-KYC back to the OTP entry step so the user can retry. */
export function ekycRetryOtp(ekycId: string) {
  const rec = store.ekyc.get(ekycId);
  if (!rec) return;
  const from = rec.step;
  rec.step = "AADHAAR_SENT";
  rec.failReason = undefined;
  emit({ resource: "ekyc", id: ekycId, from, to: "AADHAAR_SENT", detail: "Retrying OTP" });
}

export function ekycVerifyAadhaar(ekycId: string, bad?: boolean) {
  if (bad) return ekycAdvance(ekycId, "That code didn’t work");
  // AADHAAR_SENT -> AADHAAR_VERIFIED
  return ekycAdvance(ekycId);
}

/** Liveness: schedule the queued check, then SUBMITTED -> VERIFIED. */
export function ekycLiveness(ekycId: string, fail?: boolean) {
  const rec = store.ekyc.get(ekycId);
  if (!rec) return;
  if (fail) {
    ekycAdvance(ekycId, "We couldn’t get a clear read");
    return;
  }
  schedule(`ekyc:live:${ekycId}`, () => {
    ekycAdvance(ekycId); // AADHAAR_VERIFIED -> LIVENESS_OK
    ekycAdvance(ekycId); // LIVENESS_OK -> SUBMITTED
    schedule(`ekyc:submit:${ekycId}`, () => ekycAdvance(ekycId), timing.ekycStepMs); // -> VERIFIED
  }, timing.ekycStepMs);
}
