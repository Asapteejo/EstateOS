"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";

import {
  createLeadQuick,
  createVisitorQuick,
  type QuickFormState,
} from "@/modules/front-desk/quick-create-actions";

const QUICK_FORM_INITIAL: QuickFormState = { ok: false, error: null };

const inputClass =
  "admin-focus w-full rounded-[var(--radius-md)] border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--ink-900)] placeholder:text-[var(--ink-400)]";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="admin-focus mt-1 inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--brand-700)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--brand-800,#15803d)] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Saving…" : label}
    </button>
  );
}

function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-sm text-[var(--danger-700,#b91c1c)]">
      {message}
    </p>
  );
}

export function VisitorQuickForm({ onSuccess }: { onSuccess: () => void }) {
  const [state, formAction] = useActionState(createVisitorQuick, QUICK_FORM_INITIAL);

  useEffect(() => {
    if (state.ok) onSuccess();
  }, [state.ok, onSuccess]);

  return (
    <form action={formAction} className="grid gap-3">
      <input name="fullName" required placeholder="Full name *" className={inputClass} aria-label="Visitor full name" />
      <input name="phone" placeholder="Phone" className={inputClass} aria-label="Visitor phone" />
      <input name="hostName" placeholder="Here to see" className={inputClass} aria-label="Host name" />
      <input name="purpose" placeholder="Purpose of visit" className={inputClass} aria-label="Purpose of visit" />
      <ErrorNote message={state.error} />
      <SubmitButton label="Check in visitor" />
    </form>
  );
}

export function LeadQuickForm({ onSuccess }: { onSuccess: () => void }) {
  const [state, formAction] = useActionState(createLeadQuick, QUICK_FORM_INITIAL);

  useEffect(() => {
    if (state.ok) onSuccess();
  }, [state.ok, onSuccess]);

  return (
    <form action={formAction} className="grid gap-3">
      <input name="fullName" required placeholder="Full name *" className={inputClass} aria-label="Lead full name" />
      <input name="email" type="email" required placeholder="Email *" className={inputClass} aria-label="Lead email" />
      <input name="phone" placeholder="Phone" className={inputClass} aria-label="Lead phone" />
      <textarea
        name="message"
        required
        rows={3}
        placeholder="What are they interested in? *"
        className={inputClass}
        aria-label="Lead note"
      />
      <ErrorNote message={state.error} />
      <SubmitButton label="Create lead" />
    </form>
  );
}
