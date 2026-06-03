import type { Prisma } from "@prisma/client";

export const DEFAULT_CUSTOM_DOMAIN_CNAME_TARGET = "cname.vercel-dns.com";
export const DEFAULT_CUSTOM_DOMAIN_ROOT_TARGET = "Use your DNS provider's ALIAS/ANAME support for estateos.tech";
export const REMOVE_CUSTOM_DOMAIN_CONFIRMATION = "REMOVE_CUSTOM_DOMAIN";

const PRIVATE_SUFFIXES = [
  ".local",
  ".localhost",
  ".internal",
  ".test",
  ".invalid",
  ".example",
];

export type CustomDomainSetupMetadata = {
  customDomainSetup?: {
    intentionallySkipped?: boolean;
    skippedAt?: string;
    skippedByUserId?: string | null;
    skippedBy?: "tenant_admin" | "superadmin";
  };
};

export function normalizeCustomDomain(input: string | null | undefined) {
  const raw = input?.trim().toLowerCase() ?? "";
  if (!raw) return null;
  if (/^[a-z]+:\/\//i.test(raw)) {
    throw new Error("Enter only the domain name, without a protocol.");
  }
  const withoutProtocol = raw;

  if (/[/?#]/.test(withoutProtocol)) {
    throw new Error("Enter only the domain name, without paths, query strings, or fragments.");
  }

  const domain = withoutProtocol.replace(/\.$/, "");
  if (
    domain === "localhost" ||
    domain.endsWith(".localhost") ||
    PRIVATE_SUFFIXES.some((suffix) => domain.endsWith(suffix)) ||
    /^(\d{1,3}\.){3}\d{1,3}$/.test(domain) ||
    /^(10|127)\./.test(domain) ||
    /^192\.168\./.test(domain) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(domain)
  ) {
    throw new Error("Local, internal, private, and IP-address domains are not allowed.");
  }

  if (!/^(?!-)(?:[a-z0-9-]{1,63}\.)+[a-z]{2,63}$/.test(domain)) {
    throw new Error("Enter a valid public domain, for example www.yourcompany.com.");
  }

  return domain;
}

export function assertDomainAssignable(input: {
  requestedDomain: string;
  targetCompanyId: string;
  conflictCompanyId?: string | null;
}) {
  if (input.conflictCompanyId && input.conflictCompanyId !== input.targetCompanyId) {
    throw new Error("This domain is already in use by another workspace.");
  }
}

export function readCustomDomainSetupMetadata(value: Prisma.JsonValue | null | undefined) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as CustomDomainSetupMetadata & Record<string, Prisma.JsonValue>;
}

export function isCustomDomainIntentionallySkipped(value: Prisma.JsonValue | null | undefined) {
  return readCustomDomainSetupMetadata(value).customDomainSetup?.intentionallySkipped === true;
}

export function buildDomainMetadataUpdate(input: {
  brandSettings: Prisma.JsonValue | null | undefined;
  intentionallySkipped: boolean;
  actorUserId?: string | null;
  actor: "tenant_admin" | "superadmin";
}) {
  const current = readCustomDomainSetupMetadata(input.brandSettings);
  return {
    ...current,
    customDomainSetup: {
      intentionallySkipped: input.intentionallySkipped,
      skippedAt: input.intentionallySkipped ? new Date().toISOString() : null,
      skippedByUserId: input.intentionallySkipped ? input.actorUserId ?? null : null,
      skippedBy: input.intentionallySkipped ? input.actor : null,
    },
  } satisfies Prisma.InputJsonObject;
}

export function buildCustomDomainDnsInstructions(input?: {
  cnameTarget?: string | null;
  rootTarget?: string | null;
}) {
  return {
    cname: {
      type: "CNAME",
      host: "www",
      target: input?.cnameTarget?.trim() || DEFAULT_CUSTOM_DOMAIN_CNAME_TARGET,
    },
    root: {
      type: "A/ALIAS/ANAME",
      host: "@",
      target: input?.rootTarget?.trim() || DEFAULT_CUSTOM_DOMAIN_ROOT_TARGET,
    },
    note: "Go to your domain provider, create the DNS record, wait for propagation, then click Verify.",
  };
}
