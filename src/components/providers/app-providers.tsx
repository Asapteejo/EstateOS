"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "sonner";

export function AppProviders({ children }: { children: React.ReactNode }) {
  const hasClerk = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
  const content = (
    <>
      {children}
      <Toaster richColors position="top-right" />
    </>
  );

  if (!hasClerk) {
    return content;
  }

  return <ClerkProvider>{content}</ClerkProvider>;
}
