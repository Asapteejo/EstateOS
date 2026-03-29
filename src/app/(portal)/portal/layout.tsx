import { requirePortalSession } from "@/lib/auth/guards";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePortalSession();
  return children;
}
