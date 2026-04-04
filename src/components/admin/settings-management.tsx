"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { TenantAdminSettings } from "@/modules/settings/service";

export function SettingsManagement({ settings }: { settings: TenantAdminSettings }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [form, setForm] = useState({
    ...settings,
    supportEmail: settings.supportEmail ?? "",
    supportPhone: settings.supportPhone ?? "",
    whatsappNumber: settings.whatsappNumber ?? "",
    address: settings.address ?? "",
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
      <div className="grid gap-6 lg:grid-cols-2">
        <SettingsSection title="Company settings" description="Tenant identity, support channels, and public contact details.">
          <Field label="Company name">
            <input className="h-11 w-full rounded-2xl border border-[var(--line)] bg-white px-4 text-sm text-[var(--ink-700)]" value={form.companyName} onChange={(event) => setForm((current) => ({ ...current, companyName: event.target.value }))} />
          </Field>
          <Field label="Support email">
            <input className="h-11 w-full rounded-2xl border border-[var(--line)] bg-white px-4 text-sm text-[var(--ink-700)]" value={form.supportEmail} onChange={(event) => setForm((current) => ({ ...current, supportEmail: event.target.value }))} />
          </Field>
          <Field label="Support phone">
            <input className="h-11 w-full rounded-2xl border border-[var(--line)] bg-white px-4 text-sm text-[var(--ink-700)]" value={form.supportPhone} onChange={(event) => setForm((current) => ({ ...current, supportPhone: event.target.value }))} />
          </Field>
          <Field label="WhatsApp number">
            <input className="h-11 w-full rounded-2xl border border-[var(--line)] bg-white px-4 text-sm text-[var(--ink-700)]" value={form.whatsappNumber} onChange={(event) => setForm((current) => ({ ...current, whatsappNumber: event.target.value }))} />
          </Field>
          <Field label="Address">
            <textarea className="min-h-28 w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm text-[var(--ink-700)]" value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} />
          </Field>
        </SettingsSection>

        <SettingsSection title="Billing and receipts" description="Operational labels that complement the separate branding studio.">
          <Field label="Payment display label">
            <input className="h-11 w-full rounded-2xl border border-[var(--line)] bg-white px-4 text-sm text-[var(--ink-700)]" value={form.paymentDisplayLabel} onChange={(event) => setForm((current) => ({ ...current, paymentDisplayLabel: event.target.value }))} />
          </Field>
          <Field label="Receipt footer note">
            <textarea className="min-h-28 w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm text-[var(--ink-700)]" value={form.receiptFooterNote} onChange={(event) => setForm((current) => ({ ...current, receiptFooterNote: event.target.value }))} />
          </Field>
        </SettingsSection>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <SettingsSection title="Property defaults" description="Defaults used when admins create and verify listings.">
          <Field label="Default wishlist duration (days)">
            <input type="number" className="h-11 w-full rounded-2xl border border-[var(--line)] bg-white px-4 text-sm text-[var(--ink-700)]" value={form.defaultWishlistDurationDays} onChange={(event) => setForm((current) => ({ ...current, defaultWishlistDurationDays: Number(event.target.value || 0) }))} />
          </Field>
          <Field label="Fresh for (days)">
            <input type="number" className="h-11 w-full rounded-2xl border border-[var(--line)] bg-white px-4 text-sm text-[var(--ink-700)]" value={form.verificationFreshDays} onChange={(event) => setForm((current) => ({ ...current, verificationFreshDays: Number(event.target.value || 0) }))} />
          </Field>
          <Field label="Stale after (days)">
            <input type="number" className="h-11 w-full rounded-2xl border border-[var(--line)] bg-white px-4 text-sm text-[var(--ink-700)]" value={form.verificationStaleDays} onChange={(event) => setForm((current) => ({ ...current, verificationStaleDays: Number(event.target.value || 0) }))} />
          </Field>
          <Field label="Hide after (days)">
            <input type="number" className="h-11 w-full rounded-2xl border border-[var(--line)] bg-white px-4 text-sm text-[var(--ink-700)]" value={form.verificationHideDays} onChange={(event) => setForm((current) => ({ ...current, verificationHideDays: Number(event.target.value || 0) }))} />
          </Field>
          <Field label="Warning reminder lead time (days)">
            <input type="number" className="h-11 w-full rounded-2xl border border-[var(--line)] bg-white px-4 text-sm text-[var(--ink-700)]" value={form.verificationWarningReminderDays} onChange={(event) => setForm((current) => ({ ...current, verificationWarningReminderDays: Number(event.target.value || 0) }))} />
          </Field>
        </SettingsSection>

        <SettingsSection title="Payment settings" description="Display defaults and billing guardrails for tenant operations.">
          <Field label="Default currency">
            <input className="h-11 w-full rounded-2xl border border-[var(--line)] bg-white px-4 text-sm text-[var(--ink-700)]" value={form.defaultCurrency} onChange={(event) => setForm((current) => ({ ...current, defaultCurrency: event.target.value.toUpperCase() }))} />
          </Field>
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
        </SettingsSection>

        <SettingsSection title="Staff settings" description="Public directory and staff contact visibility on the tenant site.">
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
        </SettingsSection>
      </div>

      <div className="flex justify-end">
        <Button onClick={submit} disabled={pending}>
          {pending ? "Saving..." : "Save settings"}
        </Button>
      </div>
    </div>
  );
}

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="rounded-[30px] border-[var(--line)] bg-white p-6">
      <h2 className="text-xl font-semibold text-[var(--ink-950)]">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--ink-500)]">{description}</p>
      <div className="mt-5 space-y-4">{children}</div>
    </Card>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-[var(--ink-700)]">{label}</span>
      {children}
    </label>
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
    <label className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--line)] px-4 py-3">
      <span className="text-sm font-medium text-[var(--ink-700)]">{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

