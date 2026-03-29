import { DashboardShell } from "@/components/portal/dashboard-shell";
import { Timeline } from "@/components/shared/timeline";
import { Card } from "@/components/ui/card";
import { requirePortalSession } from "@/lib/auth/guards";
import { formatCurrency } from "@/lib/utils";
import { getBuyerDashboardSummary } from "@/modules/portal/queries";

export default async function PortalDashboardPage() {
  const tenant = await requirePortalSession();
  const summary = await getBuyerDashboardSummary(tenant);

  return (
    <DashboardShell
      area="portal"
      title="Buyer Portal"
      subtitle="A calm workspace for profile completion, reservations, payments, documents, and transaction updates."
    >
      <div className="grid gap-6 md:grid-cols-4">
        {[
          ["Profile completion", `${summary.overview.completion}%`],
          ["Outstanding balance", formatCurrency(summary.overview.outstandingBalance)],
          ["Next payment due", summary.overview.nextPaymentDue],
          ["Unread updates", String(summary.overview.notificationsUnread)],
        ].map(([label, value]) => (
          <Card key={label} className="p-6">
            <div className="text-sm text-[var(--ink-500)]">{label}</div>
            <div className="mt-3 text-2xl font-semibold text-[var(--ink-950)]">{value}</div>
          </Card>
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
    </DashboardShell>
  );
}
