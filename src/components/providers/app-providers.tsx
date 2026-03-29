"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "sonner";

import { clientFlags } from "@/lib/public-env";

export function AppProviders({ children }: { children: React.ReactNode }) {
  const content = (
    <>
      {children}
      <Toaster richColors position="top-right" />
    </>
  );

  if (!clientFlags.hasClerk) {
    return content;
  }

  return <ClerkProvider>{content}</ClerkProvider>;
}
