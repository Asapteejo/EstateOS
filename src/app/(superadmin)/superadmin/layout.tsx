import { requireSuperAdminSession } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export default async function SuperadminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSuperAdminSession();
  return children;
}
