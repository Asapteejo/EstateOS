"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { buildAuthRedirect, buildPublicDomainConfig } from "@/lib/domains";
import { publicEnv } from "@/lib/public-env";
import { Select } from "@/components/ui/select";

export function PropertyActions({
  propertyId,
  propertyPath,
  tenantSlug,
  tenantHost,
  marketers = [],
  paymentPlans = [],
}: {
  propertyId: string;
  propertyPath: string;
  tenantSlug?: string | null;
  tenantHost?: string | null;
  marketers?: Array<{ id: string; fullName: string; title: string }>;
  paymentPlans?: Array<{ id: string; title: string; kind: string }>;
}) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<"save" | "reserve" | null>(null);
  const [selectedMarketerId, setSelectedMarketerId] = useState("");
  const [selectedPaymentPlanId, setSelectedPaymentPlanId] = useState("");
  const domainConfig = buildPublicDomainConfig(publicEnv);

  function redirectToCentralAuth(entry: "buyer" | "purchase") {
    window.location.href = buildAuthRedirect(domainConfig, {
      returnTo: propertyPath,
      tenantSlug,
      tenantHost,
      entry,
    });
  }

  async function saveProperty() {
    setPendingAction("save");

    const response = await fetch("/api/saved-properties", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        propertyId,
        marketerId: selectedMarketerId || undefined,
        paymentPlanId: selectedPaymentPlanId || undefined,
      }),
    });

    setPendingAction(null);

    if (!response.ok) {
      redirectToCentralAuth("buyer");
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
        marketerId: selectedMarketerId || undefined,
        paymentPlanId: selectedPaymentPlanId || undefined,
      }),
    });

    setPendingAction(null);

    if (!response.ok) {
      redirectToCentralAuth("purchase");
      return;
    }

    toast.success("Reservation created. You can continue in the buyer portal.");
    router.push("/portal/reservations");
    router.refresh();
  }

  return (
    <div className="mt-6 space-y-3">
      {marketers.length > 0 ? (
        <Select className="w-full"
          value={selectedMarketerId}
          onChange={(event) => setSelectedMarketerId(event.target.value)}
        >
          <option value="">Select a marketer you are working with</option>
          {marketers.map((marketer) => (
            <option key={marketer.id} value={marketer.id}>
              {marketer.fullName}  -  {marketer.title}
            </option>
          ))}
        </Select>
      ) : null}
      {paymentPlans.length > 0 ? (
        <Select className="w-full"
          value={selectedPaymentPlanId}
          onChange={(event) => setSelectedPaymentPlanId(event.target.value)}
        >
          <option value="">Select a payment option</option>
          {paymentPlans.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.title}  -  {plan.kind.toLowerCase()}
            </option>
          ))}
        </Select>
      ) : null}
      <Button
        className="w-full"
        onClick={reserveProperty}
        loading={pendingAction === "reserve"}
        disabled={pendingAction !== null}
      >
        {pendingAction === "reserve" ? "Creating reservation…" : "Reserve property"}
      </Button>
      <Button
        variant="outline"
        className="w-full"
        onClick={saveProperty}
        loading={pendingAction === "save"}
        disabled={pendingAction !== null}
      >
        {pendingAction === "save" ? "Saving…" : "Save property"}
      </Button>
    </div>
  );
}
