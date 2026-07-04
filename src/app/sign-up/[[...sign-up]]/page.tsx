import { SignUp } from "@clerk/nextjs";

import { AuthProviders } from "@/components/providers/auth-providers";
import { Container } from "@/components/shared/container";
import { Card } from "@/components/ui/card";
import { featureFlags } from "@/lib/env";

export default function SignUpPage() {
  return (
    <AuthProviders disableClerkForDev={featureFlags.allowDevBypass}>
    <Container className="flex min-h-[70vh] items-center justify-center py-16">
      {featureFlags.hasClerk && !featureFlags.allowDevBypass ? (
        <SignUp />
      ) : (
        <Card className="max-w-xl p-8 text-center text-sm leading-7 text-[var(--ink-600)]">
          Clerk is not configured in this environment. Add keys to enable production auth flows.
        </Card>
      )}
    </Container>
    </AuthProviders>
  );
}
