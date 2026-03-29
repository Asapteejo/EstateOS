"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function PropertyActions({
  propertyId,
}: {
  propertyId: string;
}) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<"save" | "reserve" | null>(null);

  async function saveProperty() {
    setPendingAction("save");

    const response = await fetch("/api/saved-properties", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        propertyId,
      }),
    });

    setPendingAction(null);

    if (!response.ok) {
      toast.error("Sign in to save this property.");
      return;
    }

    const json = (await response.json()) as {
      data?: { status?: "saved" | "removed" };
    };

    toast.success(
      json.data?.status === "removed"
        ? "Property removed from your saved list."
        : "Property saved to your buyer workspace.",
    );
    router.refresh();
  }

  async function reserveProperty() {
    setPendingAction("reserve");

    const response = await fetch("/api/reservations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        propertyId,
      }),
    });

    setPendingAction(null);

    if (!response.ok) {
      toast.error("Sign in with a buyer account to reserve this property.");
      return;
    }

    toast.success("Reservation created. You can continue in the buyer portal.");
    router.push("/portal/reservations");
    router.refresh();
  }

  return (
    <div className="mt-6 space-y-3">
      <Button className="w-full" onClick={reserveProperty} disabled={pendingAction !== null}>
        {pendingAction === "reserve" ? "Creating reservation..." : "Reserve property"}
      </Button>
      <Button variant="outline" className="w-full" onClick={saveProperty} disabled={pendingAction !== null}>
        {pendingAction === "save" ? "Saving..." : "Save property"}
      </Button>
    </div>
  );
}
