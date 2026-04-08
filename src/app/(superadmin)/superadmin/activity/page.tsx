import { SuperadminActivityFeed } from "@/components/superadmin/superadmin-activity-feed";
import { SuperadminMetricCard } from "@/components/superadmin/superadmin-metric-card";
import { SuperadminRangeTabs } from "@/components/superadmin/superadmin-range-tabs";
import { SuperadminShell } from "@/components/superadmin/superadmin-shell";
import { requireSuperAdminSession } from "@/lib/auth/guards";
import { getSuperadminActivityData, parseSuperadminRange } from "@/modules/superadmin/queries";

export default async function SuperadminActivityPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSuperAdminSession();

  const resolvedSearchParams = ((await searchParams) ?? {}) as Record<string, string | undefined>;
  const range = parseSuperadminRange(resolvedSearchParams.range);
  const activity = await getSuperadminActivityData(range);

  return (
    <SuperadminShell
      title="Live activity center"
      subtitle="Watch platform inflow, onboarding, requests, collections, and risk alerts in one running feed."
      actions={<SuperadminRangeTabs pathname="/superadmin/activity" current={range} />}
    >
      <div className="grid gap-6 md:grid-cols-4">
        <SuperadminMetricCard label="Payments" value={String(activity.counts.payments)} detail="Successful payment events in the current feed" tone="revenue" />
        <SuperadminMetricCard label="Payment requests" value={String(activity.counts.paymentRequests)} detail="Recently issued payment requests" />
        <SuperadminMetricCard label="Onboarding" value={String(activity.counts.onboarding)} detail="New companies and activation milestones" />
        <SuperadminMetricCard label="Risk alerts" value={String(activity.counts.risk)} detail="Overdue, webhook, and job issues" tone="risk" />
      </div>

      <SuperadminActivityFeed
        title="Recent platform activity"
        subtitle={`Last updated ${activity.generatedAtLabel}. This feed is near-live and intentionally weighted toward money movement and operational risk.`}
        items={activity.items}
      />
    </SuperadminShell>
  );
}
