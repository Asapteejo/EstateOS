"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type PlanRecord = {
  id: string;
  code: string;
  slug: string;
  name: string;
  description: string | null;
  interval: "MONTHLY" | "ANNUAL";
  priceAmount: number;
  currency: string;
  isActive: boolean;
  isPublic: boolean;
  canBeGranted: boolean;
  subscriberCount: number;
};

type CompanyRecord = {
  subscriptionId?: string | null;
  companyId: string;
  companyName: string;
  companySlug: string;
  planLabel: string;
  status: string;
  interval: string;
  expiresAt: string;
  payoutReadiness: string;
  commissionRule: string;
};

type CompanyPlanStatus = {
  state: "NO_PLAN" | "ACTIVE" | "EXPIRED";
  isActive: boolean;
  isGranted: boolean;
  expiresAt: Date | null;
  plan: {
    id: string;
    code: string;
    slug: string;
    name: string;
    interval: "MONTHLY" | "ANNUAL";
  } | null;
  subscription: {
    id: string;
    status: string;
    grantReason?: string | null;
  } | null;
};

type PlanFormState = {
  code: string;
  slug: string;
  name: string;
  description: string;
  interval: "MONTHLY" | "ANNUAL";
  priceAmount: string;
  currency: string;
  isActive: boolean;
  isPublic: boolean;
  canBeGranted: boolean;
};

function buildPlanFormState(plan?: PlanRecord | null): PlanFormState {
  return {
    code: plan?.code ?? "",
    slug: plan?.slug ?? "",
    name: plan?.name ?? "",
    description: plan?.description ?? "",
    interval: plan?.interval ?? "MONTHLY",
    priceAmount: plan ? String(plan.priceAmount) : "",
    currency: plan?.currency ?? "NGN",
    isActive: plan?.isActive ?? true,
    isPublic: plan?.isPublic ?? true,
    canBeGranted: plan?.canBeGranted ?? true,
  };
}

