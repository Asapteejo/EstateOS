import { Card } from "@/components/ui/card";
import {
  AdminMetricCard,
  AdminMetricGrid,
  AdminSkeletonBlock,
  AdminToolbar,
} from "@/components/admin/admin-ui";

// Skeleton placeholder shown while the Listings page streams in. Mirrors the
// page shape (header → toolbar → metric cards → a grid of listing cards). Uses
// existing admin-ui primitives and the shared Card; no data fetching or logic.
export default function ListingsLoading() {
  return (
    <div className="app-dark-scope space-y-6" aria-busy="true" aria-label="Loading listings">
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
        <AdminMetricCard label="Loading" value="--" hint="Fetching listings..." />
        <AdminMetricCard label="Loading" value="--" hint="Fetching listings..." />
        <AdminMetricCard label="Loading" value="--" hint="Fetching listings..." />
        <AdminMetricCard label="Loading" value="--" hint="Fetching listings..." />
      </AdminMetricGrid>

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <Card key={index} className="admin-surface overflow-hidden">
            <AdminSkeletonBlock className="h-40 w-full rounded-none" />
            <div className="space-y-3 px-5 py-5">
              <AdminSkeletonBlock className="h-5 w-3/4" />
              <AdminSkeletonBlock className="h-4 w-1/2" />
              <AdminSkeletonBlock className="h-9 w-full" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
