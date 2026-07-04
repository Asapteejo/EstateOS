import { DashboardShell } from "@/components/portal/dashboard-shell";
import { BillingManagement } from "@/components/admin/billing-management";
import { requireAdminSession } from "@/lib/auth/guards";
import { rolesForAdminPath } from "@/lib/auth/admin-sections";
import { getBillingDashboardData } from "@/modules/billing/service";

export default async function AdminBillingPage() {
  const tenant = await requireAdminSession(rolesForAdminPath("/admin/billing"));
  const billing = await getBillingDashboardData(tenant);

  return (
    <DashboardShell
      area="admin"
      title="Billing & Monetization"
      subtitle={
        tenant.isSuperAdmin
          ? "Plans, grants, commission behavior, payout readiness, and platform revenue visibility."
          : "Plan status, payout readiness, and billing access for this company."
      }
    >
      <BillingManagement
        isSuperAdmin={tenant.isSuperAdmin}
        companyPlanStatus={billing.companyPlanStatus}
        companyBilling={billing.companyBilling}
        companySummary={billing.companySummary}
        plans={billing.plans}
        companies={billing.companies}
      />
    </DashboardShell>
  );
}
