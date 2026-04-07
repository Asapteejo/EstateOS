import { redirect } from "next/navigation";

import { OnboardingForm } from "@/components/app/onboarding-form";
import { Container } from "@/components/shared/container";
import { getAppSession } from "@/lib/auth/session";
import { buildAuthRedirect, buildServerDomainConfig } from "@/lib/domains";
import { env, featureFlags } from "@/lib/env";
import { resolveAppLandingPath } from "@/modules/onboarding/navigation";

export default async function AppOnboardingPage() {
  const session = await getAppSession("admin");

  if (!session?.userId) {
    redirect(
      buildAuthRedirect(buildServerDomainConfig(env), {
        returnTo: "/app/onboarding",
        entry: "admin",
      }),
    );
  }

  if (resolveAppLandingPath(session) !== "/app/onboarding") {
    redirect(resolveAppLandingPath(session));
  }

  return (
    <Container className="py-10 sm:py-16">
      <OnboardingForm
        defaults={{
          firstName: session.firstName,
          lastName: session.lastName,
          email: session.email,
        }}
        showDevShortcut={featureFlags.allowDevBypass}
      />
    </Container>
  );
}
