import Link from "next/link";
import { notFound } from "next/navigation";

import { SuperadminShell } from "@/components/superadmin/superadmin-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireSuperAdminSession } from "@/lib/auth/guards";
import { REMOVE_CUSTOM_DOMAIN_CONFIRMATION } from "@/lib/domains/custom-domain";
import { getCompanyDomainSetup } from "@/modules/domains/service";
import {
  removeSuperadminCompanyDomainAction,
  setSuperadminCompanyDomainAction,
  skipSuperadminCompanyDomainAction,
  verifySuperadminCompanyDomainAction,
} from "./actions";

function readParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function SuperadminCompanyDomainsPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSuperAdminSession();
  const { companyId } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const status = readParam(resolvedSearchParams, "status");
  const error = readParam(resolvedSearchParams, "error");

  let setup: Awaited<ReturnType<typeof getCompanyDomainSetup>>;
  try {
    setup = await getCompanyDomainSetup(companyId);
  } catch {
    notFound();
  }

  return (
    <SuperadminShell
      title={`${setup.company.name} custom domain`}
      subtitle="Assign, verify, remove, or intentionally skip tenant custom domains without editing tenant branding assets."
      actions={
        <Link href={`/superadmin/companies/${companyId}`}>
          <Button variant="secondary">Back to company</Button>
        </Link>
      }
    >
      {error ? (
        <Card className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</Card>
      ) : null}
      {status ? (
        <Card className="border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          Domain action completed: {status}.
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_0.85fr]">
        <Card className="p-6">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--brand-700)]">
              Current routing
            </div>
            <h2 className="mt-3 text-xl font-semibold text-[var(--ink-950)]">
              {setup.company.customDomain ?? "No custom domain assigned"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--ink-600)]">
              Status: {setup.company.customDomainStatus ?? "not configured"}. {setup.routingStatus}
            </p>
            {setup.intentionallySkipped ? (
              <p className="mt-2 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Custom domain setup has been intentionally skipped for this tenant.
              </p>
            ) : null}
          </div>

          <form action={setSuperadminCompanyDomainAction} className="mt-6 space-y-3">
            <input type="hidden" name="companyId" value={companyId} />
            <label className="block text-sm font-medium text-[var(--ink-700)]" htmlFor="customDomain">
              Domain
            </label>
            <input
              id="customDomain"
              name="customDomain"
              defaultValue={setup.company.customDomain ?? ""}
              placeholder="www.example.com"
              className="w-full rounded-xl border border-[var(--line)] px-3 py-2 font-mono text-sm"
            />
            <p className="text-xs leading-5 text-[var(--ink-500)]">
              Enter the hostname only. Protocols, localhost, private IPs, paths, query strings, and
              fragments are rejected.
            </p>
            <Button type="submit">Assign domain</Button>
          </form>

          <div className="mt-6 flex flex-wrap gap-3">
            <form action={verifySuperadminCompanyDomainAction}>
              <input type="hidden" name="companyId" value={companyId} />
              <Button type="submit" variant="secondary" disabled={!setup.company.customDomain}>
                Verify domain
              </Button>
            </form>
            <form action={skipSuperadminCompanyDomainAction}>
              <input type="hidden" name="companyId" value={companyId} />
              <Button type="submit" variant="outline">
                Mark intentionally skipped
              </Button>
            </form>
          </div>
        </Card>

        <Card className="p-6">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--brand-700)]">
            DNS instructions
          </div>
          <div className="mt-4 space-y-4 text-sm text-[var(--ink-700)]">
            <div className="rounded-2xl bg-[var(--sand-100)] p-4">
              <div className="font-semibold text-[var(--ink-950)]">Subdomain / www</div>
              <div className="mt-2 grid gap-2 font-mono text-xs">
                <div>Type: CNAME</div>
                <div>Target: {setup.dns.cname.target}</div>
              </div>
            </div>
            <div className="rounded-2xl bg-[var(--sand-100)] p-4">
              <div className="font-semibold text-[var(--ink-950)]">Root domain</div>
              <p className="mt-2 text-xs leading-5">{setup.dns.root.target}</p>
            </div>
          </div>

          <form action={removeSuperadminCompanyDomainAction} className="mt-6 space-y-3 border-t border-[var(--line)] pt-5">
            <input type="hidden" name="companyId" value={companyId} />
            <label className="block text-sm font-medium text-[var(--ink-700)]" htmlFor="confirmation">
              Remove confirmation
            </label>
            <input
              id="confirmation"
              name="confirmation"
              placeholder={REMOVE_CUSTOM_DOMAIN_CONFIRMATION}
              className="w-full rounded-xl border border-[var(--line)] px-3 py-2 font-mono text-sm"
            />
            <Button
              type="submit"
              variant="outline"
              disabled={!setup.company.customDomain}
              className="border-rose-200 text-rose-700 hover:bg-rose-50"
            >
              Remove domain
            </Button>
          </form>
        </Card>
      </div>
    </SuperadminShell>
  );
}
