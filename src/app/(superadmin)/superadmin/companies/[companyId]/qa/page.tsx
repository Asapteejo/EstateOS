import Link from "next/link";
import { notFound } from "next/navigation";

import { SuperadminShell } from "@/components/superadmin/superadmin-shell";
import { Card } from "@/components/ui/card";
import { requireSuperAdminSession } from "@/lib/auth/guards";
import { getSuperadminCompanyQaChecklist, type QaCheck, type QaStatus } from "@/modules/superadmin/qa";

const statusStyles: Record<QaStatus, string> = {
  PASS: "bg-emerald-100 text-emerald-800",
  WARN: "bg-amber-100 text-amber-800",
  FAIL: "bg-rose-100 text-rose-800",
};

function StatusBadge({ status }: { status: QaStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyles[status]}`}>
      {status}
    </span>
  );
}

function CheckRow({ check }: { check: QaCheck }) {
  return (
    <div className="grid gap-3 border-t border-[var(--line)] px-5 py-4 md:grid-cols-[120px_220px_1fr] md:items-center">
      <StatusBadge status={check.status} />
      <div className="font-medium text-[var(--ink-900)]">{check.label}</div>
      <div className="text-sm leading-6 text-[var(--ink-600)]">{check.detail}</div>
    </div>
  );
}

export default async function SuperadminCompanyQaPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  await requireSuperAdminSession();

  const { companyId } = await params;
  let qa: Awaited<ReturnType<typeof getSuperadminCompanyQaChecklist>>;

  try {
    qa = await getSuperadminCompanyQaChecklist(companyId);
  } catch {
    notFound();
  }

  return (
    <SuperadminShell
      title={`${qa.company.name} QA checklist`}
      subtitle="Pre-flight readiness for admin walkthroughs, buyer portal testing, real payments, and file uploads."
      actions={
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/superadmin/companies/${companyId}`}
            className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-semibold text-[var(--ink-900)] transition hover:bg-[var(--sand-100)]"
          >
            Back to company
          </Link>
          <Link
            href={qa.adminDevLink}
            className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-semibold text-[var(--ink-900)] transition hover:bg-[var(--sand-100)]"
          >
            Admin dev session
          </Link>
          <Link
            href={qa.buyerDevLink}
            className="rounded-full bg-[var(--brand-700)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--brand-800)]"
          >
            Buyer dev session
          </Link>
        </div>
      }
    >
      <Card className="border-[var(--brand-200)] bg-[var(--sand-50)] p-5">
        <div className="text-xs uppercase tracking-[0.18em] text-[var(--ink-400)]">Next step</div>
        <div className="mt-2 text-lg font-semibold text-[var(--ink-950)]">{qa.nextStep}</div>
        <div className="mt-2 text-sm text-[var(--ink-600)]">
          Tenant slug: <span className="font-semibold">{qa.company.slug}</span> · Billing mode:{" "}
          <span className="font-semibold">{qa.billingMode}</span> · Public preview:{" "}
          <span className="font-semibold">{qa.publicUrl}</span>
        </div>
      </Card>

      <div className="grid gap-6">
        {qa.sections.map((section) => (
          <Card key={section.title} className="overflow-hidden">
            <div className="px-5 py-4">
              <h2 className="text-lg font-semibold text-[var(--ink-950)]">{section.title}</h2>
            </div>
            <div>
              {section.checks.map((check) => (
                <CheckRow key={`${section.title}-${check.label}`} check={check} />
              ))}
            </div>
          </Card>
        ))}
      </div>
    </SuperadminShell>
  );
}
