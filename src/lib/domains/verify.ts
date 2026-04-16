import dns from "dns/promises";

const VERCEL_CNAME_TARGET = "cname.vercel-dns.com";

export type DomainVerificationResult =
  | { verified: true }
  | { verified: false; reason: string };

export async function verifyDomainCname(domain: string): Promise<DomainVerificationResult> {
  const normalized = domain.trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0] ?? "";

  if (!normalized || !/^[a-z0-9.-]+$/.test(normalized)) {
    return { verified: false, reason: "Invalid domain format." };
  }

  try {
    const records = await dns.resolveCname(normalized);
    const pointsToVercel = records.some((r) =>
      r.toLowerCase().includes("vercel") || r.toLowerCase() === VERCEL_CNAME_TARGET,
    );

    if (pointsToVercel) {
      return { verified: true };
    }

    return {
      verified: false,
      reason: `CNAME found but does not point to ${VERCEL_CNAME_TARGET}. Found: ${records.join(", ")}`,
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
          reason: `Domain resolves via A record but no CNAME pointing to ${VERCEL_CNAME_TARGET} was found.`,
        };
      } catch {
        return { verified: false, reason: "Domain does not resolve." };
      }
    }

    return { verified: false, reason: "DNS lookup failed. Try again in a few minutes." };
  }
}
