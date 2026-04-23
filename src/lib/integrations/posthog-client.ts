"use client";

import { clientFlags, publicEnv } from "@/lib/public-env";
import {
  buildFingerprintFromParts,
  buildStableFingerprintHint,
  normalizeFingerprintEnvironment,
  POSTHOG_EVENT_VERSION,
  shouldSample,
  inferEventGroup,
  inferFingerprintType,
  type PostHogSeverity,
  type PostHogSource,
  type PostHogEventGroup,
} from "@/lib/integrations/posthog-common";

declare global {
  interface Window {
    __estateosPosthogTest?: {
      event: () => Promise<void>;
      exception: () => Promise<void>;
    };
  }
}

let currentUserId: string | null = null;

const POSTHOG_CAPTURE_PATH = "/capture/";

function inferArea(pathname?: string | null) {
  if (!pathname) {
    return "unknown";
  }

  if (pathname.startsWith("/admin")) {
    return "admin";
  }

  if (pathname.startsWith("/portal")) {
    return "portal";
  }

  if (pathname.startsWith("/superadmin")) {
    return "superadmin";
  }

  return pathname.startsWith("/app") ? "app" : "marketing";
}

function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack?.slice(0, 4000) ?? null,
    };
  }

  return {
    name: "UnknownError",
    message: typeof error === "string" ? error : "Unknown error",
    stack: null,
  };
}

async function sendClientCapture(input: {
  event: string;
  properties: Record<string, unknown>;
  distinctId?: string | null;
}) {
  if (!clientFlags.hasPostHog) {
    return;
  }

  try {
    await fetch(new URL(POSTHOG_CAPTURE_PATH, publicEnv.NEXT_PUBLIC_POSTHOG_HOST).toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: publicEnv.NEXT_PUBLIC_POSTHOG_KEY,
        event: input.event,
        distinct_id: input.distinctId ?? currentUserId ?? "estateos-browser",
        properties: input.properties,
        timestamp: new Date().toISOString(),
      }),
      keepalive: true,
    });
  } catch {
    // best-effort only
  }
}

type PostHogClientCaptureOptions = {
  severity?: PostHogSeverity;
  sampleRate?: number;
  sampleKey?: string | null;
  supportRequestId?: string | null;
  source?: PostHogSource;
  eventGroup?: PostHogEventGroup;
  fingerprint?: string | null;
};

function shouldDebugSampling() {
  return publicEnv.POSTHOG_DEBUG === true || publicEnv.NODE_ENV !== "production";
}

export function setPostHogClientIdentity(input: { userId?: string | null }) {
  currentUserId = input.userId ?? null;
}

export async function captureClientEvent(
  event: string,
  properties: Record<string, unknown>,
  options?: PostHogClientCaptureOptions,
) {
  const pathname =
    typeof window === "undefined" ? null : window.location.pathname;
  const severity = options?.severity ?? "LOW";
  const source = options?.source ?? "client";
  const eventGroup = options?.eventGroup ?? inferEventGroup({ event, source });
  const environment = normalizeFingerprintEnvironment(publicEnv.NODE_ENV);
  const fingerprintType = inferFingerprintType(event);
  const fingerprint =
    options?.fingerprint ??
    (typeof properties.exceptionFingerprint === "string"
      ? properties.exceptionFingerprint
      : typeof properties.fingerprint === "string"
        ? properties.fingerprint
        : buildFingerprintFromParts([
            environment,
            event,
            source,
            pathname ?? "unknown-path",
            currentUserId ? `user:${buildStableFingerprintHint(currentUserId)}` : "estateos-browser",
            options?.supportRequestId ?? properties.supportRequestId
              ? `support:${buildStableFingerprintHint(
                  String(options?.supportRequestId ?? properties.supportRequestId),
                )}`
              : null,
            properties.syncStatus ?? properties.status ?? properties.outcome ?? null,
          ]));
  const sampleKey = options?.sampleKey ?? fingerprint;

  if (
    !shouldSample(options?.sampleRate ?? 1, sampleKey, {
      debug: shouldDebugSampling(),
      debugLabel: event,
    })
  ) {
    return;
  }

  await sendClientCapture({
    event,
    properties: {
      ...properties,
      pagePath: pathname,
      pageUrl: typeof window === "undefined" ? null : window.location.href,
      host: typeof window === "undefined" ? null : window.location.host,
      userId: currentUserId,
      appArea: inferArea(pathname),
      severity,
      source,
      eventGroup,
      fingerprint,
      fingerprintType,
      eventVersion: POSTHOG_EVENT_VERSION,
      supportRequestId: options?.supportRequestId ?? null,
      environment,
    },
  });
}

export async function captureClientException(
  error: unknown,
  context?: Record<string, unknown>,
  options?: PostHogClientCaptureOptions,
) {
  const normalized = normalizeError(error);
  const fingerprint =
    options?.fingerprint ??
    buildFingerprintFromParts([
      normalizeFingerprintEnvironment(publicEnv.NODE_ENV),
      normalized.name,
      normalized.message,
      typeof window === "undefined" ? "unknown-path" : window.location.pathname,
    ]);

  await captureClientEvent("estateos_client_exception", {
    ...context,
    exceptionName: normalized.name,
    exceptionMessage: normalized.message,
    exceptionStack: normalized.stack,
    exceptionFingerprint: fingerprint,
  }, {
    severity: options?.severity ?? "HIGH",
    sampleRate:
      options?.sampleRate ??
      publicEnv.NEXT_PUBLIC_POSTHOG_CLIENT_EXCEPTION_SAMPLE_RATE ??
      0.5,
    sampleKey: options?.sampleKey ?? fingerprint,
    supportRequestId: options?.supportRequestId ?? null,
    source: options?.source ?? "client",
    eventGroup: "exception",
    fingerprint,
  });
}

export function installPostHogClientTestHelpers(pathname?: string | null) {
  if (!clientFlags.hasPostHog || typeof window === "undefined") {
    return;
  }

  window.__estateosPosthogTest = {
    event: () =>
      captureClientEvent("estateos_posthog_client_test", {
        appArea: inferArea(pathname),
      }, {
        severity: "LOW",
        source: "client",
      }),
    exception: () =>
      captureClientException(new Error("Intentional PostHog client test exception"), {
        source: "manual-test",
      }, {
        severity: "MEDIUM",
        sampleRate: 1,
        source: "client",
      }),
  };
}
