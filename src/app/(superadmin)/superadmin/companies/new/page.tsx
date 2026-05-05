import Link from "next/link";

import { SuperadminShell } from "@/components/superadmin/superadmin-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireSuperAdminSession } from "@/lib/auth/guards";
import { featureFlags } from "@/lib/env";
import {
  createMockCompanyAction,
  createSuperadminCompanyAction,
} from "@/app/(superadmin)/superadmin/companies/actions";

export default async function NewSuperadminCompanyPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSuperAdminSession();

  const resolvedSearchParams = ((await searchParams) ?? {}) as Record<string, string | undefined>;
  const error = resolvedSearchParams.error;

  return (
    <SuperadminShell
      title="Manual company onboarding"
      subtitle="Create a tenant workspace safely, assign an owner admin, and grant a plan without requiring Paystack or R2 for manual/test access."
      actions={
        <div className="flex flex-wrap gap-2">
          {!featureFlags.isProduction ? (
            <form action={createMockCompanyAction}>
              <Button type="submit" variant="outline">Create mock company</Button>
            </form>
          ) : null}
          <Link
            href="/superadmin/companies"
            className="inline-flex h-11 items-center justify-center rounded-full border border-[var(--line)] px-5 text-sm font-semibold text-[var(--ink-900)] transition hover:bg-[var(--sand-100)]"
          >
            Back to companies
          </Link>
        </div>
      }
    >
      {error ? (
        <Card className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          {error}
        </Card>
      ) : null}

      <form action={createSuperadminCompanyAction} className="grid gap-6 xl:grid-cols-[1fr_0.85fr]">
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-[var(--ink-950)]">Company profile</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm">
              <span className="font-medium text-[var(--ink-700)]">Company name</span>
              <input name="companyName" required className="w-full rounded-xl border border-[var(--line)] px-3 py-2" placeholder="Acme Realty" />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-[var(--ink-700)]">Slug</span>
              <input name="slug" required pattern="[a-z0-9-]+" className="w-full rounded-xl border border-[var(--line)] px-3 py-2" placeholder="acme-realty" />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-[var(--ink-700)]">Contact email</span>
              <input name="contactEmail" required type="email" className="w-full rounded-xl border border-[var(--line)] px-3 py-2" placeholder="ops@acme.test" />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-[var(--ink-700)]">Contact phone</span>
              <input name="contactPhone" className="w-full rounded-xl border border-[var(--line)] px-3 py-2" placeholder="+234..." />
            </label>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold text-[var(--ink-950)]">Owner admin</h2>
          <div className="mt-5 grid gap-4">
            <label className="space-y-2 text-sm">
              <span className="font-medium text-[var(--ink-700)]">First name</span>
              <input name="ownerFirstName" required className="w-full rounded-xl border border-[var(--line)] px-3 py-2" placeholder="Tobi" />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-[var(--ink-700)]">Last name</span>
              <input name="ownerLastName" required className="w-full rounded-xl border border-[var(--line)] px-3 py-2" placeholder="Adewale" />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-[var(--ink-700)]">Owner email</span>
              <input name="ownerEmail" required type="email" className="w-full rounded-xl border border-[var(--line)] px-3 py-2" placeholder="owner@acme.test" />
            </label>
          </div>
        </Card>

        <Card className="p-6 xl:col-span-2">
          <h2 className="text-lg font-semibold text-[var(--ink-950)]">Access and subscription</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-4">
            <label className="space-y-2 text-sm">
              <span className="font-medium text-[var(--ink-700)]">Plan</span>
              <select name="plan" defaultValue="PRO" className="w-full rounded-xl border border-[var(--line)] px-3 py-2">
                <option value="FREE">Free</option>
                <option value="PRO">Pro</option>
                <option value="PREMIUM">Premium</option>
              </select>
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-[var(--ink-700)]">Billing mode</span>
              <select name="billingMode" defaultValue="MANUAL_OVERRIDE" className="w-full rounded-xl border border-[var(--line)] px-3 py-2">
                <option value="MANUAL_OVERRIDE">Manual override</option>
                <option value="TRIAL">Trial</option>
                <option value="PAID">Paid</option>
              </select>
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-[var(--ink-700)]">Access status</span>
              <select name="accessStatus" defaultValue="ACTIVE" className="w-full rounded-xl border border-[var(--line)] px-3 py-2">
                <option value="ACTIVE">Active</option>
                <option value="SUSPENDED">Suspended</option>
              </select>
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-[var(--ink-700)]">Expiry date</span>
              <input name="subscriptionEndsAt" type="date" className="w-full rounded-xl border border-[var(--line)] px-3 py-2" />
            </label>
          </div>
          <label className="mt-4 block space-y-2 text-sm">
            <span className="font-medium text-[var(--ink-700)]">Internal note/reason</span>
            <textarea name="internalNote" rows={4} className="w-full rounded-xl border border-[var(--line)] px-3 py-2" placeholder="Why this override is being created." />
          </label>
          <div className="mt-5 flex justify-end">
            <Button type="submit">Create company</Button>
          </div>
        </Card>
      </form>
    </SuperadminShell>
  );
}
