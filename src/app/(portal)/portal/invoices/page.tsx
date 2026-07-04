import { DashboardShell } from "@/components/portal/dashboard-shell";
import { requirePortalSession } from "@/lib/auth/guards";
import { InvoiceList } from "@/components/admin/invoice-list";
import { listInvoicesForBuyer } from "@/modules/invoices/service";

export const dynamic = "force-dynamic";

export default async function PortalInvoicesPage() {
  const tenant = await requirePortalSession();
  const invoices = await listInvoicesForBuyer({
    companyId: tenant.companyId,
    userId: tenant.userId,
    email: tenant.email,
  });

  return (
    <DashboardShell
      area="portal"
      title="Invoices"
      subtitle="Download or print invoices for your property purchases."
    >
      <InvoiceList
        invoices={invoices}
        showBuyer={false}
        emptyMessage="You have no invoices yet. They'll appear here once your agent issues one."
      />
    </DashboardShell>
  );
}
