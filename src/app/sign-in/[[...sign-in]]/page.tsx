import Link from "next/link";
import { SignIn } from "@clerk/nextjs";

import { Container } from "@/components/shared/container";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function SignInPage() {
  const hasClerk = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
  return (
    <Container className="flex min-h-[70vh] items-center justify-center py-16">
      {hasClerk ? (
        <SignIn />
      ) : (
        <Card className="max-w-xl p-8 text-center">
          <h1 className="font-serif text-4xl text-[var(--ink-950)]">Clerk not configured</h1>
          <p className="mt-4 text-sm leading-7 text-[var(--ink-600)]">
            Local demo mode is active. Add Clerk keys in `.env.local` to enable real signup and login.
          </p>
          <div className="mt-6 flex justify-center gap-4">
            <Link href="/portal">
              <Button>Open buyer demo</Button>
            </Link>
            <Link href="/admin">
              <Button variant="outline">Open admin demo</Button>
            </Link>
          </div>
        </Card>
      )}
    </Container>
  );
}
