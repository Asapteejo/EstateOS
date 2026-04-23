export type PostHogSeverity = "LOW" | "MEDIUM" | "HIGH";
export type PostHogSource =
  | "client"
  | "api"
  | "webhook"
  | "auth"
  | "payment"
  | "support"
  | "system";
export type PostHogEventGroup =
  | "exception"
  | "support"
  | "payment"
  | "auth"
  | "webhook"
  | "system"
  | "client";
export type PostHogFingerprintType = "exception" | "event";
export const POSTHOG_EVENT_VERSION = "v1";

function stableHashNumber(input: string) {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }

  return hash >>> 0;
}

function normalizeFingerprintSegment(value: string) {
  return value
    .trim()
    .toLowerCase()
    // Fingerprints should stay stable across noisy runtime data. These replacements
    // intentionally normalize only high-variance values that do not change the class
    // of the event: query strings, UUIDs, long tokens, emails, timestamps, and long
    // numeric identifiers. Shorter numeric values remain intact so status-like values
    // such as 401, 404, 422, and 500 can still produce distinct fingerprints.
    .replace(/https?:\/\/[^\s?#]+(?:\?[^\s#]*)?(?:#[^\s]*)?/g, (match) =>
      match.replace(/[?#].*$/, ""),
    )
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi, "<uuid>")
    .replace(/\b[a-f0-9]{16,}\b/gi, "<token>")
    .replace(/\b[A-Za-z0-9_-]{24,}\b/g, "<token>")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "<email>")
    .replace(/\b\d{4}-\d{2}-\d{2}t\d{2}:\d{2}:\d{2}(?:\.\d+)?z\b/gi, "<timestamp>")
    .replace(/\b\d{5,}\b/g, "<n>")
    .replace(/\s+/g, " ");
}

export function normalizeFingerprintInput(value: string) {
  return normalizeFingerprintSegment(value);
}

export function buildStableFingerprint(input: string) {
  return stableHashNumber(normalizeFingerprintInput(input)).toString(36);
}

export function buildStableFingerprintHint(value: string) {
  return stableHashNumber(value).toString(36);
}

export function buildFingerprintFromParts(parts: Array<unknown>) {
  return buildStableFingerprint(
    parts
      .filter((part) => part != null && part !== "")
      .map((part) => normalizeFingerprintInput(String(part)))
      .join(":"),
  );
}

export function normalizeFingerprintEnvironment(environment: string | null | undefined) {
  const normalized = (environment ?? "").trim().toLowerCase();
  if (!normalized) {
    return "unknown";
  }

  if (normalized === "production") {
    return "production";
  }

  if (normalized === "preview") {
    return "preview";
  }

  if (normalized === "test") {
    return "test";
  }

  return "development";
}

export function inferEventGroup(input: {
  event: string;
  source?: PostHogSource | null;
}) {
  if (input.event === "estateos_client_exception" || input.event === "estateos_server_exception") {
    return "exception" as const;
  }

  switch (input.source) {
    case "support":
      return "support";
    case "payment":
      return "payment";
    case "auth":
      return "auth";
    case "webhook":
      return "webhook";
    case "client":
      return "client";
    case "api":
    case "system":
    default:
      return "system";
  }
}

export function inferFingerprintType(event: string): PostHogFingerprintType {
  if (event === "estateos_client_exception" || event === "estateos_server_exception") {
    return "exception";
  }

  return "event";
}

export function shouldSample(
  rate: number | null | undefined,
  key: string,
  options?: {
    debug?: boolean;
    debugLabel?: string;
  },
) {
  if (rate == null) {
    return true;
  }

  if (rate <= 0) {
    if (options?.debug) {
      console.debug("PostHog sampled out", {
        label: options.debugLabel ?? null,
        key,
        rate,
      });
    }
    return false;
  }

  if (rate >= 1) {
    return true;
  }

  const decision = stableHashNumber(key) / 4294967295 < rate;

  if (!decision && options?.debug) {
    console.debug("PostHog sampled out", {
      label: options.debugLabel ?? null,
      key,
      rate,
    });
  }

  return decision;
}
