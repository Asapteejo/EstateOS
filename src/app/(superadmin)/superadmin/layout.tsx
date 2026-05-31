import { requireSuperAdminSession } from "@/lib/auth/guards";

export default async function SuperadminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSuperAdminSession();
  return children;
}
