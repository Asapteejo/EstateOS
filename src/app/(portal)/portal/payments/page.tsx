import { DashboardShell } from "@/components/portal/dashboard-shell";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requirePortalSession } from "@/lib/auth/guards";
import { formatCurrency } from "@/lib/utils";
import { getBuyerPaymentExperience } from "@/modules/portal/queries";

export default async function PortalPaymentsPage() {
  const tenant = await requirePortalSession();
  const paymentExperience = await getBuyerPaymentExperience(tenant);

  return (
    <DashboardShell area="portal" title="Payments" subtitle="Verified payments, receipts, and provider-level tracking live here.">
      <div className="grid gap-6 md:grid-cols-4">
        <Card className="p-6">
          <div className="text-sm text-[var(--ink-500)]">Total payable</div>
          <div className="mt-3 text-2xl font-semibold text-[var(--ink-950)]">
            {formatCurrency(paymentExperience.progress.totalPayableAmount)}
          </div>
        </Card>
        <Card className="p-6">
          <div className="text-sm text-[var(--ink-500)]">Paid so far</div>
          <div className="mt-3 text-2xl font-semibold text-[var(--ink-950)]">
            {formatCurrency(paymentExperience.progress.amountPaidSoFar)}
          </div>
        </Card>
        <Card className="p-6">
          <div className="text-sm text-[var(--ink-500)]">Outstanding balance</div>
          <div className="mt-3 text-2xl font-semibold text-[var(--ink-950)]">
            {formatCurrency(paymentExperience.progress.outstandingBalance)}
          </div>
        </Card>
        <Card className="p-6">
          <div className="text-sm text-[var(--ink-500)]">Selected marketer</div>
          <div className="mt-3 text-2xl font-semibold text-[var(--ink-950)]">
            {paymentExperience.selectedMarketer ?? "Unassigned"}
          </div>
        </Card>
      </div>

      <Card className="p-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-[var(--ink-950)]">Payment progress</h2>
            <p className="mt-2 text-sm text-[var(--ink-600)]">
              Current-state rendering from persisted payment and installment records. This is not websocket-based realtime.
            </p>
          </div>
          <div className="text-sm font-medium text-[var(--brand-700)]">
            {paymentExperience.progress.progressPercent}% complete
          </div>
        </div>
        <div className="mt-5 h-3 rounded-full bg-[var(--sand-100)]">
          <div
            className="h-3 rounded-full bg-[var(--brand-700)]"
            style={{ width: `${paymentExperience.progress.progressPercent}%` }}
          />
        </div>
        <div className="mt-6 grid gap-3">
          {paymentExperience.progress.installmentSchedule.map((installment) => (
            <div key={installment.title} className="rounded-2xl bg-[var(--sand-100)] px-4 py-4 text-sm text-[var(--ink-700)]">
              <div className="flex items-center justify-between gap-4">
                <div className="font-semibold text-[var(--ink-950)]">{installment.title}</div>
                <div className="capitalize">{installment.status}</div>
              </div>
              <div className="mt-2">{formatCurrency(installment.amount)}</div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="p-8">
          <h2 className="text-2xl font-semibold text-[var(--ink-950)]">Payment history</h2>
          <div className="mt-5 space-y-3">
            {paymentExperience.payments.map((payment) => (
              <div key={payment.reference} className="rounded-2xl bg-[var(--sand-100)] px-4 py-4 text-sm text-[var(--ink-700)]">
                <div className="flex items-center justify-between gap-4">
                  <div className="font-semibold text-[var(--ink-950)]">{payment.reference}</div>
                  <div>{payment.status}</div>
                </div>
                <div className="mt-2 flex flex-wrap gap-4">
                  <span>{payment.amount}</span>
                  <span>{payment.method}</span>
                </div>
                {payment.receiptHref ? (
                  <div className="mt-4">
                    <Link href={payment.receiptHref}>
                      <Button variant="outline" size="sm">
                        Open receipt
                      </Button>
                    </Link>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-8">
          <h2 className="text-2xl font-semibold text-[var(--ink-950)]">Receipts</h2>
          <p className="mt-2 text-sm text-[var(--ink-600)]">
            Final branded receipts are private and rendered per tenant identity.
          </p>
          <div className="mt-5 space-y-3">
            {paymentExperience.receipts.map((receipt) => (
              <div key={receipt.id} className="rounded-2xl bg-[var(--sand-100)] px-4 py-4 text-sm text-[var(--ink-700)]">
                <div className="font-semibold text-[var(--ink-950)]">{receipt.receiptNumber}</div>
                <div className="mt-2 flex flex-wrap gap-4">
                  <span>{receipt.amount}</span>
                  <span>{receipt.issuedAt}</span>
                </div>
                <div className="mt-4">
                  <Link href={receipt.downloadHref}>
                    <Button variant="outline" size="sm">
                      Download branded receipt
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </DashboardShell>
  );
}
