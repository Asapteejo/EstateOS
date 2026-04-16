"use client";

import { useState } from "react";
import { toast } from "sonner";

import { sendDraftReplyAction } from "@/app/(admin)/admin/leads/actions";
import { Button } from "@/components/ui/button";

export function InquiryDraftReply({
  inquiryId,
  recipientEmail,
  recipientName,
}: {
  inquiryId: string;
  recipientEmail: string;
  recipientName: string;
}) {
  const [draft, setDraft] = useState("");
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);

  async function generateDraft() {
    setDraft("");
    setGenerating(true);
    try {
      const response = await fetch(`/api/admin/inquiries/${inquiryId}/draft-reply`, {
        method: "POST",
      });
      if (!response.ok || !response.body) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        toast.error(payload?.error ?? "Failed to generate draft.");
        return;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setDraft(accumulated);
      }
    } catch {
      toast.error("Failed to generate draft.");
    } finally {
      setGenerating(false);
    }
  }

  async function sendReply() {
    if (!draft.trim()) return;
    setSending(true);
    try {
      const result = await sendDraftReplyAction(recipientEmail, recipientName, draft, inquiryId);
      if (result.ok) {
        toast.success(`Email sent to ${recipientEmail}.`);
        setDraft("");
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to send email.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-500)]">
          AI reply draft
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={generateDraft}
          disabled={generating || sending}
        >
          {generating ? "Drafting…" : draft ? "Re-draft" : "Draft reply"}
        </Button>
      </div>

      {generating && !draft && (
        <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--sand-50)] px-4 py-3 text-sm text-[var(--ink-500)]">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-[var(--ink-300)] border-t-[var(--ink-700)]" />
          Generating draft…
        </div>
      )}

      {(draft || (generating && draft)) && (
        <div className="space-y-2">
          <textarea
            className="admin-focus w-full rounded-[var(--radius-md)] border border-[var(--line)] bg-white px-4 py-3 text-sm leading-6 text-[var(--ink-800)] focus:outline-none"
            rows={10}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Draft will appear here…"
            disabled={generating}
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-[var(--ink-400)]">
              Review and edit before sending to{" "}
              <span className="font-medium text-[var(--ink-600)]">{recipientEmail}</span>
            </p>
            <Button
              size="sm"
              onClick={sendReply}
              disabled={generating || sending || !draft.trim()}
            >
              {sending ? "Sending…" : "Send"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
