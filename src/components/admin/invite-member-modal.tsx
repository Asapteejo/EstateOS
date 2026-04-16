"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Mail, UserPlus } from "lucide-react";

import { AdminModalFrame } from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type InvitedMember = {
  id: string;
  email: string;
  fullName: string;
  role: string;
  status: string;
  expiresAt: string;
};

const ROLE_OPTIONS = [
  { value: "STAFF", label: "Staff" },
  { value: "ADMIN", label: "Admin" },
  { value: "FINANCE", label: "Finance" },
  { value: "LEGAL", label: "Legal" },
] as const;

const ROLE_LABELS: Record<string, string> = {
  STAFF: "Staff",
  ADMIN: "Admin",
  FINANCE: "Finance",
  LEGAL: "Legal",
};

export function InviteMemberModal({
  pendingInvitations,
}: {
  pendingInvitations: InvitedMember[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"STAFF" | "ADMIN" | "FINANCE" | "LEGAL">("STAFF");
  const [pending, setPending] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);

  async function submit() {
    if (!fullName.trim() || !email.trim()) return;
    setPending(true);
    try {
      const response = await fetch("/api/admin/team-invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: fullName.trim(), email: email.trim(), role }),
      });
      const json = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        toast.error(json?.error ?? "Unable to send invitation.");
        return;
      }
      toast.success(`Invitation sent to ${email}.`);
      setFullName("");
      setEmail("");
      setRole("STAFF");
      setOpen(false);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function resend(id: string) {
    setResendingId(id);
    try {
      const response = await fetch(`/api/admin/team-invitations/${id}/resend`, {
        method: "POST",
      });
      const json = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        toast.error(json?.error ?? "Unable to resend invitation.");
        return;
      }
      toast.success("Invitation resent.");
      router.refresh();
    } finally {
      setResendingId(null);
    }
  }

  const isValid = fullName.trim().length >= 2 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  return (
    <div className="space-y-4">
      {/* Pending invitations list */}
      {pendingInvitations.length > 0 && (
        <div className="space-y-2">
          {pendingInvitations.map((inv) => (
            <div
              key={inv.id}
              className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--line)] bg-[var(--sand-50)] px-4 py-3"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium text-sm text-[var(--ink-900)]">
                    {inv.fullName}
                  </span>
                  <span className="shrink-0 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200">
                    Pending
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-[var(--ink-500)]">
                  <Mail className="h-3 w-3 shrink-0" />
                  <span className="truncate">{inv.email}</span>
                  <span className="shrink-0">·</span>
                  <span className="shrink-0">{ROLE_LABELS[inv.role] ?? inv.role}</span>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => resend(inv.id)}
                disabled={resendingId === inv.id}
                className="shrink-0 text-xs"
              >
                {resendingId === inv.id ? "Sending…" : "Resend"}
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Invite button */}
      <Button
        size="sm"
        variant="outline"
        className="gap-2"
        onClick={() => setOpen((v) => !v)}
      >
        <UserPlus className="h-4 w-4" />
        Invite member
      </Button>

      {open && (
        <AdminModalFrame
          title="Invite a team member"
          description="Send an email invitation with a secure link to join your workspace."
          footer={
            <div className="flex gap-2">
              <Button size="sm" onClick={submit} disabled={pending || !isValid}>
                {pending ? "Sending…" : "Send invitation"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
          }
        >
          <div className="space-y-3">
            <Input
              placeholder="Full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={pending}
            />
            <Input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={pending}
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as typeof role)}
              disabled={pending}
              className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--line)] bg-white px-3 text-sm text-[var(--ink-900)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]"
            >
              {ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </AdminModalFrame>
      )}
    </div>
  );
}