export function BillingManagement({
  isSuperAdmin,
  companyPlanStatus,
  companyBilling,
  companySummary,
  plans,
  companies,
}: {
  isSuperAdmin: boolean;
  companyPlanStatus: CompanyPlanStatus;
  companyBilling: {
    defaultCurrency: string;
    transactionProvider: string;
    requireActivePlanForTransactions: boolean;
    payoutReadiness: string;
    commissionRule: string;
    commissionRecordsCount?: number;
  };
  companySummary: {
    activeSubscriptions: number;
    grantedPlans: number;
    expiredSubscriptions: number;
    commissionEarned: string;
    subscriptionRevenue: string;
    payoutIssues: number;
  };
  plans: PlanRecord[];
  companies: CompanyRecord[];
}) {
  const router = useRouter();
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [planForm, setPlanForm] = useState<PlanFormState>(buildPlanFormState());
  const [assignment, setAssignment] = useState({
    companyId: companies[0]?.companyId ?? "",
    planId: plans[0]?.id ?? "",
    status: "GRANTED",
    interval: plans[0]?.interval ?? "MONTHLY",
    reason: "",
    notes: "",
  });
  const [revocationNotes, setRevocationNotes] = useState("");
  const [pending, setPending] = useState<string | null>(null);

  function syncFormFromPlan(plan: PlanRecord | null) {
    setEditingPlanId(plan?.id ?? null);
    setPlanForm(buildPlanFormState(plan));
  }

  async function submitPlan() {
    setPending("plan");
    const response = await fetch(
      editingPlanId ? `/api/admin/billing/plans/${editingPlanId}` : "/api/admin/billing/plans",
      {
        method: editingPlanId ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...planForm,
          priceAmount: Number(planForm.priceAmount),
        }),
      },
    );
    setPending(null);

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      toast.error(body?.error ?? "Unable to save plan.");
      return;
    }

    toast.success(editingPlanId ? "Plan updated." : "Plan created.");
    syncFormFromPlan(null);
    router.refresh();
  }

  async function submitAssignment() {
    setPending("assignment");
    const response = await fetch("/api/admin/billing/subscriptions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(assignment),
    });
    setPending(null);

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      toast.error(body?.error ?? "Unable to assign company plan.");
      return;
    }

    toast.success("Company subscription updated.");
    setAssignment((current) => ({
      ...current,
      reason: "",
      notes: "",
    }));
    router.refresh();
  }

  async function revokeSubscription(subscriptionId: string) {
    setPending(subscriptionId);
    const response = await fetch(`/api/admin/billing/subscriptions/${subscriptionId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: "CANCELLED",
        notes: revocationNotes || undefined,
      }),
    });
    setPending(null);

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      toast.error(body?.error ?? "Unable to revoke subscription.");
      return;
    }

    toast.success("Subscription revoked.");
    setRevocationNotes("");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-3 xl:grid-cols-6">
        <SummaryCard label="Active subscriptions" value={String(companySummary.activeSubscriptions)} />
        <SummaryCard label="Granted plans" value={String(companySummary.grantedPlans)} />
        <SummaryCard label="Expired subscriptions" value={String(companySummary.expiredSubscriptions)} />
        <SummaryCard label="Commission earned" value={companySummary.commissionEarned} />
        <SummaryCard label="Subscription revenue" value={companySummary.subscriptionRevenue} />
        <SummaryCard label="Payout issues" value={String(companySummary.payoutIssues)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.48fr_0.52fr]">
        <Card className="space-y-4 p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-[var(--ink-950)]">Company billing state</h3>
              <p className="mt-1 text-sm text-[var(--ink-500)]">
                Current plan access, commission rules, and split-settlement readiness.
              </p>
            </div>
            <Badge>{companyPlanStatus.state.toLowerCase()}</Badge>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <InfoBlock label="Current plan" value={companyPlanStatus.plan ? `${companyPlanStatus.plan.name} ${companyPlanStatus.plan.interval.toLowerCase()}` : "No active plan"} />
            <InfoBlock label="Subscription state" value={companyPlanStatus.subscription?.status ?? "NO_PLAN"} />
            <InfoBlock label="Granted by superadmin" value={companyPlanStatus.isGranted ? "Yes" : "No"} />
            <InfoBlock label="Expires at" value={companyPlanStatus.expiresAt ? companyPlanStatus.expiresAt.toISOString().slice(0, 10) : "Not set"} />
            <InfoBlock label="Transaction provider" value={companyBilling.transactionProvider} />
            <InfoBlock label="Default currency" value={companyBilling.defaultCurrency} />
            <InfoBlock label="Commission rule" value={companyBilling.commissionRule} />
            <InfoBlock label="Payout readiness" value={companyBilling.payoutReadiness} />
          </div>
          <div className="rounded-3xl border border-[var(--line)] bg-[var(--sand-100)] p-4 text-sm text-[var(--ink-600)]">
            Transaction commission still applies even when the current company plan was granted manually.
          </div>
        </Card>

        <Card className="space-y-4 p-6">
          <div>
            <h3 className="text-lg font-semibold text-[var(--ink-950)]">Plans</h3>
            <p className="mt-1 text-sm text-[var(--ink-500)]">
              Monthly and annual plans are modeled separately so renewal and access windows remain explicit.
            </p>
          </div>
          <div className="space-y-3">
            {plans.map((plan) => (
              <button
                key={plan.id}
                type="button"
                onClick={() => isSuperAdmin && syncFormFromPlan(plan)}
                className="w-full rounded-3xl border border-[var(--line)] bg-white p-4 text-left transition hover:border-[var(--brand-400)]"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-[var(--ink-950)]">
                      {plan.name}  -  {plan.interval.toLowerCase()}
                    </div>
                    <div className="mt-1 text-sm text-[var(--ink-500)]">
                      {plan.currency} {plan.priceAmount.toLocaleString()}  -  {plan.subscriberCount} subscribers
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Badge>{plan.isActive ? "active" : "inactive"}</Badge>
                    <Badge>{plan.isPublic ? "public" : "private"}</Badge>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </Card>
      </div>

      {isSuperAdmin ? (
        <div className="grid gap-6 xl:grid-cols-[0.45fr_0.55fr]">
          <Card className="space-y-4 p-6">
            <div>
              <h3 className="text-lg font-semibold text-[var(--ink-950)]">
                {editingPlanId ? "Edit plan" : "Create plan"}
              </h3>
              <p className="mt-1 text-sm text-[var(--ink-500)]">
                Superadmin-only plan administration. Manual grants never remove transaction commission.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Input placeholder="Code" value={planForm.code} onChange={(event) => setPlanForm((current) => ({ ...current, code: event.target.value }))} />
              <Input placeholder="Slug" value={planForm.slug} onChange={(event) => setPlanForm((current) => ({ ...current, slug: event.target.value }))} />
              <Input placeholder="Name" value={planForm.name} onChange={(event) => setPlanForm((current) => ({ ...current, name: event.target.value }))} />
              <Input placeholder="Price amount" value={planForm.priceAmount} onChange={(event) => setPlanForm((current) => ({ ...current, priceAmount: event.target.value }))} />
              <Input placeholder="Currency" value={planForm.currency} onChange={(event) => setPlanForm((current) => ({ ...current, currency: event.target.value.toUpperCase() }))} />
              <select
                className="h-11 rounded-2xl border border-[var(--line)] bg-white px-4 text-sm text-[var(--ink-700)]"
                value={planForm.interval}
                onChange={(event) =>
                  setPlanForm((current) => ({
                    ...current,
                    interval: event.target.value as "MONTHLY" | "ANNUAL",
                  }))
                }
              >
                <option value="MONTHLY">Monthly</option>
                <option value="ANNUAL">Annual</option>
              </select>
            </div>
            <Textarea
              placeholder="Description"
              value={planForm.description}
              onChange={(event) => setPlanForm((current) => ({ ...current, description: event.target.value }))}
            />
            <div className="flex flex-wrap gap-4 text-sm text-[var(--ink-700)]">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={planForm.isActive} onChange={(event) => setPlanForm((current) => ({ ...current, isActive: event.target.checked }))} />
                Active
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={planForm.isPublic} onChange={(event) => setPlanForm((current) => ({ ...current, isPublic: event.target.checked }))} />
                Public/selectable
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={planForm.canBeGranted} onChange={(event) => setPlanForm((current) => ({ ...current, canBeGranted: event.target.checked }))} />
                Can be granted
              </label>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button onClick={submitPlan} disabled={pending === "plan"}>
                {pending === "plan" ? "Saving..." : editingPlanId ? "Save plan" : "Create plan"}
              </Button>
              {editingPlanId ? (
                <Button variant="outline" onClick={() => syncFormFromPlan(null)}>
                  Cancel edit
                </Button>
              ) : null}
            </div>
          </Card>

          <Card className="space-y-4 p-6">
            <div>
              <h3 className="text-lg font-semibold text-[var(--ink-950)]">Company plan assignment</h3>
              <p className="mt-1 text-sm text-[var(--ink-500)]">
                Assign paid, trial, or manually granted access. Commission continues to apply to successful transaction payments.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <select
                className="h-11 rounded-2xl border border-[var(--line)] bg-white px-4 text-sm text-[var(--ink-700)]"
                value={assignment.companyId}
                onChange={(event) => setAssignment((current) => ({ ...current, companyId: event.target.value }))}
              >
                {companies.map((company) => (
                  <option key={company.companyId} value={company.companyId}>
                    {company.companyName}
                  </option>
                ))}
              </select>
              <select
                className="h-11 rounded-2xl border border-[var(--line)] bg-white px-4 text-sm text-[var(--ink-700)]"
                value={assignment.planId}
                onChange={(event) => setAssignment((current) => ({ ...current, planId: event.target.value }))}
              >
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name}  -  {plan.interval.toLowerCase()}
                  </option>
                ))}
              </select>
              <select
                className="h-11 rounded-2xl border border-[var(--line)] bg-white px-4 text-sm text-[var(--ink-700)]"
                value={assignment.status}
                onChange={(event) => setAssignment((current) => ({ ...current, status: event.target.value }))}
              >
                <option value="GRANTED">Granted</option>
                <option value="ACTIVE">Active paid</option>
                <option value="TRIAL">Trial</option>
              </select>
              <select
                className="h-11 rounded-2xl border border-[var(--line)] bg-white px-4 text-sm text-[var(--ink-700)]"
                value={assignment.interval}
                onChange={(event) =>
                  setAssignment((current) => ({
                    ...current,
                    interval: event.target.value as "MONTHLY" | "ANNUAL",
                  }))
                }
              >
                <option value="MONTHLY">Monthly</option>
                <option value="ANNUAL">Annual</option>
              </select>
            </div>
            <Input
              placeholder="Reason"
              value={assignment.reason}
              onChange={(event) => setAssignment((current) => ({ ...current, reason: event.target.value }))}
            />
            <Textarea
              placeholder="Notes"
              value={assignment.notes}
              onChange={(event) => setAssignment((current) => ({ ...current, notes: event.target.value }))}
            />
            <div className="flex gap-3">
              <Button onClick={submitAssignment} disabled={pending === "assignment"}>
                {pending === "assignment" ? "Saving..." : "Assign company plan"}
              </Button>
            </div>
          </Card>
        </div>
      ) : null}

      {isSuperAdmin ? (
        <Card className="space-y-4 p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-[var(--ink-950)]">Company billing overview</h3>
              <p className="mt-1 text-sm text-[var(--ink-500)]">
                Global billing visibility for subscriptions, commission rules, and payout readiness.
              </p>
            </div>
            <Badge>superadmin</Badge>
          </div>
          <Input
            placeholder="Revocation note (used when revoking a plan below)"
            value={revocationNotes}
            onChange={(event) => setRevocationNotes(event.target.value)}
          />
          <div className="space-y-3">
            {companies.map((company) => (
              <div
                key={company.companyId}
                className="grid gap-4 rounded-3xl border border-[var(--line)] bg-white p-4 lg:grid-cols-[1.2fr_1fr_1fr_auto]"
              >
                <div>
                  <div className="font-semibold text-[var(--ink-950)]">{company.companyName}</div>
                  <div className="mt-1 text-sm text-[var(--ink-500)]">{company.companySlug}</div>
                </div>
                <div className="text-sm text-[var(--ink-700)]">
                  <div>{company.planLabel}</div>
                  <div className="mt-1 text-[var(--ink-500)]">
                    {company.status}  -  expires {company.expiresAt}
                  </div>
                </div>
                <div className="text-sm text-[var(--ink-700)]">
                  <div>{company.commissionRule}</div>
                  <div className="mt-1 text-[var(--ink-500)]">{company.payoutReadiness}</div>
                </div>
                <div className="flex justify-end">
                  {company.subscriptionId ? (
                    <Button
                      variant="outline"
                      onClick={() => revokeSubscription(company.subscriptionId!)}
                      disabled={pending === company.subscriptionId}
                    >
                      {pending === company.subscriptionId ? "Revoking..." : "Revoke"}
                    </Button>
                  ) : (
                    <Badge>no plan</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-5">
      <div className="text-sm text-[var(--ink-500)]">{label}</div>
      <div className="mt-3 text-2xl font-semibold text-[var(--ink-950)]">{value}</div>
    </Card>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-[var(--line)] bg-white p-4">
      <div className="text-xs uppercase tracking-[0.18em] text-[var(--ink-400)]">{label}</div>
      <div className="mt-2 text-sm font-medium text-[var(--ink-900)]">{value}</div>
    </div>
  );
}
