import { SignUp } from "@clerk/nextjs";

import { Container } from "@/components/shared/container";
import { Card } from "@/components/ui/card";

export default function SignUpPage() {
  const hasClerk = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
  return (
    <Container className="flex min-h-[70vh] items-center justify-center py-16">
      {hasClerk ? (
        <SignUp />
      ) : (
        <Card className="max-w-xl p-8 text-center text-sm leading-7 text-[var(--ink-600)]">
          Clerk is not configured in this environment. Add keys to enable production auth flows.
        </Card>
      )}
    </Container>
  );
}
