import type { CustomDomainStatus } from "@prisma/client";

import { env } from "@/lib/env";
import { resolveTenantPublicUrl, buildServerDomainConfig } from "@/lib/domains";

export type CompanyDomainInfo = {
  slug: string;
  subdomain?: string | null;
  customDomain?: string | null;
  customDomainStatus?: CustomDomainStatus | null;
};

/**
 * Returns the canonical public URL for a company.
 * Uses the verified custom domain when available, falls back to subdomain/slug.
 */
export function resolveCompanyPublicUrl(
  company: CompanyDomainInfo,
  pathname = "/",
): string {
  const config = buildServerDomainConfig(env);
  const useCustomDomain =
    company.customDomain && company.customDomainStatus === "VERIFIED";

  return resolveTenantPublicUrl(config, {
    pathname,
    companySlug: useCustomDomain ? null : (company.subdomain ?? company.slug),
    customDomain: useCustomDomain ? company.customDomain : null,
  });
}

/**
 * Returns the "display" URL label shown in UI (without protocol).
 */
export function getCompanyPublicUrlLabel(company: CompanyDomainInfo): string {
  if (company.customDomain && company.customDomainStatus === "VERIFIED") {
    return company.customDomain;
  }

  const config = buildServerDomainConfig(env);
  const slug = company.subdomain ?? company.slug;
  const base = new URL(config.platformBaseUrl);
  const host = base.hostname;

  if (host === "localhost" || host === "127.0.0.1") {
    const port = base.port ? `:${base.port}` : "";
    return `${slug}.localhost${port}`;
  }

  return `${slug}.${host}`;
}
