"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

type ValidationIssue = {
  path?: string;
  message?: string;
};

export function InquiryReplyForm({ inquiryId }: { inquiryId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submitReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    const response = await fetch(`/api/admin/inquiries/${inquiryId}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });

    const payload = (await response.json().catch(() => null)) as {
      error?: string;
      issues?: ValidationIssue[];
    } | null;

    setIsSubmitting(false);

    if (!response.ok) {
      toast.error(payload?.issues?.[0]?.message ?? payload?.error ?? "Unable to send reply.");
      return;
    }

    setMessage("");
    toast.success("Reply sent to buyer portal notifications.");
    router.refresh();
  }

  return (
    <form onSubmit={submitReply} className="space-y-3">
      <label className="block text-sm font-semibold text-[var(--ink-900)]" htmlFor="inquiry-reply">
        Reply to buyer
      </label>
      <textarea
        id="inquiry-reply"
        className="admin-focus min-h-32 w-full rounded-[var(--radius-md)] border border-[var(--line)] bg-white px-4 py-3 text-sm leading-6 text-[var(--ink-800)]"
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder="Write a concise update. The buyer will receive it in portal notifications."
      />
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-[var(--ink-500)]">Replies are visible to this buyer only.</p>
        <Button type="submit" disabled={isSubmitting || message.trim().length < 10}>
          {isSubmitting ? "Sending..." : "Send reply"}
        </Button>
      </div>
    </form>
  );
}
