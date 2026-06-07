import { DashboardShell } from "@/components/portal/dashboard-shell";
import { Timeline } from "@/components/shared/timeline";
import { StatCard } from "@/components/admin/admin-ui";
import { Card } from "@/components/ui/card";
import { requirePortalSession } from "@/lib/auth/guards";
import { formatCurrency } from "@/lib/utils";
import { getBuyerDashboardSummary, getBuyerPaymentExperience } from "@/modules/portal/queries";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { QuickInquiryForm } from "@/components/portal/quick-inquiry-form";
import { getTenantPresentation } from "@/modules/branding/service";
import { getAppSession } from "@/lib/auth/session";
import { getBuyerProfileRecord } from "@/modules/kyc/service";
import { shouldRedirectBuyerToProfileSetup } from "@/modules/portal/profile-access";
import { redirect } from "next/navigation";

export default async function PortalDashboardPage() {
  const tenant = await requirePortalSession();
  const session = await getAppSession("portal");
  const profile = tenant.roles.includes("BUYER")
    ? await getBuyerProfileRecord(tenant, { email: session?.email })
    : null;
  if (
    shouldRedirectBuyerToProfileSetup({
      roles: tenant.roles,
      profileExists: Boolean(profile),
    })
  ) {
    redirect("/portal/profile?setup=1");
  }
  const [summary, paymentExperience] = await Promise.all([
    getBuyerDashboardSummary(tenant),
    getBuyerPaymentExperience(tenant),
  ]);
  const presentation = await getTenantPresentation(tenant);

  return (
    <DashboardShell
      area="portal"
      title="Buyer Portal"
      subtitle="A calm workspace for profile completion, reservations, payments, documents, and transaction updates."
    >
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {[
          ["Profile completion", `${summary.overview.completion}%`],
          ["Outstanding balance", formatCurrency(summary.overview.outstandingBalance)],
          ["Next payment due", summary.overview.nextPaymentDue],
          ["Payment state", paymentExperience.paymentStatus],
          ["Unread updates", String(summary.overview.notificationsUnread)],
        ].map(([label, value]) => (
          <StatCard key={label} label={label} value={value} />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="p-8">
          <h2 className="text-2xl font-semibold text-[var(--ink-950)]">Transaction timeline</h2>
          <div className="mt-6">
            <Timeline items={summary.timeline} />
          </div>
        </Card>
        <Card className="space-y-4 p-8">
          <h2 className="text-2xl font-semibold text-[var(--ink-950)]">Recent notifications</h2>
          {summary.notifications.map((notification) => (
            <div key={notification.title} className="rounded-3xl bg-[var(--sand-100)] p-5">
              <div className="text-sm font-semibold text-[var(--ink-950)]">{notification.title}</div>
              <p className="mt-2 text-sm leading-6 text-[var(--ink-600)]">{notification.body}</p>
              <div className="mt-2 text-xs uppercase tracking-[0.16em] text-[var(--ink-500)]">
                {notification.time}
              </div>
            </div>
          ))}
        </Card>
      </div>
      <Card className="p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-[var(--ink-950)]">Payment transparency</h2>
            <p className="mt-2 text-sm leading-7 text-[var(--ink-600)]">
              Progress is rendered from the latest persisted transaction, installment, and payment records.
            </p>
          </div>
          {paymentExperience.receipts[0] ? (
            <Link href={paymentExperience.receipts[0].downloadHref}>
              <Button variant="outline">Open latest receipt</Button>
            </Link>
          ) : null}
        </div>
        <div className="mt-6 h-3 rounded-full bg-[var(--sand-100)]">
          <div
            className="h-3 rounded-full bg-[var(--brand-700)]"
            style={{ width: `${paymentExperience.progress.progressPercent}%` }}
          />
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <StatCard label="Total payable" value={formatCurrency(paymentExperience.progress.totalPayableAmount)} />
          <StatCard label="Paid so far" value={formatCurrency(paymentExperience.progress.amountPaidSoFar)} />
          <StatCard label="Outstanding" value={formatCurrency(paymentExperience.progress.outstandingBalance)} />
          <StatCard label="Selected plan" value={paymentExperience.selectedPaymentPlan ?? "Unselected"} />
        </div>
      </Card>
      <Card className="p-8">
        <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <h2 className="text-2xl font-semibold text-[var(--ink-950)]">Need more information?</h2>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-600)]">
              Need help choosing a property, confirming availability, or asking about payment steps?
              Send a quick inquiry to {presentation.companyName}. Their sales team will receive it
              in their inquiry queue, and replies or updates will appear in your portal notifications.
            </p>
          </div>
          <QuickInquiryForm />
        </div>
      </Card>
    </DashboardShell>
  );
}
