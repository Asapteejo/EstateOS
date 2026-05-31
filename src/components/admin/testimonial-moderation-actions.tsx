"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

type Action = "APPROVE" | "APPROVE_AND_PUBLISH" | "REJECT" | "PUBLISH" | "UNPUBLISH" | "DELETE";

type Props = {
  testimonialId: string;
  status: string;
};

export function TestimonialModerationActions({ testimonialId, status }: Props) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<Action | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  async function runAction(action: Action) {
    if (action === "REJECT" && rejectionReason.trim().length < 5) {
      toast.error("Enter a rejection reason first.");
      return;
    }

    if (action === "DELETE" && !window.confirm("Soft-delete this testimonial?")) {
      return;
    }

    setPendingAction(action);
    const response = await fetch(`/api/admin/testimonials/${testimonialId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        rejectionReason: action === "REJECT" ? rejectionReason : undefined,
      }),
    });

    const payload = (await response.json().catch(() => null)) as { error?: string; issues?: Array<{ message?: string }> } | null;
    setPendingAction(null);

    if (!response.ok) {
      toast.error(payload?.issues?.[0]?.message ?? payload?.error ?? "Unable to update testimonial.");
      return;
    }

    toast.success("Testimonial updated.");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={() => runAction("APPROVE")}
          disabled={Boolean(pendingAction) || status === "APPROVED" || status === "PUBLISHED"}
        >
          {pendingAction === "APPROVE" ? "Approving..." : "Approve"}
        </Button>
        <Button
          onClick={() => runAction("APPROVE_AND_PUBLISH")}
          disabled={Boolean(pendingAction) || status === "PUBLISHED"}
        >
          {pendingAction === "APPROVE_AND_PUBLISH" ? "Publishing..." : "Approve and publish"}
        </Button>
        <Button
          variant="outline"
          onClick={() => runAction("PUBLISH")}
          disabled={Boolean(pendingAction) || status === "PUBLISHED" || status === "REJECTED"}
        >
          {pendingAction === "PUBLISH" ? "Publishing..." : "Publish"}
        </Button>
        <Button
          variant="outline"
          onClick={() => runAction("UNPUBLISH")}
          disabled={Boolean(pendingAction) || status !== "PUBLISHED"}
        >
          {pendingAction === "UNPUBLISH" ? "Unpublishing..." : "Unpublish"}
        </Button>
        <Button
          variant="outline"
          onClick={() => runAction("DELETE")}
          disabled={Boolean(pendingAction)}
        >
          {pendingAction === "DELETE" ? "Deleting..." : "Delete"}
        </Button>
      </div>

      <div className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--sand-50)] p-4">
        <label className="block text-sm font-semibold text-[var(--ink-900)]" htmlFor="testimonial-rejection-reason">
          Rejection reason
        </label>
        <textarea
          id="testimonial-rejection-reason"
          value={rejectionReason}
          onChange={(event) => setRejectionReason(event.target.value)}
          placeholder="Required when rejecting. This is sent to the buyer."
          className="admin-focus mt-2 min-h-24 w-full rounded-[var(--radius-md)] border border-[var(--line)] bg-white px-4 py-3 text-sm"
        />
        <Button
          className="mt-3"
          variant="outline"
          onClick={() => runAction("REJECT")}
          disabled={Boolean(pendingAction)}
        >
          {pendingAction === "REJECT" ? "Rejecting..." : "Reject with reason"}
        </Button>
      </div>
    </div>
  );
}
