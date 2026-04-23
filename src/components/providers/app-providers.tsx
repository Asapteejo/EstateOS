"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "sonner";

import { PostHogClientReporter } from "@/components/providers/posthog-client-reporter";
import { PostHogClerkIdentity } from "@/components/providers/posthog-clerk-identity";
import { clientFlags } from "@/lib/public-env";

export function AppProviders({ children }: { children: React.ReactNode }) {
  const content = (
    <>
      {children}
      <PostHogClientReporter />
      <Toaster richColors position="top-right" />
    </>
  );

  if (!clientFlags.hasClerk) {
    return content;
  }

  return (
    <ClerkProvider>
      <PostHogClerkIdentity />
      {content}
    </ClerkProvider>
  );
}
