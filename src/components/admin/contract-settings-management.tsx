"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AdminEmptyState, AdminField, AdminFormSection, AdminPanel, AdminStateBanner } from "@/components/admin/admin-ui";
import { UploadField } from "@/components/uploads/upload-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ContractSettingsRow, ContractTemplateRow } from "@/modules/contracts/service";

function checklist(settings: ContractSettingsRow | null) {
  return [
    ["CEO name", Boolean(settings?.readiness.ceoName)],
    ["CEO title", Boolean(settings?.readiness.ceoTitle)],
    ["Signature uploaded", Boolean(settings?.readiness.signatureUploaded)],
    ["Company stamp uploaded", Boolean(settings?.readiness.stampUploaded)],
    ["Contract terms present", Boolean(settings?.readiness.contractTermsPresent)],
  ] as const;
}

function templateStatus(template: ContractTemplateRow) {
  if (template.archivedAt) return "ARCHIVED";
  if (template.isActive) return "ACTIVE";
  if (template.replacedByTemplateId) return "REPLACED";
  return "INACTIVE";
}

function actorName(template: ContractTemplateRow) {
  const name = [template.createdBy?.firstName, template.createdBy?.lastName].filter(Boolean).join(" ");
  return name || template.createdBy?.email || "System";
}

export function ContractSettingsManagement({
  settings,
  templates,
}: {
  settings: ContractSettingsRow | null;
  templates: ContractTemplateRow[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    ceoName: settings?.ceoName ?? "",
    ceoTitle: settings?.ceoTitle ?? "",
    signatureKey: settings?.signatureKey ?? "",
    signatureFileName: settings?.signatureKey ? "Signature uploaded" : "",
    stampKey: settings?.stampKey ?? "",
    stampFileName: settings?.stampKey ? "Stamp uploaded" : "",
    contractTerms: settings?.contractTerms ?? "",
    footerLegalText: settings?.footerLegalText ?? "",
  });
  const localReadiness = {
    ceoName: Boolean(form.ceoName.trim()),
    ceoTitle: Boolean(form.ceoTitle.trim()),
    signatureUploaded: Boolean(form.signatureKey),
    stampUploaded: Boolean(form.stampKey),
    contractTermsPresent: Boolean(form.contractTerms.trim()),
  };
  const configured =
    localReadiness.ceoName &&
    localReadiness.ceoTitle &&
    localReadiness.signatureUploaded &&
    localReadiness.stampUploaded &&
    localReadiness.contractTermsPresent;

  async function save() {
    setPending(true);
    const response = await fetch("/api/admin/settings/contracts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ceoName: form.ceoName,
        ceoTitle: form.ceoTitle,
        signatureKey: form.signatureKey,
        stampKey: form.stampKey,
        contractTerms: form.contractTerms,
        footerLegalText: form.footerLegalText,
      }),
    });
    setPending(false);

    if (!response.ok) {
      const json = (await response.json().catch(() => null)) as { error?: string } | null;
      toast.error(json?.error ?? "Unable to save contract settings.");
      return;
    }

    toast.success("Contract settings saved.");
    router.refresh();
  }

  async function archiveTemplate(templateId: string) {
    setArchivingId(templateId);
    const response = await fetch(`/api/admin/settings/contracts/templates/${templateId}/archive`, {
      method: "POST",
    });
    setArchivingId(null);

    if (!response.ok) {
      const json = (await response.json().catch(() => null)) as { error?: string } | null;
      toast.error(json?.error ?? "Unable to archive template version.");
      return;
    }

    toast.success("Template version archived.");
    router.refresh();
  }

  async function activateTemplate(templateId: string) {
    setActivatingId(templateId);
    const response = await fetch(`/api/admin/settings/contracts/templates/${templateId}/activate`, {
      method: "POST",
    });
    setActivatingId(null);

    if (!response.ok) {
      const json = (await response.json().catch(() => null)) as { error?: string } | null;
      toast.error(json?.error ?? "Unable to activate template version.");
      return;
    }

    toast.success("Template version activated.");
    router.refresh();
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
      <div className="space-y-6">
        <AdminFormSection title="Authorized signatory" description="These details are printed into generated Contracts of Sale.">
          <div className="grid gap-4 md:grid-cols-2">
            <AdminField label="CEO / authorized signatory name">
              <Input className="min-w-0" value={form.ceoName} onChange={(event) => setForm((current) => ({ ...current, ceoName: event.target.value }))} />
            </AdminField>
            <AdminField label="Title">
              <Input className="min-w-0" value={form.ceoTitle} onChange={(event) => setForm((current) => ({ ...current, ceoTitle: event.target.value }))} />
            </AdminField>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <UploadField
              label="CEO signature"
              purpose="COMPANY_SIGNATURE"
              surface="admin"
              mode="preparedUpload"
              value={{ storageKey: form.signatureKey, fileName: form.signatureFileName }}
              onChange={(value) => setForm((current) => ({
                ...current,
                signatureKey: value.storageKey ?? "",
                signatureFileName: value.fileName ?? "",
              }))}
              helperText="Private PNG, JPG, or WEBP. Used only inside generated contracts."
            />
            <UploadField
              label="Company stamp"
              purpose="COMPANY_STAMP"
              surface="admin"
              mode="preparedUpload"
              value={{ storageKey: form.stampKey, fileName: form.stampFileName }}
              onChange={(value) => setForm((current) => ({
                ...current,
                stampKey: value.storageKey ?? "",
                stampFileName: value.fileName ?? "",
              }))}
              helperText="Private PNG, JPG, or WEBP. Used only inside generated contracts."
            />
          </div>
        </AdminFormSection>

        <AdminFormSection title="Contract terms" description="Paste lawyer-approved sale terms and any footer disclaimer used for every generated contract.">
          <AdminField label="Contract terms">
            <Textarea
              className="min-h-56"
              value={form.contractTerms}
              onChange={(event) => setForm((current) => ({ ...current, contractTerms: event.target.value }))}
            />
          </AdminField>
          <AdminField label="Footer legal text">
            <Textarea
              className="min-h-28"
              value={form.footerLegalText}
              onChange={(event) => setForm((current) => ({ ...current, footerLegalText: event.target.value }))}
            />
          </AdminField>
          <div className="flex justify-end">
            <Button className="whitespace-nowrap" onClick={save} disabled={pending}>
              {pending ? "Saving..." : "Save contract settings"}
            </Button>
          </div>
        </AdminFormSection>
      </div>

      <div className="space-y-6">
        <AdminPanel title="Readiness checklist" description="Automatic generation runs only when all required items are configured.">
          <div className="space-y-3">
            {checklist(settings).map(([label]) => {
              const ready = label === "CEO name"
                ? localReadiness.ceoName
                : label === "CEO title"
                  ? localReadiness.ceoTitle
                  : label === "Signature uploaded"
                    ? localReadiness.signatureUploaded
                    : label === "Company stamp uploaded"
                      ? localReadiness.stampUploaded
                      : localReadiness.contractTermsPresent;
              return (
                <div key={label} className="flex min-w-0 items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--border-subtle,var(--line))] bg-white px-4 py-3 text-sm shadow-[var(--shadow-xs)]">
                  <span className="min-w-0 text-[var(--ink-700)]">{label}</span>
                  <span className={ready ? "rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 whitespace-nowrap" : "rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 whitespace-nowrap"}>
                    {ready ? "Ready" : "Missing"}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-4">
            <AdminStateBanner
              tone={configured ? "success" : "warning"}
              title={configured ? "Contracts are configured" : "Contract generation is not ready"}
              message={configured ? "Manual generation and full-payment webhook generation can create buyer contracts." : "Complete every checklist item before automatic generation can run."}
            />
          </div>
        </AdminPanel>

        <AdminPanel title="Sample preview" description="Preview of the structured system-generated template.">
          <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle,var(--line))] bg-white p-5 text-sm leading-6 text-[var(--ink-700)] shadow-[var(--shadow-xs)]">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ink-400)]">Contract of Sale</div>
            <div className="numeric mt-2 text-xl font-semibold text-[var(--ink-950)]">COS-SAMPLE-0001</div>
            <div className="mt-4 grid gap-2">
              <div>Buyer: Sample Buyer</div>
              <div>Property: Sample Property</div>
              <div>Payment: Verified full payment</div>
              <div>Signatory: {form.ceoName || "CEO name"} / {form.ceoTitle || "CEO title"}</div>
            </div>
            <div className="mt-4 rounded-xl bg-[var(--sand-100)] p-3 text-xs">
              {(form.contractTerms || "Contract terms will render here.").slice(0, 260)}
            </div>
          </div>
        </AdminPanel>

        <AdminPanel title="Template versions" description="Generated contracts keep the exact template version and PDF snapshot used at creation time.">
          <div className="space-y-3">
            {templates.length === 0 ? (
              <AdminEmptyState
                title="No template versions yet"
                description="Save contract settings to create template v1."
              />
            ) : (
              templates.map((template) => {
                const status = templateStatus(template);
                return (
                  <div key={template.id} className="rounded-[var(--radius-lg)] border border-[var(--border-subtle,var(--line))] bg-white p-4 text-sm shadow-[var(--shadow-xs)]">
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-[var(--ink-950)]">
                          {template.mode === "SYSTEM_TEMPLATE" ? "System template" : "Uploaded PDF template"} v{template.version}
                        </div>
                        <div className="numeric mt-1 text-xs text-[var(--ink-500)]">
                          Created {new Date(template.createdAt).toLocaleDateString()} by {actorName(template)}
                        </div>
                      </div>
                      <span className={status === "ACTIVE" ? "rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 whitespace-nowrap" : "rounded-full bg-[var(--sand-100)] px-2.5 py-1 text-xs font-semibold text-[var(--ink-500)] whitespace-nowrap"}>
                        {status}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-1 text-xs text-[var(--ink-600)]">
                      <div>Signatory: {template.ceoName} / {template.ceoTitle}</div>
                      <div>Configured: {template.isConfigured ? "Yes" : "No"}</div>
                      {template.document?.fileName ? <div>Template file: {template.document.fileName}</div> : null}
                    </div>
                    {!template.isActive ? (
                      <div className="mt-3 flex flex-wrap justify-end gap-2">
                        <Button className="whitespace-nowrap" size="sm" variant="outline" onClick={() => activateTemplate(template.id)} disabled={activatingId === template.id || !template.isConfigured}>
                          {activatingId === template.id ? "Activating..." : "Activate"}
                        </Button>
                        {!template.archivedAt ? (
                          <Button className="whitespace-nowrap" size="sm" variant="outline" onClick={() => archiveTemplate(template.id)} disabled={archivingId === template.id}>
                          {archivingId === template.id ? "Archiving..." : "Archive"}
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </AdminPanel>
      </div>
    </div>
  );
}
