/**
 * Seed personas + reachable failure fixtures. Typing a PAN at the resolver picks
 * the branch. Re-run on every reset() / page load.
 */
import { store, clearStore } from "./store";
import type { KycStatus } from "./types";

export interface Persona {
  pan: string;
  kyc: KycStatus;
  name: string;
  demoLabel: string;
}

export const PERSONAS: Persona[] = [
  {
    pan: "AAAPA1111A",
    kyc: "VERIFIED",
    name: "Aarav Apte",
    demoLabel: "Returning fast-path (UCC + approved mandate + a holding)",
  },
  {
    pan: "BBBPB2222B",
    kyc: "NOT_FOUND",
    name: "Bhavna Bose",
    demoLabel: "First-timer — full e-KYC journey",
  },
  {
    pan: "CCCPC3333C",
    kyc: "INCOMPLETE",
    name: "Chetan Chauhan",
    demoLabel: "Stale record — quick re-verification",
  },
  {
    pan: "DDDPD4444D",
    kyc: "ON_HOLD",
    name: "Divya Das",
    demoLabel: "Manual review — graceful dead-end + help route",
  },
  {
    pan: "EEEPE5555E",
    kyc: "SERVICE_DOWN",
    name: "Esha Eapen",
    demoLabel: "KRA down — soft-fail + retry",
  },
];

export const BAD_BANK_ACCOUNT = "0000000000"; // -> NAME_MISMATCH on penny-drop
export const UNSUPPORTED_IFSC_PREFIX = "XXXX"; // -> mandate UNSUPPORTED_BANK

export function personaForPan(pan: string): Persona | undefined {
  return PERSONAS.find((p) => p.pan.toUpperCase() === pan.toUpperCase());
}

/** Reset everything to the seeded state. */
export function seed() {
  clearStore();

  // Returning user (AAAPA1111A): already has an ACTIVE account, approved mandate,
  // and one holding — so they skip gates 2-3 and can demo redemption + SIP.
  const acc = {
    accountId: "acc_seed_aarav",
    pan: "AAAPA1111A",
    holderName: "Aarav Apte",
    taxResident: true,
    clientCode: "H40021", // RAIL-ONLY
    status: "ACTIVE" as const,
    nominee: { name: "Sunita Apte", relationship: "Spouse", sharePct: 100 },
    nomineeOptOut: false,
    bank: {
      accountNumber: "5512349900",
      ifsc: "HDFC0001234",
      bankName: "HDFC Bank",
      last4: "9900",
      status: "VERIFIED" as const,
    },
  };
  store.accounts.set(acc.accountId, acc);

  store.mandates.set("mnd_seed_aarav", {
    mandateId: "mnd_seed_aarav",
    accountId: acc.accountId,
    maxAmount: 10000,
    bankLast4: "9900",
    status: "APPROVED",
  });

  store.holdings.set("hld_seed_1", {
    holdingId: "hld_seed_1",
    accountId: acc.accountId,
    schemeCode: "PRBLCHP-GR",
    units: 206.42,
    avgNav: 113.7,
    currentNav: 120.98,
    exitLoadPct: 1, // demo: a small exit load so the disclosure path is reachable
    lockedUntil: null,
  });

  store.holdings.set("hld_seed_elss", {
    holdingId: "hld_seed_elss",
    accountId: acc.accountId,
    schemeCode: "TAXSVR3Y-GR",
    units: 57.9,
    avgNav: 79.2,
    currentNav: 86.44,
    exitLoadPct: 0,
    lockedUntil: "2026-09-12", // still locked -> redemption blocked on these units
  });

  store.seq = 1000;
}
