import dns from "dns/promises";

import {
  DEFAULT_CUSTOM_DOMAIN_CNAME_TARGET,
  DEFAULT_CUSTOM_DOMAIN_ROOT_TARGET,
} from "@/lib/domains/custom-domain";

export type DomainVerificationResult =
  | { verified: true }
  | { verified: false; reason: string };

export type DnsResolver = {
  resolve4(domain: string): Promise<string[]>;
  resolveCname(domain: string): Promise<string[]>;
};

export type TenantDomainDnsVerification = {
  verified: boolean;
  reason: string | null;
  apexDomain: string;
  wwwDomain: string | null;
  apex: {
    verified: boolean;
    expected: string;
    found: string[];
    reason: string | null;
  };
  www: {
    verified: boolean;
    expected: string;
    found: string[];
    reason: string | null;
  } | null;
};

function normalizeDnsName(value: string) {
  return value.trim().toLowerCase().replace(/\.$/, "");
}

function getApexAndWww(domain: string) {
  const normalized = normalizeDnsName(domain);
  if (normalized.startsWith("www.")) {
    return { apexDomain: normalized.slice(4), wwwDomain: normalized };
  }

  return {
    apexDomain: normalized,
    wwwDomain: normalized.split(".").length === 2 ? `www.${normalized}` : null,
  };
}

function recordMatchesTarget(record: string, expected: string) {
  const normalizedRecord = normalizeDnsName(record);
  const normalizedExpected = normalizeDnsName(expected);
  return normalizedRecord === normalizedExpected || normalizedRecord.includes("vercel");
}

export async function verifyDomainCname(
  domain: string,
  expectedTarget = DEFAULT_CUSTOM_DOMAIN_CNAME_TARGET,
): Promise<DomainVerificationResult> {
  const normalized = domain.trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0] ?? "";
  const target = expectedTarget.trim().toLowerCase() || DEFAULT_CUSTOM_DOMAIN_CNAME_TARGET;

  if (!normalized || !/^[a-z0-9.-]+$/.test(normalized)) {
    return { verified: false, reason: "Invalid domain format." };
  }

  try {
    const records = await dns.resolveCname(normalized);
    const pointsToVercel = records.some((r) =>
      r.toLowerCase().includes("vercel") || r.toLowerCase() === target,
    );

    if (pointsToVercel) {
      return { verified: true };
    }

    return {
      verified: false,
      reason: `CNAME found but does not point to ${target}. Found: ${records.join(", ")}`,
    };
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;

    if (code === "ENOTFOUND" || code === "ENODATA") {
      return { verified: false, reason: "No CNAME record found for this domain." };
    }

    if (code === "ENOENT") {
      // Some resolvers use ENOENT for "no records of this type"
      // Fall back to A record check
      try {
        await dns.resolve4(normalized);
        return {
          verified: false,
          reason: `Domain resolves via A record but no CNAME pointing to ${target} was found.`,
        };
      } catch {
        return { verified: false, reason: "Domain does not resolve." };
      }
    }

    return { verified: false, reason: "DNS lookup failed. Try again in a few minutes." };
  }
}

export async function verifyTenantDomainDns(
  domain: string,
  input?: {
    cnameTarget?: string | null;
    rootTarget?: string | null;
    resolver?: DnsResolver;
  },
): Promise<TenantDomainDnsVerification> {
  const { apexDomain, wwwDomain } = getApexAndWww(domain);
  const resolver = input?.resolver ?? dns;
  const rootTarget = input?.rootTarget?.trim() || DEFAULT_CUSTOM_DOMAIN_ROOT_TARGET;
  const cnameTarget = input?.cnameTarget?.trim() || DEFAULT_CUSTOM_DOMAIN_CNAME_TARGET;

  const apex = {
    verified: false,
    expected: rootTarget,
    found: [] as string[],
    reason: null as string | null,
  };
  const www = wwwDomain
    ? {
        verified: false,
        expected: cnameTarget,
        found: [] as string[],
        reason: null as string | null,
      }
    : null;

  try {
    const records = await resolver.resolve4(apexDomain);
    apex.found = records;
    apex.verified = records.includes(rootTarget);
    apex.reason = apex.verified
      ? null
      : `A record for ${apexDomain} must point to ${rootTarget}. Found: ${records.join(", ") || "none"}.`;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    apex.reason =
      code === "ENOTFOUND" || code === "ENODATA" || code === "ENOENT"
        ? `No A record found for ${apexDomain}.`
        : `A record lookup failed for ${apexDomain}.`;
  }

  if (wwwDomain && www) {
    try {
      const records = await resolver.resolveCname(wwwDomain);
      www.found = records;
      www.verified = records.some((record) => recordMatchesTarget(record, cnameTarget));
      www.reason = www.verified
        ? null
        : `CNAME for ${wwwDomain} must point to ${cnameTarget}. Found: ${records.join(", ") || "none"}.`;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      www.reason =
        code === "ENOTFOUND" || code === "ENODATA" || code === "ENOENT"
          ? `No CNAME record found for ${wwwDomain}.`
          : `CNAME lookup failed for ${wwwDomain}.`;
    }
  }

  const verified = apex.verified && (www?.verified ?? true);
  return {
    verified,
    reason: verified
      ? null
      : [apex.reason, www?.reason].filter(Boolean).join(" "),
    apexDomain,
    wwwDomain,
    apex,
    www,
  };
}
