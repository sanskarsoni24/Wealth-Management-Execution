/** Gate 2 — UCC account create + bank penny-drop. Maps to CLIENTCOMMON183 + CLIENTBANKDTL. */
import { store, nextId } from "../store";
import { schedule } from "../scheduler";
import { emit } from "../bus";
import { timing } from "../config";
import { BAD_BANK_ACCOUNT } from "../seed";
import type { AccountResource, BankStatus, Nominee } from "../types";

interface CreateInput {
  pan: string;
  holderName: string;
  taxResident: boolean;
  nominee: Nominee | null;
  nomineeOptOut: boolean;
}

/** POST /account/create — PENDING, resolves to ACTIVE with a synthetic clientCode. */
export function accountCreate(input: CreateInput): AccountResource {
  const id = nextId("acc");
  const rec: AccountResource = {
    accountId: id,
    pan: input.pan,
    holderName: input.holderName,
    taxResident: input.taxResident,
    clientCode: null,
    status: "PENDING",
    nominee: input.nominee,
    nomineeOptOut: input.nomineeOptOut,
    bank: null,
  };
  store.accounts.set(id, rec);
  emit({ resource: "account", id, from: "-", to: "PENDING", detail: "Creating investor record" });

  schedule(`acc:${id}`, () => {
    rec.status = "ACTIVE";
    rec.clientCode = "H" + Math.floor(10000 + Math.random() * 89999); // RAIL-ONLY
    emit({ resource: "account", id, from: "PENDING", to: "ACTIVE", detail: "Account ready" });
  }, timing.uccCreateMs);

  return rec;
}

interface BankInput {
  accountId: string;
  accountNumber: string;
  ifsc: string;
  bankName: string;
}

/** Penny-drop verification: PENDING -> VERIFIED | NAME_MISMATCH (seeded bad acct) | FAILED. */
export function bankVerify(input: BankInput): AccountResource | undefined {
  const acc = store.accounts.get(input.accountId);
  if (!acc) return undefined;
  const last4 = input.accountNumber.slice(-4);
  acc.bank = {
    accountNumber: input.accountNumber,
    ifsc: input.ifsc,
    bankName: input.bankName,
    last4,
    status: "PENDING",
  };
  emit({ resource: "bank", id: input.accountId, from: "-", to: "PENDING", detail: "Confirming bank account" });

  schedule(`bank:${input.accountId}`, () => {
    if (!acc.bank) return;
    let status: BankStatus = "VERIFIED";
    const forced = store.forces.pennyDrop;
    if (forced) status = forced;
    else if (input.accountNumber === BAD_BANK_ACCOUNT) status = "NAME_MISMATCH";
    else if (/[a-z]/i.test(input.accountNumber)) status = "FAILED"; // non-numeric -> wrong account
    store.forces.pennyDrop = undefined;
    acc.bank.status = status;
    emit({ resource: "bank", id: input.accountId, from: "PENDING", to: status, detail: `Bank ${status}` });
  }, timing.pennyDropMs);

  return acc;
}
