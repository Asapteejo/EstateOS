import { AdminEmptyState, AdminPanel, AdminToolbar } from "@/components/admin/admin-ui";
import { DashboardShell } from "@/components/portal/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requireAdminSession } from "@/lib/auth/guards";
import { formatCurrency } from "@/lib/utils";
import { listCommissionRules } from "@/modules/commission/rules";

import {
  createCommissionRuleAction,
  deactivateCommissionRuleAction,
} from "./actions";
import { Select } from "@/components/ui/select";

const PROPERTY_TYPE_OPTIONS = [
  ["", "All property types"],
  ["APARTMENT", "Apartment"],
  ["DUPLEX", "Duplex"],
  ["TERRACE", "Terrace"],
  ["DETACHED", "Detached"],
  ["SEMI_DETACHED", "Semi-detached"],
  ["LAND", "Land"],
  ["COMMERCIAL", "Commercial"],
] as const;

export default async function CommissionRulesPage() {
  const tenant = await requireAdminSession(["ADMIN"]);
  const rules = await listCommissionRules(tenant.companyId!);

  return (
    <DashboardShell
      area="admin"
      title="Commission rules"
      subtitle="Define how much each marketer earns when a payment on their attributed deal is confirmed. Rules are matched by specificity - property-specific beats property-type, which beats company-wide."
    >
      <AdminPanel title="Add a rule" description="Set a flat fee or percentage earned per confirmed payment.">
        <form action={createCommissionRuleAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-500)]">
              Rule name
            </label>
            <Input className="min-w-0" name="name" placeholder="e.g. Standard 3% commission" required />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-500)]">
              Fee type
            </label>
            <Select
              name="feeType"
              required className="min-w-0"
            >
              <option value="PERCENTAGE">Percentage of payment</option>
              <option value="FLAT">Flat fee</option>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-500)]">
              Amount / rate
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              <Input
                name="flatAmount"
                type="number"
                min="0"
                step="0.01"
                placeholder="Flat amount (e.g. 50000)"
                className="numeric min-w-0"
              />
              <Input
                name="percentageRate"
                type="number"
                min="0"
                max="100"
                step="0.01"
                placeholder="Rate % (e.g. 3.5)"
                className="numeric min-w-0"
              />
            </div>
            <p className="text-xs text-[var(--ink-400)]">Fill the relevant field for your chosen fee type.</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-500)]">
              Currency
            </label>
            <Input className="numeric min-w-0 uppercase" name="currency" defaultValue="NGN" placeholder="NGN" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-500)]">
              Scope - property type
            </label>
            <Select
              name="propertyType" className="min-w-0"
            >
              {PROPERTY_TYPE_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            <p className="text-xs text-[var(--ink-400)]">Leave as &quot;All&quot; for a company-wide default.</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-500)]">
              Scope - specific property ID
            </label>
            <Input className="min-w-0" name="propertyId" placeholder="Leave blank for type/global scope" />
            <p className="text-xs text-[var(--ink-400)]">Property-specific rules override all others.</p>
          </div>

          <div className="sm:col-span-2 lg:col-span-3">
            <Button className="whitespace-nowrap" type="submit">Save rule</Button>
          </div>
        </form>
      </AdminPanel>

      <AdminPanel
        title="Active rules"
        description={`${rules.length} rule${rules.length === 1 ? "" : "s"} configured for this workspace.`}
        className="px-0 py-0"
      >
        {rules.length > 0 ? (
          <div className="overflow-x-auto pb-1">
            <table className="admin-table min-w-[760px]">
              <thead>
                <tr>
                  {["Rule name", "Type", "Amount / rate", "Scope", ""].map((col) => (
                    <th key={col}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => (
                  <tr key={rule.id}>
                    <td className="min-w-[220px] font-semibold text-[var(--ink-950)]">{rule.name}</td>
                    <td>
                      <span className="rounded-full border border-[var(--border-subtle,var(--line))] bg-[var(--sand-50)] px-2.5 py-1 text-xs font-medium whitespace-nowrap">
                        {rule.feeType === "FLAT" ? "Flat fee" : "Percentage"}
                      </span>
                    </td>
                    <td className="numeric font-medium text-[var(--ink-950)] whitespace-nowrap">
                      {rule.feeType === "FLAT"
                        ? formatCurrency(rule.flatAmount ?? 0, rule.currency)
                        : `${(rule.percentageRate ?? 0).toFixed(2)}%`}
                    </td>
                    <td className="text-[var(--ink-600)]">
                      {rule.propertyId
                        ? `Property ${rule.propertyId.slice(0, 8)}...`
                        : rule.propertyType
                          ? rule.propertyType.toLowerCase().replace("_", " ")
                          : "All property types"}
                    </td>
                    <td>
                      <form action={deactivateCommissionRuleAction}>
                        <input type="hidden" name="id" value={rule.id} />
                        <button
                          type="submit"
                          className="text-sm text-[var(--ink-400)] underline-offset-2 hover:text-red-600 hover:underline whitespace-nowrap"
                        >
                          Remove
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-5 py-5">
            <AdminEmptyState
              title="No commission rules yet"
              description="Add a rule above to start automatically calculating marketer earnings when payments are confirmed."
            />
          </div>
        )}
      </AdminPanel>

      <AdminToolbar>
        <p className="text-sm text-[var(--ink-500)]">
          Commission amounts are calculated automatically when a payment is confirmed via webhook and recorded against the attributed marketer.
          View each marketer&apos;s running total in{" "}
          <a href="/admin/marketers" className="underline underline-offset-2">
            Marketer performance
          </a>
          .
        </p>
      </AdminToolbar>
    </DashboardShell>
  );
}
