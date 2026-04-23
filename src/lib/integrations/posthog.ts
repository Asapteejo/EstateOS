import { env, featureFlags } from "@/lib/env";
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
import { recordObservedIncident } from "@/modules/incidents/service";
import { logError, logInfo, logWarn } from "@/lib/ops/logger";

type PostHogServerContext = {
  source: PostHogSource;
  route?: string | null;
  method?: string | null;
  requestId?: string | null;
  companyId?: string | null;
  companySlug?: string | null;
  userId?: string | null;
  area?: string | null;
  distinctId?: string | null;
};

type PostHogCaptureOptions = {
  severity?: PostHogSeverity;
  sampleRate?: number;
  sampleKey?: string | null;
  supportRequestId?: string | null;
  source?: PostHogSource;
  eventGroup?: PostHogEventGroup;
  fingerprint?: string | null;
};

const POSTHOG_CAPTURE_PATH = "/capture/";

function inferArea(route?: string | null) {
  if (!route) {
    return "unknown";
  }

  if (route.startsWith("/admin") || route.startsWith("/api/admin")) {
    return "admin";
  }

  if (route.startsWith("/portal") || route.startsWith("/api/portal")) {
    return "portal";
  }

  if (route.startsWith("/superadmin")) {
    return "superadmin";
  }

  if (route.startsWith("/api")) {
    return "api";
  }

  return "marketing";
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

function getReleaseContext() {
  return {
    environment: normalizeFingerprintEnvironment(process.env.VERCEL_ENV ?? env.NODE_ENV),
    release: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
  };
}

function logWithSeverity(
  severity: PostHogSeverity,
  message: string,
  context: Record<string, unknown>,
) {
  if (severity === "HIGH") {
    logError(message, context);
    return;
  }

  if (severity === "MEDIUM") {
    logWarn(message, context);
    return;
  }

  logInfo(message, context);
}

function shouldDebugSampling() {
  return env.POSTHOG_DEBUG === true || env.NODE_ENV !== "production";
}

function shouldRecordIncidentEvent(input: {
  event: string;
  eventGroup: PostHogEventGroup;
  source: PostHogSource;
  severity: PostHogSeverity;
  properties: Record<string, unknown>;
}) {
  void input;
  // v1 aggregation is intentionally limited to server-side exceptions so one
  // operational failure does not create two incident records just because a
  // route emits both an exception and a follow-up failure event.
  return false;
}

async function sendPostHogCapture(input: {
  event: string;
  distinctId: string;
  properties: Record<string, unknown>;
}) {
  if (!featureFlags.hasPostHog) {
    return;
  }

  const apiKey = env.POSTHOG_PROJECT_API_KEY ?? env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = env.NEXT_PUBLIC_POSTHOG_HOST;
  if (!apiKey || !host) {
    return;
  }

  try {
    await fetch(new URL(POSTHOG_CAPTURE_PATH, host).toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: apiKey,
        event: input.event,
        distinct_id: input.distinctId,
        properties: input.properties,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch {
    // PostHog is strictly best-effort in this pass.
  }
}

export async function captureServerEvent(
  event: string,
  properties: Record<string, unknown>,
  context: PostHogServerContext,
  options?: PostHogCaptureOptions,
) {
  const release = getReleaseContext();
  const area = context.area ?? inferArea(context.route);
  const severity = options?.severity ?? "LOW";
  const source = options?.source ?? context.source ?? "system";
  const eventGroup = options?.eventGroup ?? inferEventGroup({ event, source });
  const fingerprintType = inferFingerprintType(event);
  const fingerprint =
    options?.fingerprint ??
    (typeof properties.exceptionFingerprint === "string"
      ? properties.exceptionFingerprint
      : typeof properties.fingerprint === "string"
        ? properties.fingerprint
        : buildFingerprintFromParts([
            release.environment,
            event,
            source,
            context.route ?? "unknown-route",
            context.method ?? "unknown-method",
            context.companyId
              ? `company:${buildStableFingerprintHint(context.companyId)}`
              : context.companySlug ?? context.userId ?? "estateos-server",
            options?.supportRequestId ?? properties.supportRequestId
              ? `support:${buildStableFingerprintHint(
                  String(options?.supportRequestId ?? properties.supportRequestId),
                )}`
              : null,
            properties.syncStatus ?? properties.status ?? properties.outcome ?? null,
          ]));
  const sampleKey = options?.sampleKey ?? fingerprint;

  if (
    shouldRecordIncidentEvent({
      event,
      eventGroup,
      source,
      severity,
      properties,
    })
  ) {
    try {
      await recordObservedIncident({
        fingerprint,
        fingerprintType,
        eventGroup,
        source,
        severity,
        environment: release.environment,
        eventVersion: POSTHOG_EVENT_VERSION,
        route: context.route ?? null,
        companyId: context.companyId ?? null,
        userId: context.userId ?? null,
        supportRequestId:
          typeof (options?.supportRequestId ?? properties.supportRequestId) === "string"
            ? String(options?.supportRequestId ?? properties.supportRequestId)
            : null,
        summary:
          typeof properties.exceptionMessage === "string"
            ? `${event}: ${properties.exceptionMessage}`
            : `${event}: ${context.route ?? source}`,
      });
    } catch (incidentError) {
      logWarn("Incident aggregation failed for server event.", {
        event,
        route: context.route ?? null,
        fingerprint,
        error: incidentError instanceof Error ? incidentError.message : "Unknown error",
      });
    }
  }

  if (
    !shouldSample(options?.sampleRate ?? 1, sampleKey, {
      debug: shouldDebugSampling(),
      debugLabel: event,
    })
  ) {
    return;
  }

  await sendPostHogCapture({
    event,
    distinctId:
      context.distinctId ??
      context.userId ??
      context.companyId ??
      context.companySlug ??
      "estateos-server",
    properties: {
      ...properties,
      source,
      eventGroup,
      route: context.route ?? null,
      method: context.method ?? null,
      requestId: context.requestId ?? null,
      companyId: context.companyId ?? null,
      companySlug: context.companySlug ?? null,
      userId: context.userId ?? null,
      appArea: area,
      severity,
      fingerprint,
      fingerprintType,
      eventVersion: POSTHOG_EVENT_VERSION,
      supportRequestId: options?.supportRequestId ?? null,
      environment: release.environment,
      release: release.release,
    },
  });
}

export async function captureServerException(
  error: unknown,
  context: PostHogServerContext & { handled?: boolean; statusCode?: number },
  options?: PostHogCaptureOptions,
) {
  const normalized = normalizeError(error);
  const source = options?.source ?? context.source ?? "system";
  const severity = options?.severity ?? "HIGH";
  const fingerprint =
    options?.fingerprint ??
    buildFingerprintFromParts([
      getReleaseContext().environment,
      normalized.name,
      normalized.message,
      context.route ?? "unknown-route",
      context.method ?? "unknown-method",
    ]);

  logWithSeverity(severity, "PostHog server exception captured.", {
    fingerprint,
    fingerprintType: "exception",
    route: context.route ?? null,
    source,
    severity,
    requestId: context.requestId ?? null,
    companyId: context.companyId ?? null,
    supportRequestId: options?.supportRequestId ?? null,
    environment: getReleaseContext().environment,
    eventVersion: POSTHOG_EVENT_VERSION,
  });

  try {
    await recordObservedIncident({
      fingerprint,
      fingerprintType: "exception",
      eventGroup: "exception",
      source,
      severity,
      environment: getReleaseContext().environment,
      eventVersion: POSTHOG_EVENT_VERSION,
      route: context.route ?? null,
      companyId: context.companyId ?? null,
      userId: context.userId ?? null,
      supportRequestId: options?.supportRequestId ?? null,
      summary: `${normalized.name}: ${normalized.message}`,
    });
  } catch (incidentError) {
    logWarn("Incident aggregation failed for server exception.", {
      route: context.route ?? null,
      fingerprint,
      source,
      error: incidentError instanceof Error ? incidentError.message : "Unknown error",
    });
  }

  await captureServerEvent(
    "estateos_server_exception",
    {
      exceptionName: normalized.name,
      exceptionMessage: normalized.message,
      exceptionStack: normalized.stack,
      exceptionFingerprint: fingerprint,
      handled: context.handled ?? true,
      statusCode: context.statusCode ?? null,
    },
    context,
    {
      severity,
      sampleRate:
        options?.sampleRate ?? env.POSTHOG_SERVER_EXCEPTION_SAMPLE_RATE ?? 1,
      sampleKey: options?.sampleKey ?? fingerprint,
      supportRequestId: options?.supportRequestId ?? null,
      source,
      eventGroup: "exception",
      fingerprint,
    },
  );
}
