import { redirect } from "next/navigation";

import { getAppSession } from "@/lib/auth/session";
import { buildAuthRedirect, buildServerDomainConfig } from "@/lib/domains";
import { env } from "@/lib/env";
import { resolveAppLandingPath } from "@/modules/onboarding/navigation";

export default async function AppDashboardPage() {
  const session = await getAppSession("admin");

  if (!session?.userId) {
    redirect(
      buildAuthRedirect(buildServerDomainConfig(env), {
        returnTo: "/app/dashboard",
        entry: "admin",
      }),
    );
  }

  redirect(resolveAppLandingPath(session));
}
