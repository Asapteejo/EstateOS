"use client";

import { Toaster } from "sonner";

import { PostHogClientReporter } from "@/components/providers/posthog-client-reporter";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <PostHogClientReporter />
      <Toaster richColors position="top-right" />
    </>
  );
}
