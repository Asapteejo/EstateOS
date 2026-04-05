import Link from "next/link";
import { SignIn } from "@clerk/nextjs";

import { Container } from "@/components/shared/container";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { buildAuthCompletionUrl, buildPublicDomainConfig, sanitizeReturnPath, sanitizeTenantHost, sanitizeTenantSlug } from "@/lib/domains";
import { publicEnv } from "@/lib/public-env";
import { featureFlags } from "@/lib/env";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const returnTo = sanitizeReturnPath(
    typeof params.returnTo === "string" ? params.returnTo : null,
    "/portal",
  );
  const tenant = sanitizeTenantSlug(typeof params.tenant === "string" ? params.tenant : null);
  const tenantHost = sanitizeTenantHost(typeof params.host === "string" ? params.host : null);
  const entry = typeof params.entry === "string" ? params.entry : "buyer";
  const domainConfig = buildPublicDomainConfig(publicEnv);
  const resolvedEntry =
    entry === "admin" || entry === "buyer" || entry === "purchase" || entry === "continue" || entry === "superadmin"
      ? entry
      : "buyer";
  const completionUrl = buildAuthCompletionUrl(domainConfig, {
    returnTo,
    tenantSlug: tenant,
    tenantHost,
    entry: resolvedEntry,
  });
  const buyerDemoCompletionUrl = buildAuthCompletionUrl(domainConfig, {
    returnTo: "/portal",
    tenantSlug: tenant,
    tenantHost,
    entry: "buyer",
  });
  const adminDemoCompletionUrl = buildAuthCompletionUrl(domainConfig, {
    returnTo: "/admin",
    tenantSlug: tenant,
    tenantHost,
    entry: "admin",
  });
  const superadminDemoCompletionUrl = buildAuthCompletionUrl(domainConfig, {
    returnTo: "/superadmin",
    tenantSlug: tenant,
    tenantHost,
    entry: "superadmin",
  });

  return (
    <Container className="flex min-h-[70vh] items-center justify-center py-16">
      {featureFlags.hasClerk ? (
        <SignIn forceRedirectUrl={completionUrl} fallbackRedirectUrl={completionUrl} />
      ) : (
        <Card className="max-w-xl p-8 text-center">
          <h1 className="font-serif text-4xl text-[var(--ink-950)]">Clerk not configured</h1>
          <p className="mt-4 text-sm leading-7 text-[var(--ink-600)]">
            {featureFlags.allowDevBypass
              ? "Local demo mode is explicitly enabled. Add Clerk keys in `.env.local` to enable real signup and login."
              : "Demo bypass is disabled. Add Clerk keys to enable real signup and login, or explicitly opt into local demo bypass for non-production testing."}
          </p>
          <div className="mt-6 flex justify-center gap-4">
            <Link href={domainConfig.platformBaseUrl}>
              <Button variant="ghost">Platform home</Button>
            </Link>
            {featureFlags.allowDevBypass ? (
              <>
                <Link href={`/api/dev/session?role=buyer&redirectTo=${encodeURIComponent(buyerDemoCompletionUrl)}`}>
                  <Button>Open buyer demo</Button>
                </Link>
                <Link href={`/api/dev/session?role=admin&redirectTo=${encodeURIComponent(adminDemoCompletionUrl)}`}>
                  <Button variant="outline">Open admin demo</Button>
                </Link>
                <Link href={`/api/dev/session?role=superadmin&redirectTo=${encodeURIComponent(superadminDemoCompletionUrl)}`}>
                  <Button variant="outline">Open superadmin demo</Button>
                </Link>
              </>
            ) : null}
          </div>
        </Card>
      )}
    </Container>
  );
}
