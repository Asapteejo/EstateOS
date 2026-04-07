"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type DealCreationOptions = {
  properties: Array<{
    id: string;
    title: string;
    priceFrom: number;
    units: Array<{
      id: string;
      title: string;
      unitCode: string;
      price: number;
      status: string;
    }>;
    paymentPlans: Array<{
      id: string;
      title: string;
      propertyUnitId: string | null;
      kind: string;
      firstInstallmentAmount: number;
    }>;
  }>;
};

export function DealCreateForm({ options }: { options: DealCreationOptions }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [quickPropertyPending, setQuickPropertyPending] = useState(false);
  const [showQuickProperty, setShowQuickProperty] = useState(options.properties.length === 0);
  const [quickPropertyTitle, setQuickPropertyTitle] = useState("");
  const [quickPropertyPrice, setQuickPropertyPrice] = useState("");
  const [properties, setProperties] = useState(options.properties);
  const [buyerName, setBuyerName] = useState("");
  const [propertyId, setPropertyId] = useState(options.properties[0]?.id ?? "");
  const [propertyUnitId, setPropertyUnitId] = useState("");
  const [paymentMode, setPaymentMode] = useState<"FULL" | "INSTALLMENT">("FULL");
  const [paymentPlanId, setPaymentPlanId] = useState("");
  const selectedProperty = useMemo(
    () => properties.find((property) => property.id === propertyId) ?? null,
    [properties, propertyId],
  );
  const availableUnits = selectedProperty?.units ?? [];
  const availablePlans = (selectedProperty?.paymentPlans ?? []).filter(
    (plan) => !plan.propertyUnitId || plan.propertyUnitId === propertyUnitId,
  );
  const [totalValue, setTotalValue] = useState(
    selectedProperty ? String(selectedProperty.priceFrom) : "",
  );

  const selectedUnit = availableUnits.find((unit) => unit.id === propertyUnitId) ?? null;

  function syncPrice(nextPropertyId: string, nextUnitId: string) {
    const property = properties.find((item) => item.id === nextPropertyId) ?? null;
    const unit = property?.units.find((item) => item.id === nextUnitId) ?? null;
    setTotalValue(String(unit?.price ?? property?.priceFrom ?? ""));
  }

  async function quickCreateProperty() {
    if (!quickPropertyTitle.trim()) {
      toast.error("Property name is required.");
      return;
    }

    setQuickPropertyPending(true);
    try {
      const response = await fetch("/api/admin/deals/property", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: quickPropertyTitle,
          price: quickPropertyPrice ? Number(quickPropertyPrice) : undefined,
        }),
      });
      const json = (await response.json().catch(() => null)) as
        | {
            success?: boolean;
            error?: string;
            data?: DealCreationOptions["properties"][number];
          }
        | null;

      if (!response.ok || !json?.success || !json.data) {
        throw new Error(json?.error ?? "Unable to quick add property.");
      }

      setProperties((current) => [json.data!, ...current]);
      setPropertyId(json.data.id);
      setPropertyUnitId("");
      setPaymentPlanId("");
      setTotalValue(String(json.data.priceFrom ?? ""));
      setShowQuickProperty(false);
      setQuickPropertyTitle("");
      setQuickPropertyPrice("");
      toast.success("Property added. Continue creating the deal.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to quick add property.");
    } finally {
      setQuickPropertyPending(false);
    }
  }

  async function submit() {
    if (!buyerName.trim()) {
      toast.error("Buyer name is required.");
      return;
    }

    if (!propertyId) {
      toast.error("Select a property or quick add one for this deal.");
      return;
    }

    setPending(true);

    try {
      const response = await fetch("/api/admin/deals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          buyerName,
          propertyId,
          propertyUnitId: propertyUnitId || undefined,
          totalValue: Number(totalValue),
          paymentMode,
          paymentPlanId: paymentMode === "INSTALLMENT" ? paymentPlanId || undefined : undefined,
        }),
      });
      const json = (await response.json().catch(() => null)) as
        | { success?: boolean; error?: string; data?: { redirectTo?: string } }
        | null;

      if (!response.ok || !json?.success) {
        throw new Error(json?.error ?? "Unable to create deal.");
      }

      toast.success("Deal created. Back to the Deal Board.");
      router.push(json.data?.redirectTo ?? "/admin");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create deal.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
      <Card className="rounded-[32px] border-[var(--line)] bg-white p-8 sm:p-10">
        <div className="space-y-8">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--ink-500)]">
              Create first deal
            </div>
            <h2 className="mt-3 text-3xl font-semibold text-[var(--ink-950)]">
              Track this buyer from inquiry to final payment.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--ink-600)]">
              Keep it simple. Choose the buyer, the property, and the deal value. You can update
              the rest later.
            </p>
          </div>

          <div className="grid gap-5">
            <label className="space-y-2">
              <span className="text-sm font-medium text-[var(--ink-700)]">Buyer name</span>
              <Input
                autoFocus
                placeholder="e.g. Ada Okafor"
                value={buyerName}
                onChange={(event) => setBuyerName(event.target.value)}
              />
              <div className="text-xs text-[var(--ink-500)]">
                We will create a client record for this buyer automatically.
              </div>
            </label>

            <div className="grid gap-5 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium text-[var(--ink-700)]">Property</span>
                <select
                  className="h-11 w-full rounded-2xl border border-[var(--line)] bg-white px-4 text-sm text-[var(--ink-900)]"
                  value={propertyId}
                  onChange={(event) => {
                    const nextPropertyId = event.target.value;
                    setPropertyId(nextPropertyId);
                    setPropertyUnitId("");
                    setPaymentPlanId("");
                    syncPrice(nextPropertyId, "");
                  }}
                >
                  <option value="">Select a property</option>
                  {properties.map((property) => (
                    <option key={property.id} value={property.id}>
                      {property.title}
                    </option>
                  ))}
                </select>
                <div className="flex items-center justify-between gap-3 text-xs text-[var(--ink-500)]">
                  <span>Select an existing property or add one inline.</span>
                  <button
                    type="button"
                    onClick={() => setShowQuickProperty((current) => !current)}
                    className="font-semibold text-[var(--brand-700)] transition hover:text-[var(--brand-800)]"
                  >
                    + Quick add property
                  </button>
                </div>
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-[var(--ink-700)]">Unit</span>
                <select
                  className="h-11 w-full rounded-2xl border border-[var(--line)] bg-white px-4 text-sm text-[var(--ink-900)]"
                  value={propertyUnitId}
                  onChange={(event) => {
                    const nextUnitId = event.target.value;
                    setPropertyUnitId(nextUnitId);
                    setPaymentPlanId("");
                    syncPrice(propertyId, nextUnitId);
                  }}
                >
                  <option value="">No specific unit</option>
                  {availableUnits.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.unitCode} - {unit.title}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {showQuickProperty ? (
              <div className="rounded-[24px] border border-[var(--line)] bg-[var(--sand-50)] p-5">
                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px_auto] md:items-end">
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-[var(--ink-700)]">Property name</span>
                    <Input
                      placeholder="e.g. Lekki Crest Residences"
                      value={quickPropertyTitle}
                      onChange={(event) => setQuickPropertyTitle(event.target.value)}
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-[var(--ink-700)]">Price</span>
                    <Input
                      type="number"
                      placeholder="Optional"
                      value={quickPropertyPrice}
                      onChange={(event) => setQuickPropertyPrice(event.target.value)}
                    />
                  </label>
                  <Button onClick={quickCreateProperty} disabled={quickPropertyPending}>
                    {quickPropertyPending ? "Adding..." : "Add property"}
                  </Button>
                </div>
                <p className="mt-3 text-xs leading-6 text-[var(--ink-500)]">
                  Quick add keeps you on the deal flow. We will create a basic property now and you can
                  fill in the rest later.
                </p>
              </div>
            ) : null}

            <div className="grid gap-5 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium text-[var(--ink-700)]">Deal value</span>
                <Input
                  type="number"
                  placeholder="92000000"
                  value={totalValue}
                  onChange={(event) => setTotalValue(event.target.value)}
                />
              </label>

              <div className="space-y-2">
                <span className="text-sm font-medium text-[var(--ink-700)]">Payment mode</span>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMode("FULL");
                      setPaymentPlanId("");
                    }}
                    className={`rounded-2xl border px-4 py-3 text-left text-sm font-medium transition ${
                      paymentMode === "FULL"
                        ? "border-[var(--brand-600)] bg-[var(--sand-50)] text-[var(--ink-950)]"
                        : "border-[var(--line)] bg-white text-[var(--ink-700)]"
                    }`}
                  >
                    Full payment
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMode("INSTALLMENT")}
                    className={`rounded-2xl border px-4 py-3 text-left text-sm font-medium transition ${
                      paymentMode === "INSTALLMENT"
                        ? "border-[var(--brand-600)] bg-[var(--sand-50)] text-[var(--ink-950)]"
                        : "border-[var(--line)] bg-white text-[var(--ink-700)]"
                    }`}
                  >
                    Installment
                  </button>
                </div>
              </div>
            </div>

            {paymentMode === "INSTALLMENT" ? (
              <label className="space-y-2">
                <span className="text-sm font-medium text-[var(--ink-700)]">Payment plan</span>
                <select
                  className="h-11 w-full rounded-2xl border border-[var(--line)] bg-white px-4 text-sm text-[var(--ink-900)]"
                  value={paymentPlanId}
                  onChange={(event) => setPaymentPlanId(event.target.value)}
                >
                  <option value="">No specific plan</option>
                  {availablePlans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.title}
                    </option>
                  ))}
                </select>
                <div className="text-xs text-[var(--ink-500)]">
                  Optional. If you select a plan, the deal can inherit the first installment amount.
                </div>
              </label>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <Button onClick={submit} disabled={pending}>
                {pending ? "Creating deal..." : "Create deal"}
              </Button>
              <Button variant="outline" onClick={() => router.push("/admin")}>
                Back to Deal Board
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <Card className="rounded-[32px] border-[var(--line)] bg-[var(--sand-50)] p-6">
        <div className="space-y-4">
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--ink-500)]">
            What this creates
          </div>
          <div className="text-sm leading-7 text-[var(--ink-700)]">
            <div>A buyer record for {buyerName.trim() || "your new client"}</div>
            <div>
              A deal linked to {selectedUnit?.title ?? selectedProperty?.title ?? "the selected property"}
            </div>
            <div>A live card on the Deal Board</div>
          </div>
          <div className="rounded-[24px] border border-[var(--line)] bg-white p-4 text-sm leading-7 text-[var(--ink-600)]">
            You can update details later. The goal here is speed: get one real deal into the
            board, then start sending payment requests and tracking collections.
          </div>
        </div>
      </Card>
    </div>
  );
}
