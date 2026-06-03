import type { CustomDomainVercelMetadata } from "@/lib/domains/custom-domain";

const VERCEL_API_BASE_URL = "https://api.vercel.com";

type VercelFetch = typeof fetch;

export type VercelDomainIntegrationConfig = {
  apiToken?: string | null;
  projectId?: string | null;
  projectName?: string | null;
  teamId?: string | null;
};

export type VercelDomainRecord = {
  name: string;
  attached: boolean;
  verified?: boolean | null;
  sslReady?: boolean | null;
  misconfigured?: boolean | null;
  error?: string | null;
};

export type VercelDomainSyncResult = {
  configured: boolean;
  attached: boolean;
  manualSetupRequired: boolean;
  apexDomain: string;
  wwwDomain: string | null;
  domains: VercelDomainRecord[];
  error?: string | null;
};

type VercelProjectDomainResponse = {
  name?: string;
  verified?: boolean;
  error?: {
    code?: string;
    message?: string;
  };
};

type VercelDomainConfigResponse = {
  configuredBy?: string | null;
  misconfigured?: boolean;
  error?: {
    code?: string;
    message?: string;
  };
};

function getProjectIdOrName(config: VercelDomainIntegrationConfig) {
  return config.projectId?.trim() || config.projectName?.trim() || null;
}

function hasVercelDomainConfig(config: VercelDomainIntegrationConfig) {
  return Boolean(config.apiToken?.trim() && getProjectIdOrName(config));
}

function appendTeamId(url: URL, teamId?: string | null) {
  const normalizedTeamId = teamId?.trim();
  if (normalizedTeamId) {
    url.searchParams.set("teamId", normalizedTeamId);
  }
  return url;
}

function buildProjectDomainUrl(
  config: VercelDomainIntegrationConfig,
  domain?: string,
  apiVersion: "v9" | "v10" = "v9",
) {
  const projectIdOrName = getProjectIdOrName(config);
  if (!projectIdOrName) {
    throw new Error("Vercel project id or name is required.");
  }

  const path = domain
    ? `/${apiVersion}/projects/${encodeURIComponent(projectIdOrName)}/domains/${encodeURIComponent(domain)}`
    : `/${apiVersion}/projects/${encodeURIComponent(projectIdOrName)}/domains`;
  return appendTeamId(new URL(path, VERCEL_API_BASE_URL), config.teamId);
}

function buildDomainConfigUrl(config: VercelDomainIntegrationConfig, domain: string) {
  return appendTeamId(
    new URL(`/v6/domains/${encodeURIComponent(domain)}/config`, VERCEL_API_BASE_URL),
    config.teamId,
  );
}

function authorizationHeaders(config: VercelDomainIntegrationConfig) {
  return {
    Authorization: `Bearer ${config.apiToken}`,
    "Content-Type": "application/json",
  };
}

function getDomainError(payload: VercelProjectDomainResponse | VercelDomainConfigResponse | null) {
  return payload?.error?.message ?? payload?.error?.code ?? null;
}

function isApexDomain(domain: string) {
  return !domain.startsWith("www.") && domain.split(".").length === 2;
}

export function getVercelDomainAliases(domain: string) {
  const normalized = domain.trim().toLowerCase().replace(/\.$/, "");
  if (!normalized) {
    return { apexDomain: normalized, wwwDomain: null, domains: [] as string[] };
  }

  if (normalized.startsWith("www.")) {
    const apexDomain = normalized.slice(4);
    return { apexDomain, wwwDomain: normalized, domains: [normalized] };
  }

  const wwwDomain = isApexDomain(normalized) ? `www.${normalized}` : null;
  return {
    apexDomain: normalized,
    wwwDomain,
    domains: wwwDomain ? [normalized, wwwDomain] : [normalized],
  };
}

async function readJson<T>(response: Response): Promise<T | null> {
  return response.json().catch(() => null) as Promise<T | null>;
}

export async function getVercelProjectDomain(
  domain: string,
  config: VercelDomainIntegrationConfig,
  fetcher: VercelFetch = fetch,
): Promise<VercelDomainRecord> {
  if (!hasVercelDomainConfig(config)) {
    return {
      name: domain,
      attached: false,
      error: "Vercel API not configured.",
    };
  }

  const response = await fetcher(buildProjectDomainUrl(config, domain, "v9"), {
    method: "GET",
    headers: authorizationHeaders(config),
  });
  const payload = await readJson<VercelProjectDomainResponse>(response);

  if (!response.ok) {
    return {
      name: domain,
      attached: false,
      error: getDomainError(payload) ?? `Vercel returned ${response.status}.`,
    };
  }

  const configResponse = await fetcher(buildDomainConfigUrl(config, domain), {
    method: "GET",
    headers: authorizationHeaders(config),
  });
  const configPayload = await readJson<VercelDomainConfigResponse>(configResponse);
  const misconfigured = configPayload?.misconfigured ?? null;
  const verified = payload?.verified ?? null;

  return {
    name: payload?.name ?? domain,
    attached: true,
    verified,
    misconfigured,
    sslReady: verified === true && misconfigured !== true,
    error: !configResponse.ok ? getDomainError(configPayload) ?? `Vercel config returned ${configResponse.status}.` : null,
  };
}

