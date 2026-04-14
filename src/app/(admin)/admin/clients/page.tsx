import Link from "next/link";

import { AdminEmptyState, AdminMetricCard, AdminMetricGrid, AdminPanel, AdminToolbar } from "@/components/admin/admin-ui";
import { DashboardShell } from "@/components/portal/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireAdminSession } from "@/lib/auth/guards";
import { getAdminClientList } from "@/modules/clients/queries";

export default async function AdminClientsPage() {
  const tenant = await requireAdminSession(["ADMIN"]);
  const clients = await getAdminClientList(tenant);

  const kycReadyCount = clients.filter((client) =>
    ["APPROVED", "VERIFIED", "COMPLETED"].includes(client.kycStatus),
  ).length;
  const activeDealCount = clients.filter((client) => client.currentStage !== "No active deal").length;
  const totalPayments = clients.reduce((sum, client) => sum + client.paymentCount, 0);

  return (
    <DashboardShell
      area="admin"
      title="Clients"
      subtitle="Track buyer intent, wishlist activity, KYC state, and payment progress from one tenant-safe client view."
    >
      <AdminToolbar>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-400)]">
            Client register
          </div>
          <p className="mt-1 text-sm leading-6 text-[var(--ink-500)]">
            Keep KYC, reservations, and payment progress aligned in one operational view.
          </p>
        </div>
        <a href="/api/admin/exports/clients">
          <Button variant="outline">Export clients CSV</Button>
        </a>
      </AdminToolbar>

      <AdminMetricGrid>
        <AdminMetricCard
          label="Tracked clients"
          value={clients.length}
          hint="Buyer records currently available in this workspace."
        />
        <AdminMetricCard
          label="KYC ready"
          value={kycReadyCount}
          hint="Clients whose KYC has reached a completed or approved state."
        />
        <AdminMetricCard
          label="Active deals"
          value={activeDealCount}
          hint="Clients currently attached to a live transaction stage."
        />
        <AdminMetricCard
          label="Successful payments"
          value={totalPayments}
          hint="Recorded payment events across the current client set."
        />
      </AdminMetricGrid>

      {clients.length > 0 ? (
        <div className="grid gap-5 lg:grid-cols-2">
          {clients.map((client) => (
            <AdminPanel key={client.id}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold tracking-[-0.02em] text-[var(--ink-950)]">{client.name}</h2>
                  <p className="mt-1 truncate text-sm text-[var(--ink-500)]">{client.email}</p>
                  {client.phone ? <p className="mt-1 text-sm text-[var(--ink-500)]">{client.phone}</p> : null}
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <Badge>{client.kycStatus}</Badge>
                  <Badge>{client.currentStage}</Badge>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[18px] border border-[var(--line)] bg-[var(--sand-50)] px-4 py-3.5">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-400)]">Wishlist items</div>
                  <div className="mt-2 text-xl font-semibold text-[var(--ink-950)]">{client.wishlistCount}</div>
                </div>
                <div className="rounded-[18px] border border-[var(--line)] bg-[var(--sand-50)] px-4 py-3.5">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-400)]">Reservations</div>
                  <div className="mt-2 text-xl font-semibold text-[var(--ink-950)]">{client.reservationCount}</div>
                </div>
                <div className="rounded-[18px] border border-[var(--line)] bg-white px-4 py-3.5">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-400)]">Payments</div>
                  <div className="mt-2 text-xl font-semibold text-[var(--ink-950)]">{client.paymentCount}</div>
                </div>
                <div className="rounded-[18px] border border-[var(--line)] bg-white px-4 py-3.5">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-400)]">Outstanding balance</div>
                  <div className="mt-2 text-xl font-semibold text-[var(--ink-950)]">{client.outstandingBalance}</div>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-[var(--ink-500)]">Latest activity: {client.lastActivityAt}</div>
                <Link href={client.href}>
                  <Button>Open client profile</Button>
                </Link>
              </div>
            </AdminPanel>
          ))}
        </div>
      ) : (
        <AdminEmptyState
          title="No registered clients yet"
          description="Buyer records will appear here once prospects create accounts, save listings, or begin KYC."
        />
      )}
    </DashboardShell>
  );
}
