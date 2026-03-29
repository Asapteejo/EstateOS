"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

type KycReviewItem = {
  id: string;
  buyer: string;
  status: string;
  notes: string | null;
  documentType: string;
  fileName: string;
  updatedAt: string;
  downloadUrl: string;
};

export function KycReviewManager({ items }: { items: KycReviewItem[] }) {
  const router = useRouter();
  const [draftNotes, setDraftNotes] = useState<Record<string, string>>(
    Object.fromEntries(items.map((item) => [item.id, item.notes ?? ""])),
  );
  const [pending, setPending] = useState<string | null>(null);

  async function updateStatus(submissionId: string, status: string) {
    setPending(submissionId);
    const response = await fetch(`/api/admin/kyc-submissions/${submissionId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status,
        notes: draftNotes[submissionId] || undefined,
      }),
    });
    setPending(null);

    if (!response.ok) {
      const json = (await response.json().catch(() => null)) as { error?: string } | null;
      toast.error(json?.error ?? "Unable to update KYC review.");
      return;
    }

    toast.success("KYC review updated.");
    router.refresh();
  }

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-[var(--line)] px-6 py-4">
        <h3 className="text-lg font-semibold text-[var(--ink-950)]">KYC review queue</h3>
      </div>
      <div className="divide-y divide-[var(--line)]">
        {items.length > 0 ? (
          items.map((item) => (
            <div key={item.id} className="grid gap-4 px-6 py-5 xl:grid-cols-[1fr_0.9fr_1.2fr_auto]">
              <div>
                <div className="font-semibold text-[var(--ink-950)]">{item.fileName}</div>
                <div className="mt-1 text-sm text-[var(--ink-500)]">{item.documentType} • {item.buyer}</div>
                <div className="mt-3">
                  <Badge>{item.status.toLowerCase().replaceAll("_", " ")}</Badge>
                </div>
              </div>
              <div className="text-sm text-[var(--ink-700)]">
                {new Date(item.updatedAt).toLocaleString()}
              </div>
              <Textarea
                value={draftNotes[item.id] ?? ""}
                onChange={(event) =>
                  setDraftNotes((current) => ({
                    ...current,
                    [item.id]: event.target.value,
                  }))
                }
                placeholder="Reviewer note"
                className="min-h-24"
              />
              <div className="flex flex-col items-stretch gap-2">
                <a href={item.downloadUrl}>
                  <Button variant="outline" size="sm" className="w-full">Open doc</Button>
                </a>
                <Button size="sm" variant="outline" disabled={pending === item.id} onClick={() => updateStatus(item.id, "UNDER_REVIEW")}>
                  Under review
                </Button>
                <Button size="sm" disabled={pending === item.id} onClick={() => updateStatus(item.id, "APPROVED")}>
                  Approve
                </Button>
                <Button size="sm" variant="outline" disabled={pending === item.id} onClick={() => updateStatus(item.id, "CHANGES_REQUESTED")}>
                  Request changes
                </Button>
                <Button size="sm" variant="outline" disabled={pending === item.id} onClick={() => updateStatus(item.id, "REJECTED")}>
                  Reject
                </Button>
              </div>
            </div>
          ))
        ) : (
          <div className="px-6 py-10 text-center text-sm text-[var(--ink-500)]">
            No KYC submissions are waiting for review.
          </div>
        )}
      </div>
    </Card>
  );
}
