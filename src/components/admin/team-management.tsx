"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, Eye, EyeOff, ShieldCheck, Users } from "lucide-react";

import { UploadField } from "@/components/uploads/upload-field";
import { InviteMemberModal } from "@/components/admin/invite-member-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { TeamMemberManagementRecord } from "@/modules/team/queries";

type PendingInvitation = {
  id: string;
  email: string;
  fullName: string;
  role: string;
  status: string;
  expiresAt: string;
};

type TeamMemberFormState = {
  fullName: string;
  slug: string;
  title: string;
  bio: string;
  avatarUrl: string;
  email: string;
  phone: string;
  whatsappNumber: string;
  staffCode: string;
  officeLocation: string;
  resumeDocumentId: string;
  profileHighlights: string;
  portfolioText: string;
  portfolioLinks: string;
  socialLinks: string;
  specialties: string;
  sortOrder: string;
  isActive: boolean;
  isPublished: boolean;
};

function emptyState(): TeamMemberFormState {
  return {
    fullName: "",
    slug: "",
    title: "",
    bio: "",
    avatarUrl: "",
    email: "",
    phone: "",
    whatsappNumber: "",
    staffCode: "",
    officeLocation: "",
    resumeDocumentId: "",
    profileHighlights: "",
    portfolioText: "",
    portfolioLinks: "",
    socialLinks: "",
    specialties: "",
    sortOrder: "0",
    isActive: true,
    isPublished: true,
  };
}

function toFormState(record: TeamMemberManagementRecord): TeamMemberFormState {
  return {
    fullName: record.fullName,
    slug: record.slug,
    title: record.title,
    bio: record.bio,
    avatarUrl: record.avatarUrl ?? "",
    email: record.email ?? "",
    phone: record.phone ?? "",
    whatsappNumber: record.whatsappNumber ?? "",
    staffCode: record.staffCode ?? "",
    officeLocation: record.officeLocation ?? "",
    resumeDocumentId: record.resumeDocumentId ?? "",
    profileHighlights: record.profileHighlights.join(", "),
    portfolioText: record.portfolioText ?? "",
    portfolioLinks: record.portfolioLinks.join(", "),
    socialLinks: record.socialLinks.join(", "),
    specialties: record.specialties.join(", "),
    sortOrder: String(record.sortOrder),
    isActive: record.isActive,
    isPublished: record.isPublished,
  };
}

function serialize(state: TeamMemberFormState) {
  const list = (value: string) =>
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

  return {
    fullName: state.fullName,
    slug: state.slug || undefined,
    title: state.title,
    bio: state.bio,
    avatarUrl: state.avatarUrl || undefined,
    email: state.email || undefined,
    phone: state.phone || undefined,
    whatsappNumber: state.whatsappNumber || undefined,
    staffCode: state.staffCode || undefined,
    officeLocation: state.officeLocation || undefined,
    resumeDocumentId: state.resumeDocumentId || undefined,
    profileHighlights: list(state.profileHighlights),
    portfolioText: state.portfolioText || undefined,
    portfolioLinks: list(state.portfolioLinks),
    socialLinks: list(state.socialLinks),
    specialties: list(state.specialties),
    sortOrder: Number(state.sortOrder || 0),
    isActive: state.isActive,
    isPublished: state.isPublished,
  };
}

function SectionTitle({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h3 className="text-base font-semibold text-[var(--ink-950)]">{title}</h3>
      <p className="mt-1 text-sm text-[var(--ink-500)]">{description}</p>
    </div>
  );
}

function StatusPills({ member }: { member: TeamMemberManagementRecord }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Badge className={member.isActive ? "" : "bg-[var(--sand-100)] text-[var(--ink-500)]"}>
        {member.isActive ? "Active" : "Inactive"}
      </Badge>
      <Badge className={member.isPublished ? "" : "bg-[var(--sand-100)] text-[var(--ink-500)]"}>
        {member.isPublished ? "Public" : "Private"}
      </Badge>
    </div>
  );
}

