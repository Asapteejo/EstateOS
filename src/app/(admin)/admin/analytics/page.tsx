import { DashboardShell } from "@/components/portal/dashboard-shell";
import { Card } from "@/components/ui/card";
import { requireAdminSession } from "@/lib/auth/guards";
import { getDealBoardAnalyticsReport } from "@/modules/admin/deal-board";

export default async function AdminAnalyticsPage() {
  const tenant = await requireAdminSession();
  const analytics = await getDealBoardAnalyticsReport(tenant);

  return (
    <DashboardShell
      area="admin"
      title="Funnel & Revenue Analytics"
      subtitle="A focused view of how leads become reservations, how reservations become cash, and where collections are slipping."
    >
      <div className="grid gap-6 md:grid-cols-3">
        {analytics.metrics.map((metric) => (
          <Card key={metric.label} className="p-6">
            <h3 className="text-sm uppercase tracking-[0.16em] text-[var(--ink-500)]">{metric.label}</h3>
            <div className="mt-4 text-3xl font-semibold text-[var(--ink-950)]">{metric.value}</div>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-600)]">{metric.detail}</p>
          </Card>
        ))}
      </div>

      <Card className="rounded-[30px] border-[var(--line)] bg-white p-6">
        <h2 className="text-lg font-semibold text-[var(--ink-950)]">Recent funnel events</h2>
        <p className="mt-2 text-sm leading-7 text-[var(--ink-600)]">
          Use this feed to prove activation, spot collections risk, and show pilot customers what the system captures.
        </p>
        <div className="mt-5 grid gap-3">
          {analytics.recentEvents.length > 0 ? (
            analytics.recentEvents.map((event) => (
              <div key={event.id} className="rounded-[22px] border border-[var(--line)] bg-[var(--sand-50)] p-4">
                <div className="text-sm font-semibold text-[var(--ink-950)]">{event.title}</div>
                <div className="mt-1 text-sm leading-6 text-[var(--ink-600)]">{event.detail}</div>
                <div className="mt-3 text-xs uppercase tracking-[0.16em] text-[var(--ink-500)]">{event.createdAt}</div>
              </div>
            ))
          ) : (
            <div className="rounded-[22px] border border-dashed border-[var(--line)] p-4 text-sm text-[var(--ink-500)]">
              Funnel events appear here as your team creates leads, sends requests, and closes payments.
            </div>
          )}
        </div>
      </Card>
    </DashboardShell>
  );
}
