import { DashboardShell } from "@/components/portal/dashboard-shell";
import { requireAdminSession } from "@/lib/auth/guards";
import { rolesForAdminPath } from "@/lib/auth/admin-sections";
import { InvoiceCreateForm } from "@/components/admin/invoice-create-form";
import { InvoiceList } from "@/components/admin/invoice-list";
import { listInvoicesForAdmin } from "@/modules/invoices/service";

export const dynamic = "force-dynamic";

export default async function AdminInvoicesPage() {
  const tenant = await requireAdminSession(rolesForAdminPath("/admin/invoices"));
  const invoices = await listInvoicesForAdmin(tenant);

  return (
    <DashboardShell
      area="admin"
      title="Invoices"
      subtitle="Issue property invoices buyers can download or print — branded with your company details."
    >
      <div className="space-y-6">
        <InvoiceCreateForm />
        <InvoiceList invoices={invoices} emptyMessage="No invoices issued yet. Create one above." />
      </div>
    </DashboardShell>
  );
}