export function TeamManagement({
  members,
  resumeDocuments,
  pendingInvitations = [],
}: {
  members: TeamMemberManagementRecord[];
  resumeDocuments: Array<{ id: string; fileName: string }>;
  pendingInvitations?: PendingInvitation[];
}) {
  const router = useRouter();
  const [createState, setCreateState] = useState<TeamMemberFormState>(emptyState());
  const [editingId, setEditingId] = useState<string | null>(members[0]?.id ?? null);
  const [drafts, setDrafts] = useState<Record<string, TeamMemberFormState>>(
    Object.fromEntries(members.map((member) => [member.id, toFormState(member)])),
  );
  const [pending, setPending] = useState<string | null>(null);

  const editingMember = useMemo(
    () => (editingId ? members.find((member) => member.id === editingId) ?? null : null),
    [editingId, members],
  );

  async function submitCreate() {
    setPending("create");
    const response = await fetch("/api/admin/team-members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(serialize(createState)),
    });
    setPending(null);

    if (!response.ok) {
      const json = (await response.json().catch(() => null)) as { error?: string } | null;
      toast.error(json?.error ?? "Unable to create staff profile.");
      return;
    }

    toast.success("Staff profile created.");
    setCreateState(emptyState());
    router.refresh();
  }

  async function submitUpdate(memberId: string) {
    setPending(memberId);
    const response = await fetch(`/api/admin/team-members/${memberId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(serialize(drafts[memberId])),
    });
    setPending(null);

    if (!response.ok) {
      const json = (await response.json().catch(() => null)) as { error?: string } | null;
      toast.error(json?.error ?? "Unable to update staff profile.");
      return;
    }

    toast.success("Staff profile updated.");
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <Card className="overflow-hidden border-[var(--line)] bg-white">
        <div className="border-b border-[var(--line)] bg-[linear-gradient(135deg,#f7f1e7,#edf5f0)] px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <SectionTitle
              title="Create staff profile"
              description="Profiles here power the public staff directory, buyer contact experience, and printable branded ID cards."
            />
            <Badge className="gap-2">
              <ShieldCheck className="h-3.5 w-3.5" />
              Tenant-admin only
            </Badge>
          </div>
        </div>
        <div className="p-6">
          <TeamMemberEditor
            value={createState}
            resumeDocuments={resumeDocuments}
            onChange={setCreateState}
            onSubmit={submitCreate}
            submitLabel={pending === "create" ? "Creating..." : "Create staff profile"}
          />
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[0.38fr_0.62fr]">
        <Card className="border-[var(--line)] bg-white p-6">
          <div className="flex items-start justify-between gap-4">
            <SectionTitle
              title="Current team directory"
              description="Activate, hide, reorder, or open a profile to refine what appears on your public staff pages."
            />
            <Badge className="gap-2 bg-[var(--sand-100)] text-[var(--ink-600)]">
              <Users className="h-3.5 w-3.5" />
              {members.length} profiles
            </Badge>
          </div>
          <div className="mt-4">
            <InviteMemberModal pendingInvitations={pendingInvitations} />
          </div>
          <div className="mt-5 space-y-3">
            {members.map((member) => (
              <button
                key={member.id}
                type="button"
                onClick={() => setEditingId(member.id)}
                className={`w-full rounded-3xl border px-4 py-4 text-left transition ${
                  editingId === member.id
                    ? "border-[var(--brand-500)] bg-[var(--sand-100)]"
                    : "border-[var(--line)] bg-white hover:border-[var(--brand-300)]"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div>
                      <div className="font-semibold text-[var(--ink-950)]">{member.fullName}</div>
                      <div className="mt-1 text-sm text-[var(--ink-500)]">{member.title}</div>
                    </div>
                    <StatusPills member={member} />
                    <div className="text-xs uppercase tracking-[0.18em] text-[var(--ink-400)]">
                      {member.staffCode ?? "No staff code"}  -  order {member.sortOrder}
                    </div>
                  </div>
                  <div className="flex gap-2 text-[var(--ink-400)]">
                    {member.isPublished ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </div>
                </div>
              </button>
            ))}
            {members.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-[var(--line)] px-4 py-10 text-center text-sm text-[var(--ink-500)]">
                No staff profiles yet. Create the first profile to populate the tenant directory.
              </div>
            ) : null}
          </div>
        </Card>

        <Card className="border-[var(--line)] bg-white p-6">
          {editingMember && editingId ? (
            <>
              <div className="mb-6 flex items-start justify-between gap-4">
                <SectionTitle
                  title={`Edit ${editingMember.fullName}`}
                  description="Adjust visibility, contact details, branding fields, and public profile content without crossing tenant boundaries."
                />
                <Link href={`/api/admin/team-members/${editingId}/id-card`} target="_blank">
                  <Button type="button" variant="outline" className="gap-2">
                    <Download className="h-4 w-4" />
                    Download ID card
                  </Button>
                </Link>
              </div>
              <TeamMemberEditor
                value={drafts[editingId] ?? toFormState(editingMember)}
                resumeDocuments={resumeDocuments}
                onChange={(next) =>
                  setDrafts((current) => ({
                    ...current,
                    [editingId]: next,
                  }))
                }
                onSubmit={() => submitUpdate(editingId)}
                submitLabel={pending === editingId ? "Saving..." : "Save changes"}
              />
            </>
          ) : (
            <div className="rounded-3xl border border-dashed border-[var(--line)] p-10 text-center text-sm text-[var(--ink-500)]">
              Select a staff profile to edit its public presence and ID-card details.
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function TeamMemberEditor({
  value,
  resumeDocuments,
  onChange,
  onSubmit,
  submitLabel,
}: {
  value: TeamMemberFormState;
  resumeDocuments: Array<{ id: string; fileName: string }>;
  onChange: (next: TeamMemberFormState) => void;
  onSubmit: () => void;
  submitLabel: string;
}) {
  function update<K extends keyof TeamMemberFormState>(key: K, nextValue: TeamMemberFormState[K]) {
    onChange({
      ...value,
      [key]: nextValue,
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Input placeholder="Full name" value={value.fullName} onChange={(event) => update("fullName", event.target.value)} />
        <Input placeholder="Role or title" value={value.title} onChange={(event) => update("title", event.target.value)} />
        <Input placeholder="Profile slug (optional)" value={value.slug} onChange={(event) => update("slug", event.target.value)} />
        <Input placeholder="Staff code" value={value.staffCode} onChange={(event) => update("staffCode", event.target.value)} />
        <Input placeholder="Office location" value={value.officeLocation} onChange={(event) => update("officeLocation", event.target.value)} />
        <Input placeholder="Email" value={value.email} onChange={(event) => update("email", event.target.value)} />
        <Input placeholder="Phone" value={value.phone} onChange={(event) => update("phone", event.target.value)} />
        <Input placeholder="WhatsApp number" value={value.whatsappNumber} onChange={(event) => update("whatsappNumber", event.target.value)} />
        <Input placeholder="Display order" value={value.sortOrder} onChange={(event) => update("sortOrder", event.target.value)} />
      </div>

      <UploadField
        label="Staff profile image"
        purpose="STAFF_PHOTO"
        surface="admin"
        mode="publicAsset"
        allowExternalUrl
        helperText="Public-facing profile image shown on the tenant team directory and marketer cards."
        value={{ url: value.avatarUrl }}
        onChange={(uploaded) => update("avatarUrl", uploaded.url ?? "")}
      />

      <Textarea placeholder="Bio / about" value={value.bio} onChange={(event) => update("bio", event.target.value)} />
      <Textarea
        placeholder="Profile highlights, comma separated"
        value={value.profileHighlights}
        onChange={(event) => update("profileHighlights", event.target.value)}
      />
      <Textarea
        placeholder="Specialties, comma separated"
        value={value.specialties}
        onChange={(event) => update("specialties", event.target.value)}
      />
      <Textarea
        placeholder="Portfolio summary"
        value={value.portfolioText}
        onChange={(event) => update("portfolioText", event.target.value)}
      />
      <Textarea
        placeholder="Portfolio links, comma separated"
        value={value.portfolioLinks}
        onChange={(event) => update("portfolioLinks", event.target.value)}
      />
      <Textarea
        placeholder="Social links, comma separated"
        value={value.socialLinks}
        onChange={(event) => update("socialLinks", event.target.value)}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <UploadField
          label="Resume attachment"
          purpose="RESUME"
          surface="admin"
          mode="document"
          helperText="Private document stored in the tenant vault for internal use."
          value={{
            documentId: value.resumeDocumentId || null,
            fileName:
              resumeDocuments.find((document) => document.id === value.resumeDocumentId)?.fileName ?? null,
          }}
          onChange={(uploaded) => update("resumeDocumentId", uploaded.documentId ?? "")}
        />
        <label className="block space-y-2">
          <span className="text-sm font-medium text-[var(--ink-700)]">Existing uploaded resume</span>
          <select
            className="h-11 w-full rounded-2xl border border-[var(--line)] bg-white px-4 text-sm text-[var(--ink-700)]"
            value={value.resumeDocumentId}
            onChange={(event) => update("resumeDocumentId", event.target.value)}
          >
            <option value="">No resume linked</option>
            {resumeDocuments.map((document) => (
              <option key={document.id} value={document.id}>
                {document.fileName}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-4 rounded-3xl border border-[var(--line)] bg-[var(--sand-50)] px-4 py-4">
        <label className="flex items-center gap-2 text-sm text-[var(--ink-700)]">
          <input
            type="checkbox"
            checked={value.isActive}
            onChange={(event) => update("isActive", event.target.checked)}
          />
          Active profile
        </label>
        <label className="flex items-center gap-2 text-sm text-[var(--ink-700)]">
          <input
            type="checkbox"
            checked={value.isPublished}
            onChange={(event) => update("isPublished", event.target.checked)}
          />
          Visible on public team pages
        </label>
        <Button type="button" onClick={onSubmit}>
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
