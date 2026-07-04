"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { createThreadAction, type MessageFormState } from "@/modules/messaging/actions";

const INITIAL: MessageFormState = { ok: false, error: null };

const inputClass =
  "admin-focus w-full rounded-[var(--radius-md)] border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--ink-900)] placeholder:text-[var(--ink-400)]";

function StartButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="admin-focus inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--brand-700)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--brand-800,#0a4638)] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Starting…" : "Start conversation"}
    </button>
  );
}

export function NewThreadForm() {
  const [state, formAction] = useActionState(createThreadAction, INITIAL);
  const formRef = useRef<HTMLFormElement>(null);
  const [justSent, setJustSent] = useState(false);

  useEffect(() => {
    if (!state.ok) return;
    formRef.current?.reset();
    const resetTimer = setTimeout(() => setJustSent(true), 0);
    const clearTimer = setTimeout(() => setJustSent(false), 4000);
    return () => { clearTimeout(resetTimer); clearTimeout(clearTimer); };
  }, [state.ok]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="rounded-[var(--radius-xl)] border border-[var(--line)] bg-[var(--surface-1,#fff)] p-5 shadow-[var(--shadow-sm)]"
    >
      <h2 className="text-base font-semibold text-[var(--ink-950)]">Start a new conversation</h2>
      <p className="mt-0.5 text-sm text-[var(--ink-500)]">Message the sales team about a property, payment, or anything else.</p>
      <div className="mt-4 space-y-3">
        <input name="subject" required placeholder="Subject *" className={inputClass} aria-label="Subject" />
        <textarea name="body" required rows={3} placeholder="Your message *" className={`${inputClass} resize-y`} aria-label="Your message" />
        <div className="flex items-center gap-3">
          <StartButton />
          {state.error ? (
            <span role="alert" className="text-sm text-[var(--danger-700)]">{state.error}</span>
          ) : justSent ? (
            <span className="text-sm text-[var(--success-700)]">Message sent.</span>
          ) : null}
        </div>
      </div>
    </form>
  );
}
