import { AuthProviders } from "@/components/providers/auth-providers";

export default function AppSurfaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthProviders>{children}</AuthProviders>;
}
