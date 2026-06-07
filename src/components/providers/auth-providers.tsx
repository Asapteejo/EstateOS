"use client";

import { ClerkProvider } from "@clerk/nextjs";

import { PostHogClerkIdentity } from "@/components/providers/posthog-clerk-identity";
import { clientFlags, publicEnv } from "@/lib/public-env";

export function AuthProviders({
  children,
  disableClerkForDev = false,
}: {
  children: React.ReactNode;
  disableClerkForDev?: boolean;
}) {
  if (!clientFlags.hasClerk || disableClerkForDev) {
    return <>{children}</>;
  }

  return (
    <ClerkProvider publishableKey={publicEnv.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}>
      <PostHogClerkIdentity />
      {children}
    </ClerkProvider>
  );
}
