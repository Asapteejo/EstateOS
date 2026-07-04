import { AuthProviders } from "@/components/providers/auth-providers";
import { Container } from "@/components/shared/container";
import { Card } from "@/components/ui/card";
import { getAppSession } from "@/lib/auth/session";
import {
  buildAuthRedirect,
  buildPublicDomainConfig,
  sanitizeReturnPath,
  sanitizeTenantHost,
  sanitizeTenantSlug,
} from "@/lib/domains";
import { publicEnv } from "@/lib/public-env";
import { featureFlags } from "@/lib/env";
import { AuthAccessActions } from "./auth-access-actions";

function readParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : null;
}

function resolveEntryLabel(entry: string | null) {
  return entry === "admin" ? "Tenant Admin" : "Buyer Portal";
}

function resolveSafeDashboard(input: string | null) {
  if (
    input === "/superadmin" ||
    input === "/admin" ||
    input === "/portal" ||
    input === "/app/onboarding"
  ) {
    return input;
  }

  return "/app/onboarding";
}

export default async function AuthAccessPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const entry = readParam(params.entry) === "admin" ? "admin" : "buyer";
  const returnTo = sanitizeReturnPath(readParam(params.returnTo), entry === "admin" ? "/admin" : "/portal");
  const tenantSlug = sanitizeTenantSlug(readParam(params.tenant));
  const tenantHost = sanitizeTenantHost(readParam(params.host));
  const companyName = readParam(params.company) ?? tenantSlug ?? tenantHost ?? "this tenant";
  const session = await getAppSession();
  const email = session?.email || "your current account";
  const currentDashboard = resolveSafeDashboard(readParam(params.current));
  const domainConfig = buildPublicDomainConfig(publicEnv);
  const switchAccountUrl = buildAuthRedirect(domainConfig, {
    returnTo,
    tenantSlug,
    tenantHost,
    entry,
  });
  const entryLabel = resolveEntryLabel(entry);

  return (
    <AuthProviders disableClerkForDev={featureFlags.allowDevBypass}>
      <main className="min-h-dvh bg-[var(--sand-50)] px-4 py-16">
        <Container className="max-w-3xl">
          <Card className="overflow-hidden rounded-[32px] border-[var(--line)] bg-white shadow-[0_20px_70px_rgba(15,23,42,0.08)]">
            <div className="border-b border-[var(--line)] bg-[linear-gradient(135deg,rgba(15,23,42,0.06),rgba(166,28,28,0.06))] px-8 py-8">
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--danger-700)]">
                Account switch required
              </div>
              <h1 className="mt-3 text-3xl font-semibold tracking-[-0.02em] text-[var(--ink-950)]">
                This account does not have {entryLabel} access to {companyName}.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--ink-600)]">
                You are currently signed in as <span className="font-semibold text-[var(--ink-900)]">{email}</span>.
                Access is only granted from persisted tenant membership, not from a
                public-domain host hint or a previous platform owner session.
              </p>
            </div>

            <div className="space-y-6 px-8 py-8">
              <div className="rounded-[24px] border border-[var(--line)] bg-[var(--sand-50)] p-5">
                <div className="text-sm font-semibold text-[var(--ink-950)]">Requested access</div>
                <dl className="mt-4 grid gap-3 text-sm text-[var(--ink-600)] sm:grid-cols-2">
                  <div>
                    <dt className="font-semibold text-[var(--ink-900)]">Tenant</dt>
                    <dd>{companyName}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-[var(--ink-900)]">Entry</dt>
                    <dd>{entryLabel}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-[var(--ink-900)]">Return path</dt>
                    <dd>{returnTo}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-[var(--ink-900)]">Tenant host</dt>
                    <dd>{tenantHost ?? "Not provided"}</dd>
                  </div>
                </dl>
              </div>

              <AuthAccessActions
                currentDashboard={currentDashboard}
                switchAccountUrl={switchAccountUrl}
                disableClerkForDev={featureFlags.allowDevBypass}
              />
            </div>
          </Card>
        </Container>
      </main>
    </AuthProviders>
  );
}
