"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { ProvisionUserResult } from "@/modules/provisioning/provision-user";

/**
 * One-time credential display after operator-provisioned account creation.
 * For invite delivery: shows confirmation with the recipient email.
 * For password delivery: shows the temporary password with copy-to-clipboard
 * and a prominent "shown once" warning — the password is never stored.
 */
export function ProvisionResultDialog({
  result,
  onClose,
}: {
  result: ProvisionUserResult & { ok: true };
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  function handleCopy() {
    if (result.delivery !== "password") return;
    navigator.clipboard.writeText(result.password).then(() => {
      setCopied(true);
      copyTimerRef.current = setTimeout(() => setCopied(false), 3000);
    });
  }

  const isInvite = result.delivery === "invite";

  return (
    <Dialog
      open
      onClose={onClose}
      title={isInvite ? "Invitation sent" : "Account created"}
      description={
        isInvite
          ? "The invitation link will expire in 7 days."
          : undefined
      }
      size="sm"
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-[var(--radius-lg)] bg-[var(--success-50,#f0fdf4)] px-4 py-3">
          <CheckCircle className="h-5 w-5 shrink-0 text-[var(--success-600,#16a34a)]" aria-hidden />
          <p className="text-sm font-medium text-[var(--success-800,#166534)]">
            {isInvite ? (
              <>
                Invite sent to <strong>{result.email}</strong>
              </>
            ) : (
              <>
                Account created for <strong>{result.email}</strong>
              </>
            )}
          </p>
        </div>

        {!isInvite && result.delivery === "password" ? (
          <div className="space-y-3">
            <div className="rounded-[var(--radius-lg)] border border-[var(--danger-200,#fecaca)] bg-[var(--danger-50,#fef2f2)] px-4 py-3">
              <p className="text-sm font-semibold text-[var(--danger-700,#b91c1c)]">
                Shown once — copy it now
              </p>
              <p className="mt-0.5 text-xs text-[var(--danger-600,#dc2626)]">
                This password will not be displayed again. Hand it directly to the person and
                instruct them to change it on first login.
              </p>
            </div>

            <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--sand-50,#f8f9fa)] px-4 py-3">
              <code className="flex-1 select-all font-mono text-base tracking-widest text-[var(--ink-950)]">
                {result.password}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                aria-label="Copy password"
              >
                <Copy className="h-4 w-4" aria-hidden />
                {copied ? "Copied!" : "Copy"}
              </Button>
            </div>
          </div>
        ) : null}

        <div className="flex justify-end pt-1">
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    </Dialog>
  );
}
