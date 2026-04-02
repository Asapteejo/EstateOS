"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function AutomationRunnerButton() {
  const [pending, setPending] = useState(false);

  async function run() {
    setPending(true);
    const response = await fetch("/api/admin/automation/run", {
      method: "POST",
    });
    setPending(false);

    if (!response.ok) {
      const json = (await response.json().catch(() => null)) as { error?: string } | null;
      toast.error(json?.error ?? "Unable to run automation sweep.");
      return;
    }

    const json = (await response.json()) as {
      data?: {
        wishlistReminders?: number;
        overduePayments?: number;
        inspectionReminders?: number;
        followUpAlerts?: number;
      };
    };
    const result = json.data;
    toast.success(
      `Automation run complete. Wishlist: ${result?.wishlistReminders ?? 0}, payments: ${result?.overduePayments ?? 0}, inspections: ${result?.inspectionReminders ?? 0}.`,
    );
  }

  return (
    <Button type="button" variant="outline" onClick={run} disabled={pending}>
      {pending ? "Running..." : "Run automation sweep"}
    </Button>
  );
}
