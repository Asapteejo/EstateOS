import {
  AdminMetricCard,
  AdminMetricGrid,
  AdminPanel,
  AdminSkeletonBlock,
} from "@/components/admin/admin-ui";

// Skeleton placeholder shown while the Analytics page streams in. Mirrors the
// page shape (header → metric cards → chart panels). Chart areas are tall
// skeleton blocks so the layout height stays stable while data loads. Uses
// existing admin-ui primitives; no data fetching or logic here.
export default function AnalyticsLoading() {
  return (
    <div className="app-dark-scope space-y-6" aria-busy="true" aria-label="Loading analytics">
      <div className="border-b border-[var(--line)] pb-5 sm:pb-6">
        <div className="admin-skeleton h-3 w-28" />
        <div className="admin-skeleton mt-3 h-10 w-72 max-w-full" />
        <div className="admin-skeleton mt-3 h-4 w-[32rem] max-w-full" />
      </div>

      <AdminMetricGrid>
        <AdminMetricCard label="Loading" value="--" hint="Fetching analytics..." />
        <AdminMetricCard label="Loading" value="--" hint="Fetching analytics..." />
        <AdminMetricCard label="Loading" value="--" hint="Fetching analytics..." />
        <AdminMetricCard label="Loading" value="--" hint="Fetching analytics..." />
      </AdminMetricGrid>

      <div className="grid gap-6 xl:grid-cols-2">
        <AdminPanel title="Performance" description="Loading chart...">
          <AdminSkeletonBlock className="h-64 w-full" />
        </AdminPanel>
        <AdminPanel title="Breakdown" description="Loading chart...">
          <AdminSkeletonBlock className="h-64 w-full" />
        </AdminPanel>
      </div>

      <AdminPanel title="Details" description="Loading...">
        <div className="space-y-3">
          {Array.from({ length: 5 }, (_, index) => (
            <AdminSkeletonBlock key={index} className="h-10 w-full" />
          ))}
        </div>
      </AdminPanel>
    </div>
  );
}
