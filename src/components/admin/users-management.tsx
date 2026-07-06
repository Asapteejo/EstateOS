"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, Mail, Phone, ShieldCheck, Trash2, UserCog } from "lucide-react";

import { AdminEmptyState, StatCard } from "@/components/admin/admin-ui";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { WhatsAppButton } from "@/components/shared/whatsapp-button";
import { deleteUserAction, setUserActiveAction, setUserRoleAction } from "@/modules/admin/user-actions";
import { ASSIGNABLE_ROLES, ROLE_LABELS, type CompanyUserRow } from "@/modules/admin/users";
import type { AppRole } from "@prisma/client";

export function UsersManagement({ users }: { users: CompanyUserRow[] }) {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.roles.some((r) => r.label.toLowerCase().includes(q)),
    );
  }, [users, query]);

  const activeCount = users.filter((u) => u.isActive).length;
  const suspendedCount = users.length - activeCount;

  function run(action: () => Promise<{ ok: boolean; error?: string }>, id: string, successMsg: string) {
    setPendingId(id);
    startTransition(async () => {
      try {
        const result = await action();
        if (!result.ok) {
          toast.error(result.error ?? "Action failed.");
        } else {
          toast.success(successMsg);
          router.refresh();
        }
      } catch {
        toast.error("Something went wrong. Please try again.");
      } finally {
        setPendingId(null);
      }
    });
  }

  function handleToggleActive(user: CompanyUserRow) {
    const next = !user.isActive;
    run(() => setUserActiveAction(user.id, next), user.id, next ? "User reactivated." : "User suspended.");
  }

  function handleDelete(user: CompanyUserRow) {
    setConfirmingId(null);
    run(() => deleteUserAction(user.id), user.id, "User deleted.");
  }

  function handleToggleRole(user: CompanyUserRow, roleName: AppRole, grant: boolean) {
    run(() => setUserRoleAction(user.id, roleName, grant), user.id, grant ? "Role granted." : "Role removed.");
  }

  if (users.length === 0) {
    return (
      <AdminEmptyState
        title="No staff accounts yet"
        description="Invite team members from the Team section. Their login accounts will appear here for you to manage."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Total staff" value={String(users.length)} />
        <StatCard label="Active" value={String(activeCount)} />
        <StatCard label="Suspended" value={String(suspendedCount)} />
      </div>

      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search by name, email, or role"
        aria-label="Search staff"
        className="admin-focus w-full rounded-[var(--radius-md)] border border-[var(--line)] bg-white px-4 py-2.5 text-sm text-[var(--ink-900)] placeholder:text-[var(--ink-400)]"
      />

      <div className="space-y-3">
        {filtered.map((user) => {
          const isExpanded = expandedId === user.id;
          const busy = pendingId === user.id;
          const lockReason = user.isSelf ? "This is your account" : user.isOwner ? "Owner account" : null;

          return (
            <Card key={user.id} className="admin-surface p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={user.name} size="lg" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-base font-semibold text-[var(--ink-950)]">{user.name}</span>
                      {user.isSelf ? (
                        <span className="rounded-full bg-[var(--brand-50,#eef2ff)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--brand-700)]">
                          You
                        </span>
                      ) : null}
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                          user.isActive
                            ? "bg-[var(--success-50)] text-[var(--success-700)]"
                            : "bg-[var(--sand-100,#f1f5f9)] text-[var(--ink-500)]"
                        }`}
                      >
                        {user.isActive ? "Active" : "Suspended"}
                      </span>
                    </div>
                    <div className="mt-1 truncate text-sm text-[var(--ink-500)]">{user.email}</div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {user.roles.map((role) => (
                        <Badge key={role.name} className="whitespace-nowrap">
                          {role.label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setExpandedId(isExpanded ? null : user.id)}
                    aria-expanded={isExpanded}
                  >
                    <UserCog className="h-4 w-4" aria-hidden /> View profile
                    <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} aria-hidden />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy || user.isSelf || user.isOwner}
                    title={lockReason ?? undefined}
                    onClick={() => handleToggleActive(user)}
                  >
                    {user.isActive ? "Suspend" : "Reactivate"}
                  </Button>
                  {confirmingId === user.id ? (
                    <span className="inline-flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() => handleDelete(user)}
                        className="border-[var(--danger-200,#fecaca)] bg-[var(--danger-50,#fef2f2)] text-[var(--danger-700,#b91c1c)]"
                      >
                        {busy ? "Deleting\u2026" : "Confirm delete"}
                      </Button>
                      <Button variant="ghost" size="sm" disabled={busy} onClick={() => setConfirmingId(null)}>
                        Cancel
                      </Button>
                    </span>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy || user.isSelf || user.isOwner}
                      title={lockReason ?? undefined}
                      onClick={() => setConfirmingId(user.id)}
                      className="border-[var(--danger-200,#fecaca)] text-[var(--danger-700,#b91c1c)] hover:bg-[var(--danger-50,#fef2f2)]"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden /> Delete
                    </Button>
                  )}
                </div>
              </div>

              {isExpanded ? (
                <div className="mt-5 grid gap-4 rounded-[var(--radius-lg)] border border-[var(--border-subtle,var(--line))] bg-[var(--sand-50)] p-5 sm:grid-cols-2">
                  <DetailRow icon={Mail} label="Email" value={user.email} />
                  <DetailRow icon={Phone} label="Phone" value={user.phone ?? "Not on file"} />
                  <DetailRow icon={ShieldCheck} label="Roles" value={user.roles.map((r) => r.label).join(", ")} />
                  <DetailRow icon={UserCog} label="Title" value={user.title ?? "Not set"} />
                  <DetailRow icon={UserCog} label="Staff code" value={user.staffCode ?? "Not set"} />
                  <DetailRow icon={ShieldCheck} label="Joined" value={user.joinedLabel} />
                  {user.phone ? (
                    <div className="sm:col-span-2">
                      <WhatsAppButton phone={user.phone} message={`Hi ${user.name},`} />
                    </div>
                  ) : null}
                  <div className="sm:col-span-2">
                    <div className="text-xs uppercase tracking-[0.14em] text-[var(--ink-400)]">Team roles</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {ASSIGNABLE_ROLES.map((roleName) => {
                        const hasRole = user.roles.some((role) => role.name === roleName);
                        return (
                          <button
                            key={roleName}
                            type="button"
                            disabled={busy || user.isSelf}
                            aria-pressed={hasRole}
                            onClick={() => handleToggleRole(user, roleName, !hasRole)}
                            className={`admin-focus rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                              hasRole
                                ? "border-[var(--brand-500)] bg-[var(--brand-50,#eef2ff)] text-[var(--brand-700)]"
                                : "border-[var(--line)] text-[var(--ink-600)] hover:bg-[var(--sand-100)]"
                            } ${busy || user.isSelf ? "cursor-not-allowed opacity-60" : ""}`}
                          >
                            {hasRole ? "\u2713 " : "+ "}
                            {ROLE_LABELS[roleName] ?? roleName}
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-1.5 text-xs text-[var(--ink-400)]">
                      {user.isSelf
                        ? "You cannot change your own roles."
                        : "Tap a role to grant or revoke it. Granting Marketer also makes them assignable to leads."}
                    </p>
                  </div>
                  {lockReason ? (
                    <p className="sm:col-span-2 text-xs text-[var(--ink-500)]">
                      {user.isSelf
                        ? "You cannot suspend or delete your own account."
                        : "Owner accounts are protected. Suspend or delete is disabled for owners."}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </Card>
          );
        })}
        {filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--ink-500)]">No staff match &ldquo;{query}&rdquo;.</p>
        ) : null}
      </div>
    </div>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Mail;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 grid h-8 w-8 place-items-center rounded-[var(--radius-md)] bg-white text-[var(--ink-500)]" aria-hidden>
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <div className="text-xs uppercase tracking-[0.14em] text-[var(--ink-400)]">{label}</div>
        <div className="mt-0.5 break-words text-sm font-medium text-[var(--ink-900)]">{value}</div>
      </div>
    </div>
  );
}
