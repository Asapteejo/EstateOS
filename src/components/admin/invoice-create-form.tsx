"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { createInvoiceAction, type InvoiceFormState } from "@/modules/invoices/actions";

const INITIAL: InvoiceFormState = { ok: false, error: null };

const inputClass =
  "admin-focus w-full rounded-[var(--radius-md)] border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--ink-900)] placeholder:text-[var(--ink-400)]";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="admin-focus inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--brand-700)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--brand-800,#15803d)] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Creating…" : "Create invoice"}
    </button>
  );
}

export function InvoiceCreateForm() {
  const [state, formAction] = useActionState(createInvoiceAction, INITIAL);
  const [rows, setRows] = useState(2);
  const formRef = useRef<HTMLFormElement>(null);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    if (!state.ok) return;
    formRef.current?.reset();
    const resetTimer = setTimeout(() => { setRows(2); setJustSaved(true); }, 0);
    const clearTimer = setTimeout(() => setJustSaved(false), 4000);
    return () => { clearTimeout(resetTimer); clearTimeout(clearTimer); };
  }, [state.ok]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="rounded-[var(--radius-xl)] border border-[var(--line)] bg-[var(--surface-1,#fff)] p-5 shadow-[var(--shadow-sm)] sm:p-6"
    >
      <h2 className="text-base font-semibold text-[var(--ink-950)]">Create an invoice</h2>
      <p className="mt-0.5 text-sm text-[var(--ink-500)]">
        The buyer can download or print it once it&apos;s issued.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <input name="buyerName" required placeholder="Buyer name *" className={inputClass} aria-label="Buyer name" />
        <input name="buyerEmail" type="email" required placeholder="Buyer email *" className={inputClass} aria-label="Buyer email" />
        <input name="propertyTitle" placeholder="Property / reference" className={`${inputClass} sm:col-span-2`} aria-label="Property" />
      </div>

      <div className="mt-4 space-y-2">
        <div className="grid grid-cols-[1fr_140px] gap-2 text-xs font-medium uppercase tracking-wide text-[var(--ink-500)]">
          <span>Line item</span>
          <span>Amount</span>
        </div>
        {Array.from({ length: rows }).map((_, index) => {
          const i = index + 1;
          return (
            <div key={i} className="grid grid-cols-[1fr_140px] gap-2">
              <input name={`description_${i}`} placeholder={i === 1 ? "e.g. Unit purchase price *" : "Description"} className={inputClass} aria-label={`Line item ${i} description`} />
              <input name={`amount_${i}`} inputMode="decimal" placeholder="0" className={inputClass} aria-label={`Line item ${i} amount`} />
            </div>
          );
        })}
        {rows < 4 ? (
          <button
            type="button"
            onClick={() => setRows((current) => Math.min(4, current + 1))}
            className="admin-focus text-sm font-medium text-[var(--brand-700)] hover:underline"
          >
            + Add line item
          </button>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm text-[var(--ink-600)]">
          Tax (optional)
          <input name="taxAmount" inputMode="decimal" placeholder="0" className={`${inputClass} mt-1`} aria-label="Tax amount" />
        </label>
        <label className="text-sm text-[var(--ink-600)]">
          Due date (optional)
          <input name="dueDate" type="date" className={`${inputClass} mt-1`} aria-label="Due date" />
        </label>
        <textarea name="notes" rows={2} placeholder="Notes (optional)" className={`${inputClass} sm:col-span-2`} aria-label="Notes" />
      </div>

      <div className="mt-4 flex items-center gap-3">
        <SubmitButton />
        {state.error ? (
          <span role="alert" className="text-sm text-[var(--danger-700,#b91c1c)]">{state.error}</span>
        ) : justSaved ? (
          <span className="text-sm text-[var(--success-700,#15803d)]">Invoice created.</span>
        ) : null}
      </div>
    </form>
  );
}
