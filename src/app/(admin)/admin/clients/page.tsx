import Link from "next/link";

import { DashboardShell } from "@/components/portal/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireAdminSession } from "@/lib/auth/guards";
import { getAdminClientList } from "@/modules/clients/queries";

export default async function AdminClientsPage() {
  const tenant = await requireAdminSession(["ADMIN"]);
  const clients = await getAdminClientList(tenant);

  return (
    <DashboardShell
      area="admin"
      title="Clients"
      subtitle="Track buyer intent, wishlist activity, KYC state, and payment progress from one tenant-safe client view."
    >
      <div className="flex justify-end">
        <a href="/api/admin/exports/clients">
          <Button variant="outline">Export clients CSV</Button>
        </a>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {clients.map((client) => (
          <Card key={client.id} className="rounded-[30px] border-[var(--line)] bg-white p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-[var(--ink-950)]">{client.name}</h2>
                <p className="mt-1 text-sm text-[var(--ink-500)]">{client.email}</p>
                {client.phone ? <p className="mt-1 text-sm text-[var(--ink-500)]">{client.phone}</p> : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge>{client.kycStatus}</Badge>
                <Badge>{client.currentStage}</Badge>
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl bg-[var(--sand-100)] p-4">
                <div className="text-sm text-[var(--ink-500)]">Wishlist items</div>
                <div className="mt-2 text-lg font-semibold text-[var(--ink-950)]">{client.wishlistCount}</div>
              </div>
              <div className="rounded-3xl bg-[var(--sand-100)] p-4">
                <div className="text-sm text-[var(--ink-500)]">Reservations</div>
                <div className="mt-2 text-lg font-semibold text-[var(--ink-950)]">{client.reservationCount}</div>
              </div>
              <div className="rounded-3xl bg-[var(--sand-100)] p-4">
                <div className="text-sm text-[var(--ink-500)]">Payments</div>
                <div className="mt-2 text-lg font-semibold text-[var(--ink-950)]">{client.paymentCount}</div>
              </div>
              <div className="rounded-3xl bg-[var(--sand-100)] p-4">
                <div className="text-sm text-[var(--ink-500)]">Outstanding balance</div>
                <div className="mt-2 text-lg font-semibold text-[var(--ink-950)]">{client.outstandingBalance}</div>
              </div>
            </div>

            <div className="mt-4 text-sm text-[var(--ink-500)]">
              Latest activity: {client.lastActivityAt}
            </div>

            <div className="mt-5">
              <Link href={client.href}>
                <Button>Open client profile</Button>
              </Link>
            </div>
          </Card>
        ))}
      </div>
      {clients.length === 0 ? (
        <Card className="rounded-[30px] border border-dashed border-[var(--line)] px-6 py-14 text-center text-sm text-[var(--ink-500)]">
          No registered clients yet for this tenant.
        </Card>
      ) : null}
    </DashboardShell>
  );
}
