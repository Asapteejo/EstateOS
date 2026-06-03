import { requireSuperAdminSession } from "@/lib/auth/guards";
import { AuthProviders } from "@/components/providers/auth-providers";
import { PaystackComplianceBanner } from "@/components/superadmin/paystack-compliance-banner";

export const dynamic = "force-dynamic";

export default async function SuperadminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSuperAdminSession();
  return (
    <AuthProviders>
      <PaystackComplianceBanner />
      {children}
    </AuthProviders>
  );
}
