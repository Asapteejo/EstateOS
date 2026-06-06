import {
  AdminMetricCard,
  AdminMetricGrid,
  AdminPanel,
  AdminSkeletonBlock,
  AdminToolbar,
} from "@/components/admin/admin-ui";

// Skeleton placeholder shown while the Payments page streams in. Mirrors the
// page shape (header → toolbar → metric cards → payments table). Uses existing
// admin-ui primitives; no data fetching or logic here.
export default function PaymentsLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading payments">
      <div className="border-b border-[var(--line)] pb-5 sm:pb-6">
        <div className="admin-skeleton h-3 w-28" />
        <div className="admin-skeleton mt-3 h-10 w-72 max-w-full" />
        <div className="admin-skeleton mt-3 h-4 w-[32rem] max-w-full" />
      </div>

      <AdminToolbar>
        <div className="flex-1 space-y-3">
          <div className="admin-skeleton h-4 w-28" />
          <div className="admin-skeleton h-4 w-80 max-w-full" />
        </div>
        <div className="admin-skeleton h-11 w-36" />
      </AdminToolbar>

      <AdminMetricGrid>
        <AdminMetricCard label="Loading" value="--" hint="Fetching payments..." />
        <AdminMetricCard label="Loading" value="--" hint="Fetching payments..." />
        <AdminMetricCard label="Loading" value="--" hint="Fetching payments..." />
        <AdminMetricCard label="Loading" value="--" hint="Fetching payments..." />
      </AdminMetricGrid>

      <AdminPanel title="Payments" description="Loading records...">
        <div className="space-y-3">
          <AdminSkeletonBlock className="h-9 w-full" />
          {Array.from({ length: 8 }, (_, index) => (
            <AdminSkeletonBlock key={index} className="h-12 w-full" />
          ))}
        </div>
      </AdminPanel>
    </div>
  );
}
