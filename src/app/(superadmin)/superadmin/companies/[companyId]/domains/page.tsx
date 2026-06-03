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

function StatusPill({ label, tone }: { label: string; tone: "success" | "warning" | "muted" }) {
  const styles = {
    success: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    warning: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
    muted: "bg-slate-50 text-slate-600 ring-1 ring-slate-200",
  } as const;

  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${styles[tone]}`}>
      {label}
    </span>
  );
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
            {setup.company.customDomain ? (
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl bg-[var(--sand-100)] p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ink-400)]">
                    Vercel
                  </div>
                  <div className="mt-2">
                    <StatusPill
                      tone={setup.vercel?.attached ? "success" : "warning"}
                      label={setup.vercel?.attached ? "Attached" : setup.vercel?.manualSetupRequired ? "Manual setup" : "Not attached"}
                    />
                  </div>
                  <p className="mt-2 text-xs leading-5 text-[var(--ink-500)]">
                    {setup.vercel?.manualSetupRequired
                      ? "Vercel API is not configured. Add the domain manually in Vercel."
                      : "Apex and www aliases are tracked against the Vercel project."}
                  </p>
                </div>
                <div className="rounded-2xl bg-[var(--sand-100)] p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ink-400)]">
                    DNS
                  </div>
                  <div className="mt-2">
                    <StatusPill
                      tone={setup.company.customDomainStatus === "VERIFIED" ? "success" : "warning"}
                      label={setup.company.customDomainStatus === "VERIFIED" ? "Verified" : "Pending"}
                    />
                  </div>
                  <p className="mt-2 text-xs leading-5 text-[var(--ink-500)]">
                    Verification checks apex A and www CNAME records.
                  </p>
                </div>
                <div className="rounded-2xl bg-[var(--sand-100)] p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ink-400)]">
                    SSL
                  </div>
                  <div className="mt-2">
                    <StatusPill
                      tone={setup.vercel?.domains?.some((domain) => domain.sslReady) ? "success" : "muted"}
                      label={setup.vercel?.domains?.some((domain) => domain.sslReady) ? "Ready" : "Pending"}
                    />
                  </div>
                  <p className="mt-2 text-xs leading-5 text-[var(--ink-500)]">
                    Vercel reports SSL readiness after DNS points to the project.
                  </p>
                </div>
              </div>
            ) : null}
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
              <div className="font-semibold text-[var(--ink-950)]">www alias</div>
              <div className="mt-2 grid gap-2 font-mono text-xs">
                <div>Type: CNAME</div>
                <div>Name: www</div>
                <div>Target: {setup.dns.cname.target}</div>
              </div>
            </div>
            <div className="rounded-2xl bg-[var(--sand-100)] p-4">
              <div className="font-semibold text-[var(--ink-950)]">Root domain</div>
              <div className="mt-2 grid gap-2 font-mono text-xs">
                <div>Type: A</div>
                <div>Name: @</div>
                <div>Target: {setup.dns.root.target}</div>
              </div>
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
