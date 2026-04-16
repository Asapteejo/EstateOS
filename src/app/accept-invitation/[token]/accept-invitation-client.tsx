"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SignIn } from "@clerk/nextjs";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

type Props = {
  token: string;
  inviteeName: string;
  inviteeEmail: string;
  companyName: string;
  companyLogoUrl: string | null;
  roleLabel: string;
  isAccepted: boolean;
  isExpired: boolean;
  hasClerk: boolean;
};

export function AcceptInvitationClient({
  token,
  inviteeName,
  inviteeEmail,
  companyName,
  companyLogoUrl,
  roleLabel,
  isAccepted,
  isExpired,
  hasClerk,
}: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);

  async function handleAccept() {
    setPending(true);
    try {
      const response = await fetch(`/api/accept-invitation/${token}`, {
        method: "POST",
      });
      const json = (await response.json().catch(() => null)) as {
        success?: boolean;
        data?: { redirectTo?: string };
        error?: string;
      } | null;

      if (!response.ok) {
        toast.error(json?.error ?? "Unable to accept invitation.");
        return;
      }

      toast.success(`Welcome to ${companyName}!`);
      router.push(json?.data?.redirectTo ?? "/admin");
    } finally {
      setPending(false);
    }
  }

  const card = (children: React.ReactNode) => (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f5f0] p-4">
      <div className="w-full max-w-md">
        {/* Header card */}
        <div className="rounded-[24px] border border-[#e8e4db] bg-white shadow-sm">
          <div className="border-b border-[#e8e4db] bg-[#1a1a18] rounded-t-[24px] px-8 py-7">
            {companyLogoUrl ? (
              <img src={companyLogoUrl} alt={companyName} className="h-8 object-contain" />
            ) : (
              <p className="text-[13px] font-semibold uppercase tracking-[0.2em] text-[#a89f8c]">
                EstateOS
              </p>
            )}
            <h1 className="mt-4 text-xl font-semibold text-[#faf9f7] leading-snug">
              {companyName}
            </h1>
          </div>
          <div className="px-8 py-7">{children}</div>
        </div>
      </div>
    </div>
  );

  if (isAccepted) {
    return card(
      <div className="text-center space-y-4">
        <div className="text-3xl">✓</div>
        <h2 className="text-lg font-semibold text-[#1a1a18]">Already accepted</h2>
        <p className="text-sm text-[#6b6558] leading-relaxed">
          This invitation has already been accepted. Sign in to access your workspace.
        </p>
        <a href="/sign-in">
          <Button className="w-full mt-2">Sign in</Button>
        </a>
      </div>,
    );
  }

  if (isExpired) {
    return card(
      <div className="text-center space-y-4">
        <div className="text-3xl">⏱</div>
        <h2 className="text-lg font-semibold text-[#1a1a18]">Invitation expired</h2>
        <p className="text-sm text-[#6b6558] leading-relaxed">
          This invitation link has expired or been revoked. Ask your admin to send a new
          invitation.
        </p>
      </div>,
    );
  }

  if (showSignIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f5f0] p-4">
        <div className="w-full max-w-md space-y-4">
          {hasClerk ? (
            <SignIn
              forceRedirectUrl={`/accept-invitation/${token}`}
              fallbackRedirectUrl={`/accept-invitation/${token}`}
              initialValues={{ emailAddress: inviteeEmail }}
            />
          ) : (
            <div className="rounded-[24px] border border-[#e8e4db] bg-white px-8 py-7 text-center">
              <p className="text-sm text-[#6b6558]">
                Clerk is not configured. Contact your system administrator.
              </p>
            </div>
          )}
          <div className="text-center">
            <button
              type="button"
              onClick={() => setShowSignIn(false)}
              className="text-sm text-[#9b9488] underline underline-offset-2 hover:text-[#1a1a18]"
            >
              ← Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return card(
    <div className="space-y-5">
      <div>
        <p className="text-sm text-[#6b6558] leading-relaxed">
          Hi <strong className="text-[#1a1a18]">{inviteeName}</strong>, you've been invited to
          join <strong className="text-[#1a1a18]">{companyName}</strong> as a{" "}
          <strong className="text-[#1a1a18]">{roleLabel}</strong>.
        </p>
      </div>

      <div className="rounded-[12px] bg-[#f8f7f3] px-5 py-4 text-sm space-y-1.5">
        <div className="flex justify-between">
          <span className="text-[#9b9488]">Email</span>
          <span className="font-medium text-[#1a1a18]">{inviteeEmail}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#9b9488]">Role</span>
          <span className="font-medium text-[#1a1a18]">{roleLabel}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#9b9488]">Company</span>
          <span className="font-medium text-[#1a1a18]">{companyName}</span>
        </div>
      </div>

      <div className="space-y-3 pt-1">
        <Button className="w-full" onClick={handleAccept} disabled={pending}>
          {pending ? "Joining…" : `Join ${companyName}`}
        </Button>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => setShowSignIn(true)}
          disabled={pending}
        >
          Sign in with a different account
        </Button>
      </div>

      <p className="text-[12px] text-[#9b9488] text-center leading-relaxed">
        By accepting, you'll be linked to this workspace with the {roleLabel} role.
      </p>
    </div>,
  );
}
