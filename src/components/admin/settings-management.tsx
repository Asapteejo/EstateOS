"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AdminField, AdminFormSection, AdminStateBanner, AdminToolbar } from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { TenantAdminSettings } from "@/modules/settings/service";

export function SettingsManagement({ settings }: { settings: TenantAdminSettings }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [form, setForm] = useState({
    ...settings,
    logoUrl: settings.logoUrl ?? "",
    supportEmail: settings.supportEmail ?? "",
    supportPhone: settings.supportPhone ?? "",
    whatsappNumber: settings.whatsappNumber ?? "",
    address: settings.address ?? "",
    primaryColor: settings.primaryColor ?? "",
    accentColor: settings.accentColor ?? "",
    paymentDisplayLabel: settings.paymentDisplayLabel ?? "",
    receiptFooterNote: settings.receiptFooterNote ?? "",
  });

  async function submit() {
    setPending(true);
    const response = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(form),
    });
    setPending(false);

    if (!response.ok) {
      const json = (await response.json().catch(() => null)) as { error?: string } | null;
      toast.error(json?.error ?? "Unable to save tenant settings.");
      return;
    }

    toast.success("Settings updated.");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <AdminToolbar>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-400)]">
            Company configuration
          </div>
          <p className="mt-1 text-sm leading-6 text-[var(--ink-500)]">
            Settings save directly into the current tenant workspace and affect public contact details, billing defaults, and staff visibility.
          </p>
        </div>
      </AdminToolbar>

      <div className="grid gap-6 lg:grid-cols-2">
        <AdminFormSection title="Company settings" description="Tenant identity, support channels, and public contact details.">
          <AdminField label="Company name">
            <Input value={form.companyName} onChange={(event) => setForm((current) => ({ ...current, companyName: event.target.value }))} />
          </AdminField>
          <AdminField label="Support email">
            <Input value={form.supportEmail} onChange={(event) => setForm((current) => ({ ...current, supportEmail: event.target.value }))} />
          </AdminField>
          <AdminField label="Support phone">
            <Input value={form.supportPhone} onChange={(event) => setForm((current) => ({ ...current, supportPhone: event.target.value }))} />
          </AdminField>
          <AdminField label="WhatsApp number">
            <Input value={form.whatsappNumber} onChange={(event) => setForm((current) => ({ ...current, whatsappNumber: event.target.value }))} />
          </AdminField>
          <AdminField label="Address">
            <Textarea value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} />
          </AdminField>
        </AdminFormSection>

        <AdminFormSection title="Billing and receipts" description="Operational labels that complement the separate branding studio.">
          <AdminField label="Payment display label">
            <Input value={form.paymentDisplayLabel} onChange={(event) => setForm((current) => ({ ...current, paymentDisplayLabel: event.target.value }))} />
          </AdminField>
          <AdminField label="Receipt footer note">
            <Textarea value={form.receiptFooterNote} onChange={(event) => setForm((current) => ({ ...current, receiptFooterNote: event.target.value }))} />
          </AdminField>
        </AdminFormSection>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <AdminFormSection title="Property defaults" description="Defaults used when admins create and verify listings." density="dense">
          <AdminField label="Default wishlist duration (days)">
            <Input type="number" value={form.defaultWishlistDurationDays} onChange={(event) => setForm((current) => ({ ...current, defaultWishlistDurationDays: Number(event.target.value || 0) }))} />
          </AdminField>
          <AdminField label="Fresh for (days)">
            <Input type="number" value={form.verificationFreshDays} onChange={(event) => setForm((current) => ({ ...current, verificationFreshDays: Number(event.target.value || 0) }))} />
          </AdminField>
          <AdminField label="Stale after (days)">
            <Input type="number" value={form.verificationStaleDays} onChange={(event) => setForm((current) => ({ ...current, verificationStaleDays: Number(event.target.value || 0) }))} />
          </AdminField>
          <AdminField label="Hide after (days)">
            <Input type="number" value={form.verificationHideDays} onChange={(event) => setForm((current) => ({ ...current, verificationHideDays: Number(event.target.value || 0) }))} />
          </AdminField>
          <AdminField label="Warning reminder lead time (days)">
            <Input type="number" value={form.verificationWarningReminderDays} onChange={(event) => setForm((current) => ({ ...current, verificationWarningReminderDays: Number(event.target.value || 0) }))} />
          </AdminField>
        </AdminFormSection>

        <AdminFormSection title="Payment settings" description="Display defaults and billing guardrails for tenant operations." density="dense">
          <AdminField label="Default currency">
            <Input value={form.defaultCurrency} onChange={(event) => setForm((current) => ({ ...current, defaultCurrency: event.target.value.toUpperCase() }))} />
          </AdminField>
          <Toggle
            label="Require active plan for transactions"
            checked={form.requireActivePlanForTransactions}
            onChange={(checked) => setForm((current) => ({ ...current, requireActivePlanForTransactions: checked }))}
          />
          <Toggle
            label="Require active plan for admin ops"
            checked={form.requireActivePlanForAdminOps}
            onChange={(checked) => setForm((current) => ({ ...current, requireActivePlanForAdminOps: checked }))}
          />
        </AdminFormSection>

        <AdminFormSection title="Staff settings" description="Public directory and staff contact visibility on the tenant site." density="dense">
          <Toggle
            label="Public staff directory enabled"
            checked={form.publicStaffDirectoryEnabled}
            onChange={(checked) => setForm((current) => ({ ...current, publicStaffDirectoryEnabled: checked }))}
          />
          <Toggle
            label="Show staff email publicly"
            checked={form.showStaffEmail}
            onChange={(checked) => setForm((current) => ({ ...current, showStaffEmail: checked }))}
          />
          <Toggle
            label="Show staff WhatsApp publicly"
            checked={form.showStaffWhatsApp}
            onChange={(checked) => setForm((current) => ({ ...current, showStaffWhatsApp: checked }))}
          />
        </AdminFormSection>
      </div>

      <AdminStateBanner
        tone="info"
        title="Settings save immediately into the current tenant workspace"
        message="Use branding for visual identity. Use this panel for operational defaults, support contact points, and enforcement rules."
      />

      <div className="flex justify-end">
        <Button onClick={submit} disabled={pending}>
          {pending ? "Saving..." : "Save settings"}
        </Button>
      </div>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="admin-surface-muted flex items-center justify-between gap-4 px-4 py-3">
      <span className="text-sm font-medium text-[var(--ink-700)]">{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

