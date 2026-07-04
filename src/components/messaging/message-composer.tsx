"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";

import type { MessageFormState } from "@/modules/messaging/actions";

const INITIAL: MessageFormState = { ok: false, error: null };

function SendButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="admin-focus inline-flex shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--brand-700)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--brand-800,#0a4638)] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Sending…" : "Send"}
    </button>
  );
}

export function MessageComposer({
  action,
  threadId,
  placeholder = "Write a reply…",
}: {
  action: (prev: MessageFormState, formData: FormData) => Promise<MessageFormState>;
  threadId: string;
  placeholder?: string;
}) {
  const [state, formAction] = useActionState(action, INITIAL);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <form ref={formRef} action={formAction} className="mt-3 border-t border-[var(--line)] pt-3">
      <input type="hidden" name="threadId" value={threadId} />
      <textarea
        name="body"
        required
        rows={2}
        placeholder={placeholder}
        aria-label="Message"
        className="admin-focus w-full resize-y rounded-[var(--radius-md)] border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--ink-900)] placeholder:text-[var(--ink-400)]"
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        {state.error ? (
          <span role="alert" className="text-sm text-[var(--danger-700)]">
            {state.error}
          </span>
        ) : (
          <span />
        )}
        <SendButton />
      </div>
    </form>
  );
}