async function addSingleVercelProjectDomain(
  domain: string,
  config: VercelDomainIntegrationConfig,
  fetcher: VercelFetch,
) {
  const existing = await getVercelProjectDomain(domain, config, fetcher);
  if (existing.attached) {
    return existing;
  }

  const response = await fetcher(buildProjectDomainUrl(config, undefined, "v10"), {
    method: "POST",
    headers: authorizationHeaders(config),
    body: JSON.stringify({ name: domain }),
  });
  const payload = await readJson<VercelProjectDomainResponse>(response);

  if (!response.ok) {
    const error = getDomainError(payload) ?? `Vercel returned ${response.status}.`;
    if ((response.status === 400 || response.status === 409) && /already|exists|domain.*project|conflict/i.test(error)) {
      return getVercelProjectDomain(domain, config, fetcher);
    }

    return {
      name: domain,
      attached: false,
      error,
    } satisfies VercelDomainRecord;
  }

  return getVercelProjectDomain(domain, config, fetcher);
}

export async function addVercelProjectDomainsForTenant(
  domain: string,
  config: VercelDomainIntegrationConfig,
  fetcher: VercelFetch = fetch,
): Promise<VercelDomainSyncResult> {
  const aliases = getVercelDomainAliases(domain);
  if (!hasVercelDomainConfig(config)) {
    return {
      configured: false,
      attached: false,
      manualSetupRequired: true,
      apexDomain: aliases.apexDomain,
      wwwDomain: aliases.wwwDomain,
      domains: aliases.domains.map((name) => ({
        name,
        attached: false,
        error: "Vercel API not configured. Add this domain manually in Vercel.",
      })),
      error: "Vercel API not configured. Add this domain manually in Vercel.",
    };
  }

  const domains = await Promise.all(
    aliases.domains.map((name) => addSingleVercelProjectDomain(name, config, fetcher)),
  );

  return {
    configured: true,
    attached: domains.length > 0 && domains.every((record) => record.attached),
    manualSetupRequired: false,
    apexDomain: aliases.apexDomain,
    wwwDomain: aliases.wwwDomain,
    domains,
    error: domains.find((record) => record.error)?.error ?? null,
  };
}

export async function checkVercelProjectDomainsForTenant(
  domain: string,
  config: VercelDomainIntegrationConfig,
  fetcher: VercelFetch = fetch,
): Promise<VercelDomainSyncResult> {
  const aliases = getVercelDomainAliases(domain);
  if (!hasVercelDomainConfig(config)) {
    return {
      configured: false,
      attached: false,
      manualSetupRequired: true,
      apexDomain: aliases.apexDomain,
      wwwDomain: aliases.wwwDomain,
      domains: aliases.domains.map((name) => ({
        name,
        attached: false,
        error: "Vercel API not configured. Add this domain manually in Vercel.",
      })),
      error: "Vercel API not configured. Add this domain manually in Vercel.",
    };
  }

  const domains = await Promise.all(
    aliases.domains.map((name) => getVercelProjectDomain(name, config, fetcher)),
  );

  return {
    configured: true,
    attached: domains.length > 0 && domains.every((record) => record.attached),
    manualSetupRequired: false,
    apexDomain: aliases.apexDomain,
    wwwDomain: aliases.wwwDomain,
    domains,
    error: domains.find((record) => record.error)?.error ?? null,
  };
}

export async function removeVercelProjectDomainsForTenant(
  domain: string,
  config: VercelDomainIntegrationConfig,
  fetcher: VercelFetch = fetch,
): Promise<VercelDomainSyncResult> {
  const aliases = getVercelDomainAliases(domain);
  if (!hasVercelDomainConfig(config)) {
    return {
      configured: false,
      attached: false,
      manualSetupRequired: true,
      apexDomain: aliases.apexDomain,
      wwwDomain: aliases.wwwDomain,
      domains: aliases.domains.map((name) => ({
        name,
        attached: false,
        error: "Vercel API not configured.",
      })),
      error: "Vercel API not configured.",
    };
  }

  const domains = await Promise.all(
    aliases.domains.map(async (name) => {
      const response = await fetcher(buildProjectDomainUrl(config, name, "v9"), {
        method: "DELETE",
        headers: authorizationHeaders(config),
      });

      if (response.status === 404) {
        return { name, attached: false, error: null } satisfies VercelDomainRecord;
      }

      const payload = await readJson<VercelProjectDomainResponse>(response);
      return {
        name,
        attached: false,
        error: response.ok ? null : getDomainError(payload) ?? `Vercel returned ${response.status}.`,
      } satisfies VercelDomainRecord;
    }),
  );

  return {
    configured: true,
    attached: false,
    manualSetupRequired: false,
    apexDomain: aliases.apexDomain,
    wwwDomain: aliases.wwwDomain,
    domains,
    error: domains.find((record) => record.error)?.error ?? null,
  };
}

export function toCustomDomainVercelMetadata(
  result: VercelDomainSyncResult,
  timestamp = new Date(),
  mode: "sync" | "verify" = "sync",
): CustomDomainVercelMetadata {
  const metadata: CustomDomainVercelMetadata = {
    configured: result.configured,
    attached: result.attached,
    manualSetupRequired: result.manualSetupRequired,
    apexDomain: result.apexDomain,
    wwwDomain: result.wwwDomain,
    error: result.error ?? null,
    domains: result.domains.map((domain) => ({
      name: domain.name,
      attached: domain.attached,
      verified: domain.verified ?? null,
      sslReady: domain.sslReady ?? null,
      misconfigured: domain.misconfigured ?? null,
      error: domain.error ?? null,
    })),
  };

  if (mode === "sync") {
    metadata.lastSyncedAt = timestamp.toISOString();
  } else {
    metadata.lastVerifiedAt = timestamp.toISOString();
  }

  return metadata;
}
