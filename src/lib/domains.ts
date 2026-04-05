import type { PublicEnv, ServerEnv } from "@/lib/config";

export const TENANT_HINT_COOKIE = "estateos_tenant_hint";

export type DomainRuntimeConfig = {
  appBaseUrl: string;
  platformBaseUrl: string;
  portalBaseUrl: string;
  isProduction: boolean;
};

export type AuthEntryIntent =
  | "buyer"
  | "admin"
  | "purchase"
  | "continue"
  | "superadmin";

function normalizeBaseUrl(input: string) {
  return new URL(input.endsWith("/") ? input : `${input}/`);
}

export function normalizeHost(input: string | null | undefined) {
  if (!input) {
    return null;
  }

  return input.trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0]?.split(":")[0] ?? null;
}

export function sanitizeTenantSlug(input: string | null | undefined) {
  if (!input) {
    return null;
  }

  const value = input.trim().toLowerCase();
  return /^[a-z0-9-]+$/.test(value) ? value : null;
}

export function sanitizeTenantHost(input: string | null | undefined) {
  const value = normalizeHost(input);
  if (!value) {
    return null;
  }

  return /^[a-z0-9.-]+$/.test(value) ? value : null;
}

export function buildServerDomainConfig(env: ServerEnv): DomainRuntimeConfig {
  return {
    appBaseUrl: env.APP_BASE_URL,
    platformBaseUrl: env.PLATFORM_BASE_URL,
    portalBaseUrl: env.PORTAL_BASE_URL,
    isProduction: env.NODE_ENV === "production",
  };
}

export function buildPublicDomainConfig(env: PublicEnv): DomainRuntimeConfig {
  const appBaseUrl = env.NEXT_PUBLIC_APP_URL;
  return {
    appBaseUrl,
    platformBaseUrl: env.NEXT_PUBLIC_PLATFORM_BASE_URL ?? appBaseUrl,
    portalBaseUrl: env.NEXT_PUBLIC_PORTAL_BASE_URL ?? appBaseUrl,
    isProduction: env.NODE_ENV === "production",
  };
}

export function isSafeInternalPath(input: string | null | undefined) {
  if (!input || !input.startsWith("/")) {
    return false;
  }

  return !input.startsWith("//");
}

export function sanitizeReturnPath(input: string | null | undefined, fallback = "/portal") {
  if (!isSafeInternalPath(input)) {
    return fallback;
  }

  return input!;
}

export function getCentralHosts(config: DomainRuntimeConfig) {
  return new Set([
    normalizeHost(config.appBaseUrl),
    normalizeHost(config.platformBaseUrl),
    normalizeHost(config.portalBaseUrl),
  ].filter(Boolean) as string[]);
}

export function isKnownCentralHost(
  host: string | null | undefined,
  config: DomainRuntimeConfig,
) {
  const normalized = normalizeHost(host);
  if (!normalized) {
    return false;
  }

  return getCentralHosts(config).has(normalized);
}

export function resolveTenantSubdomainFromHost(
  host: string | null | undefined,
  config: DomainRuntimeConfig,
) {
  const normalized = normalizeHost(host);
  if (!normalized || isKnownCentralHost(normalized, config)) {
    return null;
  }

  if (normalized.endsWith(".localhost")) {
    const value = normalized.slice(0, -".localhost".length);
    if (value && !value.includes(".")) {
      return sanitizeTenantSlug(value);
    }

    return null;
  }

  const parts = normalized.split(".");
  if (parts.length > 2) {
    return sanitizeTenantSlug(parts[0] ?? null);
  }

  return null;
}

export function shouldAllowDefaultTenantFallback(
  host: string | null | undefined,
  config: DomainRuntimeConfig,
) {
  const normalized = normalizeHost(host);

  if (!config.isProduction) {
    return true;
  }

  if (!normalized) {
    return true;
  }

  return isKnownCentralHost(normalized, config) || normalized === "localhost" || normalized === "127.0.0.1";
}

export function buildReturnUrl(
  config: DomainRuntimeConfig,
  pathname: string,
) {
  const url = new URL(sanitizeReturnPath(pathname), normalizeBaseUrl(config.portalBaseUrl));
  return url.toString();
}

export function resolveSafeRedirectUrl(
  config: DomainRuntimeConfig,
  input: string | null | undefined,
  fallback = "/",
) {
  if (isSafeInternalPath(input)) {
    return new URL(input!, normalizeBaseUrl(config.portalBaseUrl)).toString();
  }

  try {
    const candidate = input ? new URL(input) : null;
    if (candidate && isKnownCentralHost(candidate.host, config)) {
      return candidate.toString();
    }
  } catch {
    // Ignore invalid URL input and return fallback below.
  }

  return new URL(sanitizeReturnPath(fallback, "/"), normalizeBaseUrl(config.portalBaseUrl)).toString();
}

export function resolveCentralAuthUrl(
  config: DomainRuntimeConfig,
  pathname = "/sign-in",
  searchParams?: URLSearchParams,
) {
  const url = new URL(sanitizeReturnPath(pathname, "/sign-in"), normalizeBaseUrl(config.portalBaseUrl));

  if (searchParams) {
    url.search = searchParams.toString();
  }

  return url.toString();
}

export function resolveTenantPublicUrl(
  config: DomainRuntimeConfig,
  input: {
    pathname?: string;
    companySlug?: string | null;
    customDomain?: string | null;
  },
) {
  const pathname = sanitizeReturnPath(input.pathname ?? "/", "/");
  const customDomain = sanitizeTenantHost(input.customDomain);

  if (customDomain) {
    return new URL(pathname, `https://${customDomain}`).toString();
  }

  return new URL(pathname, normalizeBaseUrl(config.platformBaseUrl)).toString();
}

export function buildAuthRedirect(
  config: DomainRuntimeConfig,
  input: {
    returnTo: string;
    tenantSlug?: string | null;
    tenantHost?: string | null;
    entry?: AuthEntryIntent;
  },
) {
  const searchParams = new URLSearchParams();
  searchParams.set("returnTo", sanitizeReturnPath(input.returnTo, "/portal"));

  const tenantSlug = sanitizeTenantSlug(input.tenantSlug);
  const tenantHost = sanitizeTenantHost(input.tenantHost);

  if (tenantSlug) {
    searchParams.set("tenant", tenantSlug);
  }

  if (tenantHost) {
    searchParams.set("host", tenantHost);
  }

  if (input.entry) {
    searchParams.set("entry", input.entry);
  }

  return resolveCentralAuthUrl(config, "/sign-in", searchParams);
}

export function buildAuthCompletionUrl(
  config: DomainRuntimeConfig,
  input: {
    returnTo: string;
    tenantSlug?: string | null;
    tenantHost?: string | null;
    entry?: AuthEntryIntent;
  },
) {
  const searchParams = new URLSearchParams();
  searchParams.set("returnTo", sanitizeReturnPath(input.returnTo, "/portal"));

  const tenantSlug = sanitizeTenantSlug(input.tenantSlug);
  const tenantHost = sanitizeTenantHost(input.tenantHost);

  if (tenantSlug) {
    searchParams.set("tenant", tenantSlug);
  }

  if (tenantHost) {
    searchParams.set("host", tenantHost);
  }

  if (input.entry) {
    searchParams.set("entry", input.entry);
  }

  return resolveCentralAuthUrl(config, "/auth/complete", searchParams);
}

export function defaultReturnPathForEntry(entry: AuthEntryIntent | null | undefined) {
  if (entry === "admin") {
    return "/admin";
  }

  if (entry === "superadmin") {
    return "/superadmin";
  }

  return "/portal";
}
