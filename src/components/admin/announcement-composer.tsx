"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { createAnnouncementAction, type AnnouncementFormState } from "@/modules/announcements/actions";

const INITIAL: AnnouncementFormState = { ok: false, error: null };

const inputClass =
  "admin-focus w-full rounded-[var(--radius-md)] border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--ink-900)] placeholder:text-[var(--ink-400)]";

function PostButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="admin-focus inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--brand-700)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--brand-800,#0a4638)] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Posting…" : "Post announcement"}
    </button>
  );
}

export function AnnouncementComposer() {
  const [state, formAction] = useActionState(createAnnouncementAction, INITIAL);
  const formRef = useRef<HTMLFormElement>(null);
  const [justPosted, setJustPosted] = useState(false);

  useEffect(() => {
    if (!state.ok) return;
    formRef.current?.reset();
    const resetTimer = setTimeout(() => setJustPosted(true), 0);
    const clearTimer = setTimeout(() => setJustPosted(false), 4000);
    return () => { clearTimeout(resetTimer); clearTimeout(clearTimer); };
  }, [state.ok]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="rounded-[var(--radius-xl)] border border-[var(--line)] bg-[var(--surface-1,#fff)] p-5 shadow-[var(--shadow-sm)]"
    >
      <h2 className="text-base font-semibold text-[var(--ink-950)]">Post an announcement</h2>
      <p className="mt-0.5 text-sm text-[var(--ink-500)]">
        Broadcast a notice. It appears at the top of your buyers&apos; portal until dismissed or expired.
      </p>

      <div className="mt-4 space-y-3">
        <input name="title" required placeholder="Title *" className={inputClass} aria-label="Title" />
        <textarea name="body" required rows={4} placeholder="Write your announcement *" className={`${inputClass} resize-y`} aria-label="Announcement body" />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-[var(--ink-600)]">
            Audience
            <select name="audience" defaultValue="BUYERS" className={`${inputClass} mt-1`} aria-label="Audience">
              <option value="BUYERS">Buyers</option>
              <option value="OPERATORS">Staff</option>
              <option value="ALL">Everyone</option>
            </select>
          </label>
          <label className="text-sm text-[var(--ink-600)]">
            Expires (optional)
            <input name="expiresAt" type="date" className={`${inputClass} mt-1`} aria-label="Expiry date" />
          </label>
        </div>
        <div className="flex items-center gap-3">
          <PostButton />
          {state.error ? (
            <span role="alert" className="text-sm text-[var(--danger-700)]">{state.error}</span>
          ) : justPosted ? (
            <span className="text-sm text-[var(--success-700)]">Announcement posted.</span>
          ) : null}
        </div>
      </div>
    </form>
  );
}
