import { AuthProviders } from "@/components/providers/auth-providers";
import { featureFlags } from "@/lib/env";

export default function AppSurfaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthProviders disableClerkForDev={featureFlags.allowDevBypass}>{children}</AuthProviders>;
}
