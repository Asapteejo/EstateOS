"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import {
  generateContractFormAction,
  type GenerateContractActionState,
} from "./actions";

type ContractReadiness = {
  ceoName: boolean;
  ceoTitle: boolean;
  signatureUploaded: boolean;
  stampUploaded: boolean;
  contractTermsPresent: boolean;
  isConfigured: boolean;
};

type TransactionOption = {
  id: string;
  label: string;
};

const initialState: GenerateContractActionState = { ok: false };

export function GenerateContractForm({
  transactions,
  readiness,
}: {
  transactions: TransactionOption[];
  readiness: ContractReadiness;
}) {
  const [state, action, pending] = useActionState(generateContractFormAction, initialState);

  if (transactions.length === 0) return null;

  const missingItems = [
    ["CEO/signatory name", readiness.ceoName],
    ["CEO/signatory title", readiness.ceoTitle],
    ["Signature image", readiness.signatureUploaded],
    ["Company stamp", readiness.stampUploaded],
    ["Contract terms", readiness.contractTermsPresent],
  ]
    .filter(([, complete]) => !complete)
    .map(([label]) => label);
  const disabled = !readiness.isConfigured || pending;

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-white p-5">
      <h2 className="text-sm font-semibold text-[var(--ink-900)]">Generate Contract of Sale</h2>
      <p className="mt-1 text-sm text-[var(--ink-500)]">
        Create the system-generated PDF from tenant contract settings and the selected transaction.
      </p>
      {!readiness.isConfigured ? (
        <div className="mt-4 rounded-[var(--radius-md)] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">Configure contract settings before generating PDFs.</p>
          <p className="mt-1">
            Missing: {missingItems.join(", ")}. Add the signatory, signature, stamp, and terms in{" "}
            <Link href="/admin/settings/contracts" className="font-semibold underline">
              Settings - Contracts
            </Link>
            .
          </p>
        </div>
      ) : null}
      {state.error ? (
        <div className="mt-4 rounded-[var(--radius-md)] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      ) : null}
      {state.ok && state.message ? (
        <div className="mt-4 rounded-[var(--radius-md)] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {state.message}
        </div>
      ) : null}
      <form action={action} className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--ink-600)]">
            Transaction
          </label>
          <select
            name="transactionId"
            required
            disabled={!readiness.isConfigured}
            className="w-full rounded-[var(--radius-md)] border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--ink-800)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)] disabled:cursor-not-allowed disabled:bg-[var(--sand-100)] disabled:text-[var(--ink-400)]"
          >
            <option value="">Select a transaction...</option>
            {transactions.map((tx) => (
              <option key={tx.id} value={tx.id}>
                {tx.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <Button type="submit" variant="default" disabled={disabled}>
            {pending ? "Generating..." : "Generate PDF"}
          </Button>
        </div>
      </form>
    </div>
  );
}
