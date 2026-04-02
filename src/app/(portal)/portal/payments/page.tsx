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
      <div className="grid gap-6 md:grid-cols-5">
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
          <div className="text-sm text-[var(--ink-500)]">Payment state</div>
          <div className="mt-3 text-2xl font-semibold text-[var(--ink-950)]">
            {paymentExperience.paymentStatus}
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
            {paymentExperience.nextDueDate ? (
              <p className="mt-2 text-sm font-medium text-[var(--brand-700)]">
                Next due date: {paymentExperience.nextDueDate}
              </p>
            ) : null}
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
                {installment.dueDate ? (
                  <div className="mt-1 text-xs uppercase tracking-[0.16em] text-[var(--ink-500)]">
                    Due {installment.dueDate}
                  </div>
                ) : null}
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
          <h2 className="text-2xl font-semibold text-[var(--ink-950)]">Outstanding payment requests</h2>
          <p className="mt-2 text-sm text-[var(--ink-600)]">
            Admin-created payment requests appear here with the exact amount due and any transfer instructions returned by the provider.
          </p>
          <div className="mt-5 space-y-3">
            {paymentExperience.paymentRequests.map((request) => (
              <div key={request.id} className="rounded-2xl bg-[var(--sand-100)] px-4 py-4 text-sm text-[var(--ink-700)]">
                <div className="flex items-center justify-between gap-4">
                  <div className="font-semibold text-[var(--ink-950)]">{request.title}</div>
                  <div>{request.status}</div>
                </div>
                <div className="mt-2 flex flex-wrap gap-4">
                  <span>{request.amount}</span>
                  <span>{request.collectionMethod}</span>
                  {request.dueAt ? <span>Due {request.dueAt}</span> : null}
                </div>
                {request.transferSummary ? <p className="mt-3">{request.transferSummary}</p> : null}
                {request.notes ? <p className="mt-2 text-[var(--ink-500)]">{request.notes}</p> : null}
                <div className="mt-4 flex flex-wrap gap-3">
                  {request.checkoutUrl ? (
                    <a href={request.checkoutUrl} target="_blank" rel="noreferrer">
                      <Button variant="outline" size="sm">
                        Open payment instructions
                      </Button>
                    </a>
                  ) : null}
                  {request.reference ? <span className="text-xs uppercase tracking-[0.16em] text-[var(--ink-500)]">{request.reference}</span> : null}
                </div>
              </div>
            ))}
            {paymentExperience.paymentRequests.length === 0 ? (
              <p className="text-sm text-[var(--ink-500)]">No outstanding payment requests yet.</p>
            ) : null}
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
