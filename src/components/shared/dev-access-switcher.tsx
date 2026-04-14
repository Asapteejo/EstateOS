import { cookies } from "next/headers";
import { headers } from "next/headers";

import {
  DEV_SESSION_COOKIE,
  getPreferredTenantSiteCompanySlug,
} from "@/lib/auth/session";
import { featureFlags } from "@/lib/env";
import {
  buildDevTenantSiteUrl,
  DEV_ACCESS_PRESETS,
} from "@/components/shared/dev-access";
import { DevAccessPanel } from "@/components/shared/dev-access-panel";

export async function DevAccessSwitcher() {
  if (!featureFlags.allowDevBypass) {
    return null;
  }

  const cookieStore = await cookies();
  const headerStore = await headers();
  const activeRole = cookieStore.get(DEV_SESSION_COOKIE)?.value ?? "route-default";
  const companySlug = await getPreferredTenantSiteCompanySlug();
  const host = headerStore.get("host");
  const protocol =
    headerStore.get("x-forwarded-proto") === "https" ? "https" : "http";
  const tenantSiteHref = buildDevTenantSiteUrl({
    currentHost: host,
    currentProtocol: protocol,
    companySlug,
  });

  return (
    <DevAccessPanel
      activeRole={activeRole}
      tenantSiteHref={tenantSiteHref}
      presets={DEV_ACCESS_PRESETS}
    />
  );
}
