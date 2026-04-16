"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AdminLabeledField, AdminStateBanner } from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Bank = { name: string; code: string };

type ProviderAccount = {
  id: string;
  subaccountCode: string | null;
  displayName: string;
  accountReference: string;
  status: string;
  metadata: Record<string, unknown> | null;
};

function maskAccount(n: string) {
  return n.length >= 4 ? `${"*".repeat(n.length - 4)}${n.slice(-4)}` : n;
}

function StatusBadge({ status }: { status: string }) {
  const isActive = status === "ACTIVE";
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
        isActive
          ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
          : "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
      }`}
    >
      {isActive ? "Verified" : "Pending verification"}
    </span>
  );
}

function SubaccountForm({
  banks,
  initial,
  onSave,
  onCancel,
  isUpdate,
}: {
  banks: Bank[];
  initial?: Partial<{
    businessName: string;
    settlementBank: string;
    accountNumber: string;
    percentageCharge: number;
  }>;
  onSave: (data: {
    businessName: string;
    settlementBank: string;
    accountNumber: string;
    percentageCharge: number;
  }) => Promise<void>;
  onCancel?: () => void;
  isUpdate: boolean;
}) {
  const [businessName, setBusinessName] = useState(initial?.businessName ?? "");
  const [settlementBank, setSettlementBank] = useState(initial?.settlementBank ?? "");
  const [accountNumber, setAccountNumber] = useState(initial?.accountNumber ?? "");
  const [percentageCharge, setPercentageCharge] = useState(
    String(initial?.percentageCharge ?? 0),
  );
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!businessName.trim() || !settlementBank || !/^\d{10}$/.test(accountNumber)) return;
    setPending(true);
    try {
      await onSave({
        businessName: businessName.trim(),
        settlementBank,
        accountNumber,
        percentageCharge: Number(percentageCharge),
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <AdminLabeledField label="Business name" htmlFor="pa-business-name">
        <Input
          id="pa-business-name"
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          placeholder="e.g. Orchid Ridge Homes Ltd"
          required
        />
      </AdminLabeledField>

      <AdminLabeledField label="Settlement bank" htmlFor="pa-bank">
        <select
          id="pa-bank"
          value={settlementBank}
          onChange={(e) => setSettlementBank(e.target.value)}
          required
          className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--line)] bg-white px-3 text-sm text-[var(--ink-900)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]"
        >
          <option value="" disabled>
            Select a bank
          </option>
          {banks.map((b) => (
            <option key={b.code} value={b.code}>
              {b.name}
            </option>
          ))}
        </select>
      </AdminLabeledField>

      <AdminLabeledField
        label="Account number"
        htmlFor="pa-account"
        hint="Must be a valid 10-digit Nigerian bank account number."
      >
        <Input
          id="pa-account"
          value={accountNumber}
          onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
          placeholder="0123456789"
          inputMode="numeric"
          maxLength={10}
          required
        />
      </AdminLabeledField>

      <AdminLabeledField
        label="EstateOS commission %"
        htmlFor="pa-charge"
        hint="Percentage of each transaction EstateOS retains. Enter 0 if none."
      >
        <Input
          id="pa-charge"
          type="number"
          min={0}
          max={100}
          step={0.1}
          value={percentageCharge}
          onChange={(e) => setPercentageCharge(e.target.value)}
          placeholder="0"
          required
        />
      </AdminLabeledField>

      <div className="flex gap-3 pt-2">
        <Button
          type="submit"
          disabled={pending || !businessName || !settlementBank || accountNumber.length !== 10}
        >
          {pending ? "Saving…" : isUpdate ? "Update account" : "Connect account"}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

export function PaymentAccountSetup() {
  const router = useRouter();
  const [account, setAccount] = useState<ProviderAccount | null | undefined>(undefined); // undefined = loading
  const [banks, setBanks] = useState<Bank[]>([]);
  const [banksError, setBanksError] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/payment-account").then((r) => r.json() as Promise<{ account: ProviderAccount | null }>),
      fetch("/api/admin/payment-account/banks").then((r) =>
        r.json() as Promise<{ banks: Bank[] }>
      ),
    ])
      .then(([accountData, banksData]) => {
        setAccount(accountData.account);
        setBanks(banksData.banks ?? []);
      })
      .catch(() => {
        setAccount(null);
        setBanksError(true);
      });
  }, []);

  async function handleSave(data: {
    businessName: string;
    settlementBank: string;
    accountNumber: string;
    percentageCharge: number;
  }) {
    const method = account ? "PATCH" : "POST";
    const response = await fetch("/api/admin/payment-account", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = (await response.json().catch(() => null)) as {
      error?: string;
      account?: ProviderAccount;
    } | null;

    if (!response.ok) {
      toast.error(json?.error ?? "Failed to save payment account.");
      return;
    }

    toast.success(account ? "Payment account updated." : "Payment account connected.");
    setAccount(json?.account ?? null);
    setEditing(false);
    router.refresh();
  }

  // Loading skeleton
  if (account === undefined) {
    return (
      <div className="space-y-3 py-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 w-full animate-pulse rounded-[var(--radius-md)] bg-[var(--sand-100)]" />
        ))}
      </div>
    );
  }

  const meta =
    account?.metadata && typeof account.metadata === "object"
      ? (account.metadata as Record<string, unknown>)
      : null;

  // ── Account exists ────────────────────────────────────────────────────────
  if (account && !editing) {
    return (
      <div className="space-y-5">
        <AdminStateBanner
          tone="success"
          title="Payment account connected"
          message="Your Paystack subaccount is set up. Payments from buyers will settle to this account."
        />

        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { label: "Business name", value: account.displayName },
            {
              label: "Bank",
              value: String(meta?.["bankName"] ?? "—"),
            },
            {
              label: "Account number",
              value: maskAccount(account.accountReference),
            },
            {
              label: "Commission %",
              value: `${meta?.["percentageCharge"] ?? 0}%`,
            },
            {
              label: "Subaccount code",
              value: account.subaccountCode ?? "—",
              mono: true,
            },
            {
              label: "Status",
              value: <StatusBadge status={account.status} />,
            },
          ].map(({ label, value, mono }) => (
            <div
              key={label}
              className="rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--sand-50)] px-4 py-3"
            >
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-500)]">
                {label}
              </div>
              <div
                className={`mt-1 text-sm font-medium text-[var(--ink-900)] ${mono ? "font-mono" : ""}`}
              >
                {value}
              </div>
            </div>
          ))}
        </div>

        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          Update account
        </Button>
      </div>
    );
  }

  // ── Form (create or edit) ─────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {!account && (
        <AdminStateBanner
          tone="warning"
          title="Payment account not connected"
          message="Connect your Paystack subaccount so buyers can pay directly to your settlement bank."
        />
      )}
      {banksError && (
        <AdminStateBanner
          tone="danger"
          title="Could not load bank list"
          message="Check your Paystack configuration or try again."
        />
      )}
      <SubaccountForm
        banks={banks}
        initial={
          account
            ? {
                businessName: account.displayName,
                settlementBank: String(meta?.["bankCode"] ?? ""),
                accountNumber: account.accountReference,
                percentageCharge: Number(meta?.["percentageCharge"] ?? 0),
              }
            : undefined
        }
        onSave={handleSave}
        onCancel={account ? () => setEditing(false) : undefined}
        isUpdate={Boolean(account)}
      />
    </div>
  );
}
