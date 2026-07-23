"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, Mail, Phone, ShieldCheck, Trash2, UserCog, UserPlus } from "lucide-react";

import { AdminEmptyState, StatCard } from "@/components/admin/admin-ui";
import { ProvisionResultDialog } from "@/components/admin/provision-result-modal";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import { WhatsAppButton } from "@/components/shared/whatsapp-button";
import { deleteUserAction, setUserActiveAction, setUserRoleAction } from "@/modules/admin/user-actions";
import { provisionPersonAction } from "@/modules/provisioning/actions";
import { ASSIGNABLE_ROLES, ROLE_LABELS, type CompanyUserRow } from "@/modules/admin/users";
import type { ProvisionUserResult } from "@/modules/provisioning/provision-user";
import type { AppRole } from "@prisma/client";

const PROVISION_INITIAL: ProvisionUserResult | null = null;

const inputCls =
  "admin-focus w-full rounded-[var(--radius-md)] border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--ink-900)] placeholder:text-[var(--ink-400)]";
const labelCls = "block text-xs font-medium uppercase tracking-[0.12em] text-[var(--ink-500)]";

const PROVISIONABLE_ROLES: Array<{ value: AppRole; label: string }> = [
  { value: "BUYER", label: "Buyer" },
  { value: "STAFF", label: "Staff" },
  { value: "FINANCE", label: "Finance" },
  { value: "LEGAL", label: "Legal" },
  { value: "MARKETER", label: "Marketer" },
];

function AddPersonSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Creating…" : "Create account"}
    </Button>
  );
}

function AddPersonDialog({
  hasClerkPassword,
  onClose,
}: {
  hasClerkPassword: boolean;
  onClose: () => void;
}) {
  const [state, formAction] = useActionState(provisionPersonAction, PROVISION_INITIAL);
  const [selectedRole, setSelectedRole] = useState<AppRole>("STAFF");
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state?.ok) return;
    formRef.current?.reset();
    const id = setTimeout(() => setSelectedRole("STAFF"), 0);
    return () => clearTimeout(id);
  }, [state?.ok]);

  if (state?.ok) {
    return <ProvisionResultDialog result={state} onClose={onClose} />;
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Add person"
      description="Create a login account for a team member or buyer."
      size="lg"
    >
      <form ref={formRef} action={formAction} className="space-y-5">
        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className={`${labelCls} col-span-2 mb-1`}>Identity</legend>
          <div>
            <label htmlFor="person-firstName" className={labelCls}>
              First name <span aria-hidden className="text-[var(--danger-600)]">*</span>
            </label>
            <input id="person-firstName" name="firstName" required className={`${inputCls} mt-1`} autoComplete="given-name" />
          </div>
          <div>
            <label htmlFor="person-lastName" className={labelCls}>
              Last name <span aria-hidden className="text-[var(--danger-600)]">*</span>
            </label>
            <input id="person-lastName" name="lastName" required className={`${inputCls} mt-1`} autoComplete="family-name" />
          </div>
          <div>
            <label htmlFor="person-email" className={labelCls}>
              Email <span aria-hidden className="text-[var(--danger-600)]">*</span>
            </label>
            <input id="person-email" name="email" type="email" required className={`${inputCls} mt-1`} autoComplete="email" />
          </div>
          <div>
            <label htmlFor="person-phone" className={labelCls}>Phone</label>
            <input id="person-phone" name="phone" type="tel" className={`${inputCls} mt-1`} autoComplete="tel" />
          </div>
        </fieldset>

        <div>
          <label htmlFor="person-role" className={labelCls}>
            Role <span aria-hidden className="text-[var(--danger-600)]">*</span>
          </label>
          <select
            id="person-role"
            name="role"
            required
            value={selectedRole}
            onChange={(e) => {
              const id = setTimeout(() => setSelectedRole(e.target.value as AppRole), 0);
              return () => clearTimeout(id);
            }}
            className={`${inputCls} mt-1`}
          >
            {PROVISIONABLE_ROLES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>

        {selectedRole !== "BUYER" ? (
          <fieldset className="grid gap-3 rounded-[var(--radius-lg)] border border-[var(--line)] p-4 sm:grid-cols-2">
            <legend className={`${labelCls} col-span-2 mb-1`}>Staff details (optional)</legend>
            <div>
              <label htmlFor="person-title" className={labelCls}>Title / position</label>
              <input id="person-title" name="title" className={`${inputCls} mt-1`} placeholder="e.g. Sales Executive" />
            </div>
            <div>
              <label htmlFor="person-staffCode" className={labelCls}>Staff code</label>
              <input id="person-staffCode" name="staffCode" className={`${inputCls} mt-1`} placeholder="e.g. STF-001" />
            </div>
          </fieldset>
        ) : null}

        {hasClerkPassword ? (
          <fieldset>
            <legend className={`${labelCls} mb-2`}>Account delivery</legend>
            <div className="space-y-2">
              <label className="flex cursor-pointer items-start gap-3">
                <input type="radio" name="delivery" value="invite" defaultChecked className="mt-0.5" />
                <span className="text-sm text-[var(--ink-700)]">
                  <span className="font-medium">Send invitation link</span>
                  <span className="block text-xs text-[var(--ink-500)]">Person sets their own password on first sign-in. Recommended.</span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3">
                <input type="radio" name="delivery" value="password" className="mt-0.5" />
                <span className="text-sm text-[var(--ink-700)]">
                  <span className="font-medium">Generate temporary password</span>
                  <span className="block text-xs text-[var(--ink-500)]">Shown once. Must be handed to the person directly. They will be required to change it.</span>
                </span>
              </label>
            </div>
          </fieldset>
        ) : (
          <input type="hidden" name="delivery" value="invite" />
        )}

        {state && !state.ok ? (
          <p role="alert" className="rounded-[var(--radius-md)] bg-[var(--danger-50,#fef2f2)] px-4 py-2.5 text-sm text-[var(--danger-700,#b91c1c)]">
            {state.error}
          </p>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <AddPersonSubmitButton />
        </DialogFooter>
      </form>
    </Dialog>
  );
}

export function UsersManagement({
  users,
  hasClerkPassword = false,
}: {
  users: CompanyUserRow[];
  hasClerkPassword?: boolean;
}) {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [addPersonOpen, setAddPersonOpen] = useState(false);

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

  const addPersonButton = (
    <Button variant="outline" size="sm" onClick={() => setAddPersonOpen(true)}>
      <UserPlus className="h-4 w-4" aria-hidden />
      Add person
    </Button>
  );

  if (users.length === 0) {
    return (
      <>
        <div className="flex justify-end">{addPersonButton}</div>
        <AdminEmptyState
          title="No staff accounts yet"
          description="Create accounts directly or invite team members from the Team section."
        />
        {addPersonOpen ? (
          <AddPersonDialog
            hasClerkPassword={hasClerkPassword}
            onClose={() => setAddPersonOpen(false)}
          />
        ) : null}
      </>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="grid grow gap-3 sm:grid-cols-3">
          <StatCard label="Total staff" value={String(users.length)} />
          <StatCard label="Active" value={String(activeCount)} />
          <StatCard label="Suspended" value={String(suspendedCount)} />
        </div>
        {addPersonButton}
      </div>

      {addPersonOpen ? (
        <AddPersonDialog
          hasClerkPassword={hasClerkPassword}
          onClose={() => setAddPersonOpen(false)}
        />
      ) : null}

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
