import { AdminMetricGrid, AdminMetricCard, AdminPanelSkeleton, AdminToolbar } from "@/components/admin/admin-ui";

export default function AdminLoading() {
  return (
    <div className="space-y-6">
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
        <AdminMetricCard label="Loading" value="--" hint="Fetching metrics..." />
        <AdminMetricCard label="Loading" value="--" hint="Fetching metrics..." />
        <AdminMetricCard label="Loading" value="--" hint="Fetching metrics..." />
        <AdminMetricCard label="Loading" value="--" hint="Fetching metrics..." />
      </AdminMetricGrid>

      <div className="grid gap-6 xl:grid-cols-2">
        <AdminPanelSkeleton lines={4} />
        <AdminPanelSkeleton lines={4} />
      </div>
    </div>
  );
}
