"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { TeamMemberManagementRecord } from "@/modules/team/queries";

type TeamMemberFormState = {
  fullName: string;
  slug: string;
  title: string;
  bio: string;
  avatarUrl: string;
  email: string;
  phone: string;
  whatsappNumber: string;
  resumeDocumentId: string;
  profileHighlights: string;
  portfolioText: string;
  portfolioLinks: string;
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
    resumeDocumentId: "",
    profileHighlights: "",
    portfolioText: "",
    portfolioLinks: "",
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
    resumeDocumentId: record.resumeDocumentId ?? "",
    profileHighlights: record.profileHighlights.join(", "),
    portfolioText: record.portfolioText ?? "",
    portfolioLinks: record.portfolioLinks.join(", "),
    specialties: record.specialties.join(", "),
    sortOrder: String(record.sortOrder),
    isActive: record.isActive,
    isPublished: record.isPublished,
  };
}

function serialize(state: TeamMemberFormState) {
  return {
    fullName: state.fullName,
    slug: state.slug || undefined,
    title: state.title,
    bio: state.bio,
    avatarUrl: state.avatarUrl || undefined,
    email: state.email || undefined,
    phone: state.phone || undefined,
    whatsappNumber: state.whatsappNumber || undefined,
    resumeDocumentId: state.resumeDocumentId || undefined,
    profileHighlights: state.profileHighlights
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    portfolioText: state.portfolioText || undefined,
    portfolioLinks: state.portfolioLinks
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    specialties: state.specialties
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
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

export function TeamManagement({
  members,
  resumeDocuments,
}: {
  members: TeamMemberManagementRecord[];
  resumeDocuments: Array<{ id: string; fileName: string }>;
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
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(serialize(createState)),
    });
    setPending(null);

    if (!response.ok) {
      const json = (await response.json().catch(() => null)) as { error?: string } | null;
      toast.error(json?.error ?? "Unable to create marketer profile.");
      return;
    }

    toast.success("Marketer profile created.");
    setCreateState(emptyState());
    router.refresh();
  }

  async function submitUpdate(memberId: string) {
    setPending(memberId);
    const response = await fetch(`/api/admin/team-members/${memberId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(serialize(drafts[memberId])),
    });
    setPending(null);

    if (!response.ok) {
      const json = (await response.json().catch(() => null)) as { error?: string } | null;
      toast.error(json?.error ?? "Unable to update marketer profile.");
      return;
    }

    toast.success("Marketer profile updated.");
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <Card className="p-6">
        <div className="mb-6 flex items-center justify-between gap-4">
          <SectionTitle
            title="Create marketer profile"
            description="Manage the visible staff and marketer profiles buyers can choose during reservation and payment flows."
          />
          <Badge>Tenant-scoped</Badge>
        </div>
        <TeamMemberEditor
          value={createState}
          resumeDocuments={resumeDocuments}
          onChange={setCreateState}
          onSubmit={submitCreate}
          submitLabel={pending === "create" ? "Creating..." : "Create marketer profile"}
        />
      </Card>

      <div className="grid gap-6 xl:grid-cols-[0.38fr_0.62fr]">
        <Card className="p-6">
          <SectionTitle
            title="Visible staff"
            description="Choose a marketer profile to edit visibility, contact details, and portfolio information."
          />
          <div className="mt-5 space-y-3">
            {members.map((member) => (
              <button
                key={member.id}
                type="button"
                onClick={() => setEditingId(member.id)}
                className={`w-full rounded-3xl border px-4 py-4 text-left transition ${
                  editingId === member.id
                    ? "border-[var(--brand-500)] bg-[var(--sand-100)]"
                    : "border-[var(--line)] bg-white"
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="font-semibold text-[var(--ink-950)]">{member.fullName}</div>
                    <div className="mt-1 text-sm text-[var(--ink-500)]">{member.title}</div>
                  </div>
                  <Badge>{member.isActive && member.isPublished ? "visible" : "hidden"}</Badge>
                </div>
              </button>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          {editingMember && editingId ? (
            <>
              <div className="mb-6">
                <SectionTitle
                  title={`Edit ${editingMember.fullName}`}
                  description="Update biography, WhatsApp details, specialties, and visibility without crossing tenant boundaries."
                />
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
              Select a marketer profile to start editing.
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
        <Input placeholder="Avatar URL" value={value.avatarUrl} onChange={(event) => update("avatarUrl", event.target.value)} />
        <Input placeholder="Email" value={value.email} onChange={(event) => update("email", event.target.value)} />
        <Input placeholder="Phone" value={value.phone} onChange={(event) => update("phone", event.target.value)} />
        <Input placeholder="WhatsApp number" value={value.whatsappNumber} onChange={(event) => update("whatsappNumber", event.target.value)} />
        <Input placeholder="Sort order" value={value.sortOrder} onChange={(event) => update("sortOrder", event.target.value)} />
      </div>

      <Textarea placeholder="Bio" value={value.bio} onChange={(event) => update("bio", event.target.value)} />
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
        placeholder="Portfolio text"
        value={value.portfolioText}
        onChange={(event) => update("portfolioText", event.target.value)}
      />
      <Textarea
        placeholder="Portfolio links, comma separated"
        value={value.portfolioLinks}
        onChange={(event) => update("portfolioLinks", event.target.value)}
      />

      <select
        className="h-11 rounded-2xl border border-[var(--line)] bg-white px-4 text-sm text-[var(--ink-700)]"
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

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-[var(--ink-700)]">
          <input
            type="checkbox"
            checked={value.isActive}
            onChange={(event) => update("isActive", event.target.checked)}
          />
          Active
        </label>
        <label className="flex items-center gap-2 text-sm text-[var(--ink-700)]">
          <input
            type="checkbox"
            checked={value.isPublished}
            onChange={(event) => update("isPublished", event.target.checked)}
          />
          Visible to buyers
        </label>
        <Button type="button" onClick={onSubmit}>
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
