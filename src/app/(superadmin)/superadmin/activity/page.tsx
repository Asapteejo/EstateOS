import { SuperadminActivityFeed } from "@/components/superadmin/superadmin-activity-feed";
import { StatCard } from "@/components/admin/admin-ui";
import { SuperadminRangeTabs } from "@/components/superadmin/superadmin-range-tabs";
import { SuperadminShell } from "@/components/superadmin/superadmin-shell";
import { requireSuperAdminSession } from "@/lib/auth/guards";
import { getSuperadminActivityData, parseSuperadminRange, readSuperadminSearchParam } from "@/modules/superadmin/queries";

export default async function SuperadminActivityPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSuperAdminSession();

  const resolvedSearchParams = (await searchParams) ?? {};
  const range = parseSuperadminRange(readSuperadminSearchParam(resolvedSearchParams.range));
  const activity = await getSuperadminActivityData(range);

  return (
    <SuperadminShell
      title="Live activity center"
      subtitle="Watch platform inflow, onboarding, requests, collections, and risk alerts in one running feed."
      actions={<SuperadminRangeTabs pathname="/superadmin/activity" current={range} />}
    >
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Payments" value={String(activity.counts.payments)} hint="Successful payment events in the current feed" tone="success" />
        <StatCard label="Payment requests" value={String(activity.counts.paymentRequests)} hint="Recently issued payment requests" />
        <StatCard label="Onboarding" value={String(activity.counts.onboarding)} hint="New companies and activation milestones" />
        <StatCard label="Risk alerts" value={String(activity.counts.risk)} hint="Overdue, webhook, and job issues" tone="danger" />
      </div>

      <SuperadminActivityFeed
        title="Recent platform activity"
        subtitle={`Last updated ${activity.generatedAtLabel}. This feed is near-live and intentionally weighted toward money movement and operational risk.`}
        items={activity.items}
      />
    </SuperadminShell>
  );
}
