"use client";

import { SignOutButton } from "@clerk/nextjs";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { clientFlags } from "@/lib/public-env";

export function AuthAccessActions({
  currentDashboard,
  switchAccountUrl,
}: {
  currentDashboard: string;
  switchAccountUrl: string;
}) {
  return (
    <div className="flex flex-wrap gap-3">
      <Link href={currentDashboard}>
        <Button>Continue to your current dashboard</Button>
      </Link>
      {clientFlags.hasClerk ? (
        <SignOutButton redirectUrl={switchAccountUrl}>
          <Button type="button" variant="outline">
            Sign out and continue as another user
          </Button>
        </SignOutButton>
      ) : (
        <Link href={switchAccountUrl}>
          <Button variant="outline">Continue as another user</Button>
        </Link>
      )}
      <Link href="mailto:support@estateos.tech?subject=EstateOS%20tenant%20access%20request">
        <Button variant="ghost">Request access</Button>
      </Link>
    </div>
  );
}
