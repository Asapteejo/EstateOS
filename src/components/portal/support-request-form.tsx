"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const CATEGORY_OPTIONS = [
  ["bug", "Bug"],
  ["feature_request", "Feature request"],
  ["question", "Question"],
  ["billing", "Billing"],
  ["onboarding", "Onboarding"],
  ["other", "Other"],
] as const;

type Props = {
  initialName: string;
  initialEmail: string;
};

export function SupportRequestForm({ initialName, initialEmail }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [category, setCategory] = useState<(typeof CATEGORY_OPTIONS)[number][0]>("question");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const browserInfo = useMemo(() => {
    if (typeof window === "undefined") {
      return "";
    }

    const bits = [
      navigator.userAgent,
      navigator.platform || null,
      navigator.language || null,
    ].filter(Boolean);

    return bits.join(" | ");
  }, []);

  async function submit() {
    setPending(true);

    try {
      const response = await fetch("/api/portal/support", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          category,
          subject,
          message,
          pageUrl: typeof window === "undefined" ? null : window.location.href,
          browserInfo,
        }),
      });

      const json = (await response.json().catch(() => null)) as
        | {
            success?: boolean;
            data?: {
              syncStatus?: string;
              linearIssueIdentifier?: string | null;
            };
            error?: string;
          }
        | null;

      if (!response.ok) {
        toast.error(json?.error ?? "Unable to submit support request.");
        return;
      }

      setSubject("");
      setMessage("");
      router.refresh();

      const issueSuffix = json?.data?.linearIssueIdentifier
        ? ` Linked as ${json.data.linearIssueIdentifier}.`
        : "";
      const syncSuffix =
        json?.data?.syncStatus === "FAILED"
          ? " Saved internally, but Linear sync needs operator attention."
          : json?.data?.syncStatus === "SKIPPED"
            ? " Saved internally."
            : issueSuffix;

      toast.success(`Support request submitted.${syncSuffix}`);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-5">
      <Card className="p-6 sm:p-8">
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ink-400)]">
              Reporter
            </div>
            <div className="text-sm text-[var(--ink-700)]">
              {initialName || "Signed-in buyer"}
            </div>
            <div className="text-sm text-[var(--ink-500)]">{initialEmail || "No email on file"}</div>
          </div>
          <div className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ink-400)]">
              What happens next
            </div>
            <div className="text-sm leading-6 text-[var(--ink-600)]">
              Your request is stored inside EstateOS first. If Linear is configured for the
              workspace, the operations team also gets an issue automatically.
            </div>
          </div>
        </div>
      </Card>

      <Card className="space-y-5 p-6 sm:p-8">
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-[var(--ink-700)]">Category</label>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value as (typeof category))}
              className="admin-interactive admin-focus h-11 w-full rounded-[var(--radius-md)] border border-[var(--line)] bg-white px-4 text-sm text-[var(--ink-900)]"
            >
              {CATEGORY_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-[var(--ink-700)]">Subject</label>
            <Input
              placeholder="Short summary of the issue"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-[var(--ink-700)]">Message</label>
          <Textarea
            placeholder="Explain what happened, what you expected, and any steps that lead to it."
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />
          <div className="text-xs leading-5 text-[var(--ink-500)]">
            We include your current page URL and browser details automatically to help the operator
            team reproduce the issue faster.
          </div>
        </div>

        <div className="flex items-center justify-end">
          <Button onClick={submit} disabled={pending || subject.trim().length < 3 || message.trim().length < 10}>
            {pending ? "Submitting..." : "Submit support request"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
