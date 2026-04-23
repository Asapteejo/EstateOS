import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { env, featureFlags } from "@/lib/env";
import {
  createLinearIssue,
  getLinearPriorityLabelId,
  updateLinearIssue,
} from "@/lib/integrations/linear";
import { buildStableFingerprint } from "@/lib/integrations/posthog-common";
import { logError, logWarn } from "@/lib/ops/logger";
import type { TenantContext } from "@/lib/tenancy/context";
import type {
  PostHogEventGroup,
  PostHogFingerprintType,
  PostHogSeverity,
  PostHogSource,
} from "@/lib/integrations/posthog-common";

type IncidentEscalationStatus =
  | "PENDING"
  | "ESCALATED"
  | "SUPPRESSED"
  | "IGNORED"
  | "RESOLVED"
  | "REOPENED";
type RevenueTier = "NONE" | "LOW" | "MEDIUM" | "HIGH";
type SupportPriority = "LOW" | "MEDIUM" | "HIGH";
type LinearPriority = "LOW" | "MEDIUM" | "HIGH";

export const INCIDENT_ESCALATION_WINDOW_MINUTES = 15;
export const INCIDENT_ESCALATION_COUNT_THRESHOLD = 10;
export const INCIDENT_ESCALATION_COMPANY_COUNT_THRESHOLD = 2;
export const INCIDENT_ESCALATION_MULTI_COMPANY_OCCURRENCE_THRESHOLD = 5;
export const INCIDENT_ESCALATION_COOLDOWN_MINUTES = 60;
export const INCIDENT_OCCURRENCE_RETENTION_HOURS = 24;
export const INCIDENT_MAX_OCCURRENCES_PER_INCIDENT = 1000;
export const INCIDENT_GLOBAL_PRUNE_INTERVAL_MS = 5 * 60 * 1000;
export const INCIDENT_STALE_INCIDENT_RETENTION_DAYS = 21;
export const INCIDENT_GLOBAL_PRUNE_OCCURRENCE_BATCH_SIZE = 500;
export const INCIDENT_GLOBAL_PRUNE_INCIDENT_BATCH_SIZE = 100;
export const INCIDENT_INGEST_RATE_LIMIT_PER_MINUTE = 100;

export type ObservedIncidentInput = {
  fingerprint: string;
  fingerprintType: PostHogFingerprintType;
  eventGroup: PostHogEventGroup;
  source: PostHogSource;
  severity: PostHogSeverity;
  environment: string;
  eventVersion: string;
  route?: string | null;
  companyId?: string | null;
  userId?: string | null;
  supportRequestId?: string | null;
  summary: string;
  timestamp?: Date;
};

export type IncidentListItem = {
  id: string;
  fingerprint: string;
  fingerprintType: string;
  eventGroup: string;
  source: string;
  severity: string;
  environment: string;
  eventVersion: string;
  title: string;
  firstSeenAt: Date;
  lastSeenAt: Date;
  occurrenceCount: number;
  affectedCompanyCount: number;
  recentWindowOccurrenceCount: number;
  recentWindowCompanyCount: number;
  recentWindowCalculatedAt: Date | null;
  lastCompanyId: string | null;
  lastUserId: string | null;
  lastRoute: string | null;
  supportRequestId: string | null;
  linearIssueId: string | null;
  linearIssueIdentifier: string | null;
  linearIssueUrl: string | null;
  lastLinearSyncSummaryHash: string | null;
  lastLinearSeveritySynced: string | null;
  lastLinearAffectedCompanyCountSynced: number | null;
  lastLinearUpdateAt: Date | null;
  escalationStatus: IncidentEscalationStatus;
  escalatedAt: Date | null;
  nextEligibleEscalationAt: Date | null;
  lastEscalationReason: string | null;
};

type IncidentRow = IncidentListItem;

type EscalationContext = {
  higherTierPlan: boolean;
  revenueTier: RevenueTier | null;
  supportPriority: SupportPriority | null;
};

type RecentIncidentMetrics = {
  recentOccurrenceCount: number;
  recentCompanyCount: number;
  calculatedAt: Date;
};

const incidentIngestionWindows = new Map<string, number[]>();
let lastGlobalIncidentPruneAt = 0;
let globalIncidentPruneInFlight = false;

function buildIncidentAdminUrl(fingerprint: string) {
  return new URL(
    `/admin/incidents?fingerprint=${encodeURIComponent(fingerprint)}`,
    env.PLATFORM_BASE_URL,
  ).toString();
}

function buildIncidentRateLimitKey(fingerprint: string, environment: string) {
  return `${environment}:${fingerprint}`;
}

function severityRank(value: string | null | undefined) {
  switch (value) {
    case "HIGH":
      return 3;
    case "MEDIUM":
      return 2;
    default:
      return 1;
  }
}

function toLinearPriority(severity: PostHogSeverity) {
  if (severity === "HIGH") {
    return "HIGH" as const;
  }

  if (severity === "MEDIUM") {
    return "MEDIUM" as const;
  }

  return "LOW" as const;
}

function isHigherTierPlan(planLabel: string | null) {
  const value = planLabel?.toLowerCase() ?? "";
  return (
    value.includes("growth") ||
    value.includes("scale") ||
    value.includes("enterprise") ||
    value.includes("annual") ||
    value.includes("business") ||
    value.includes("premium")
  );
}

function buildNextEligibleEscalationAt(baseTime = new Date()) {
  return new Date(baseTime.getTime() + INCIDENT_ESCALATION_COOLDOWN_MINUTES * 60 * 1000);
}

function normalizeSummaryMessage(summary: string) {
  return summary
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi, "")
    .replace(/\b\d{5,}\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildIncidentTitle(input: {
  source: PostHogSource;
  eventGroup: PostHogEventGroup;
  route?: string | null;
  summary: string;
}) {
  const normalizedSummary = normalizeSummaryMessage(input.summary).toLowerCase();

  if (input.source === "payment") {
    return "Payment verification failure";
  }

  if (input.source === "auth") {
    return "Auth completion failure";
  }

  if (input.source === "webhook") {
    return "Webhook processing failure";
  }

  if (input.source === "support") {
    return "Support sync failure";
  }

  if (input.route?.startsWith("/api/admin")) {
    return "Server exception in admin API route";
  }

  if (input.route?.startsWith("/api/portal")) {
    return "Server exception in portal API route";
  }

  if (normalizedSummary.includes("timeout")) {
    return "Server timeout failure";
  }

  if (input.eventGroup === "exception") {
    return "Observed server exception";
  }

  return "Observed operational incident";
}

function buildLinearSyncSummaryHash(input: {
  title: string;
  description: string;
  severity: string;
  affectedCompanyCount: number;
  status: IncidentEscalationStatus;
}) {
  return buildStableFingerprint(
    [input.title, input.description, input.severity, input.affectedCompanyCount, input.status].join(":"),
  );
}

function mapIncidentPriorityFromContext(input: {
  incident: IncidentRow;
  reason: string;
  context: EscalationContext;
}) {
  if (
    input.incident.severity === "HIGH" &&
    ["payment", "auth", "webhook"].includes(input.incident.source)
  ) {
    return "HIGH" as const;
  }

  if (
    input.context.supportPriority === "HIGH" ||
    input.context.revenueTier === "HIGH" ||
    input.context.higherTierPlan
  ) {
    return input.incident.severity === "LOW" ? ("MEDIUM" as const) : ("HIGH" as const);
  }

  if (input.reason.includes("threshold")) {
    return "MEDIUM" as const;
  }

  return toLinearPriority(input.incident.severity as PostHogSeverity);
}

function buildIncidentIssueTitle(input: {
  incident: IncidentRow;
  priority: LinearPriority;
}) {
  return `[${input.priority}] [${input.incident.source}] ${input.incident.title}`;
}

function buildIncidentIssueDescription(input: {
  incident: IncidentRow;
  reason: string;
  priority: LinearPriority;
}) {
  return [
    "Observed incident escalated from EstateOS.",
    "",
    `- Internal incident: ${buildIncidentAdminUrl(input.incident.fingerprint)}`,
    `- Fingerprint: ${input.incident.fingerprint}`,
    `- Fingerprint type: ${input.incident.fingerprintType}`,
    `- Event group: ${input.incident.eventGroup}`,
    `- Source: ${input.incident.source}`,
    `- Severity: ${input.incident.severity}`,
    `- Environment: ${input.incident.environment}`,
    `- Event version: ${input.incident.eventVersion}`,
    `- Priority: ${input.priority}`,
    `- First seen: ${input.incident.firstSeenAt.toISOString()}`,
    `- Last seen: ${input.incident.lastSeenAt.toISOString()}`,
    `- Occurrence count: ${input.incident.occurrenceCount}`,
    `- Recent ${INCIDENT_ESCALATION_WINDOW_MINUTES}m count: ${input.incident.recentWindowOccurrenceCount}`,
    `- Recent ${INCIDENT_ESCALATION_WINDOW_MINUTES}m companies: ${input.incident.recentWindowCompanyCount}`,
    `- Affected companies: ${input.incident.affectedCompanyCount}`,
    `- Last route: ${input.incident.lastRoute ?? "Unknown"}`,
    `- Last company ID: ${input.incident.lastCompanyId ?? "Unknown"}`,
    `- Last user ID: ${input.incident.lastUserId ?? "Unknown"}`,
    `- Support request ID: ${input.incident.supportRequestId ?? "None"}`,
    `- Escalation reason: ${input.reason}`,
  ].join("\n");
}

function shouldAllowLinearUpdate(input: {
  incident: IncidentRow;
  nextStatus: IncidentEscalationStatus;
}) {
  const severityUpgraded =
    input.incident.severity === "HIGH" &&
    severityRank(input.incident.lastLinearSeveritySynced) < severityRank("HIGH");
  const companyImpactUpgraded =
    input.incident.affectedCompanyCount >= 2 &&
    (input.incident.lastLinearAffectedCompanyCountSynced ?? 1) < 2;
  const reopenedWithLinkedIssue =
    input.nextStatus === "REOPENED" &&
    input.incident.escalationStatus === "RESOLVED" &&
    Boolean(input.incident.linearIssueId);

  return {
    shouldUpdate:
      severityUpgraded || companyImpactUpgraded || reopenedWithLinkedIssue,
    severityUpgraded,
    companyImpactUpgraded,
    reopenedWithLinkedIssue,
  };
}

async function loadEscalationContext(
  companyId: string | null,
  supportRequestId: string | null,
): Promise<EscalationContext> {
  const [company, revenue, support] = await Promise.all([
    companyId
      ? prisma.company.findUnique({
          where: { id: companyId },
          select: {
            subscriptions: {
              where: { isCurrent: true },
              orderBy: { createdAt: "desc" },
              take: 1,
              select: {
                interval: true,
                plan: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        })
      : null,
    companyId
      ? prisma.payment.aggregate({
          where: {
            companyId,
            status: "SUCCESS",
          },
          _sum: {
            amount: true,
          },
        })
      : null,
    supportRequestId
      ? prisma.$queryRaw<Array<{
          supportPriority: SupportPriority;
          revenueTier: RevenueTier;
        }>>(Prisma.sql`
          SELECT
            "supportPriority",
            "revenueTier"
          FROM "SupportRequest"
          WHERE "id" = ${supportRequestId}
          LIMIT 1
        `)
      : Promise.resolve([]),
  ]);

  const totalRevenue = revenue?._sum.amount ? Number(revenue._sum.amount) : 0;
  const revenueTier =
    support[0]?.revenueTier ??
    (totalRevenue >= 50_000_000
      ? "HIGH"
      : totalRevenue >= 5_000_000
        ? "MEDIUM"
        : totalRevenue > 0
          ? "LOW"
          : "NONE");

  return {
    higherTierPlan: isHigherTierPlan(
      company?.subscriptions[0]
        ? `${company.subscriptions[0].plan.name} ${company.subscriptions[0].interval.toLowerCase()}`
        : null,
    ),
    revenueTier,
    supportPriority: support[0]?.supportPriority ?? null,
  };
}

function mergeIncidentSeverity(input: {
  current: string;
  incoming: PostHogSeverity;
  affectedCompanyCount: number;
  context: EscalationContext;
}) {
  let next: PostHogSeverity =
    severityRank(input.current) >= severityRank(input.incoming)
      ? (input.current as PostHogSeverity)
      : input.incoming;

  if (input.affectedCompanyCount >= 2 && severityRank(next) < severityRank("MEDIUM")) {
    next = "MEDIUM";
  }

  if (
    (input.context.supportPriority === "HIGH" || input.context.revenueTier === "HIGH") &&
    severityRank(next) < severityRank("HIGH")
  ) {
    next = "HIGH";
  }

  return next;
}

export function shouldEscalateIncident(input: {
  incident: IncidentRow;
  context: EscalationContext;
  recent: RecentIncidentMetrics;
}) {
  const { incident, context, recent } = input;

  if (
    incident.severity === "HIGH" &&
    (incident.source === "payment" || incident.source === "auth" || incident.source === "webhook")
  ) {
    return {
      shouldEscalate: true,
      reason: "High-severity payment/auth/webhook incident.",
    };
  }

  if (recent.recentOccurrenceCount >= INCIDENT_ESCALATION_COUNT_THRESHOLD) {
    return {
      shouldEscalate: true,
      reason: `Incident crossed the ${INCIDENT_ESCALATION_COUNT_THRESHOLD} occurrences in ${INCIDENT_ESCALATION_WINDOW_MINUTES} minutes threshold.`,
    };
  }

  if (
    recent.recentOccurrenceCount >= INCIDENT_ESCALATION_MULTI_COMPANY_OCCURRENCE_THRESHOLD &&
    recent.recentCompanyCount >= INCIDENT_ESCALATION_COMPANY_COUNT_THRESHOLD
  ) {
    return {
      shouldEscalate: true,
      reason: `Incident crossed the ${INCIDENT_ESCALATION_MULTI_COMPANY_OCCURRENCE_THRESHOLD} occurrences / ${INCIDENT_ESCALATION_COMPANY_COUNT_THRESHOLD} companies in ${INCIDENT_ESCALATION_WINDOW_MINUTES} minutes threshold.`,
    };
  }

  if (
    (context.higherTierPlan || context.revenueTier === "HIGH") &&
    (incident.severity === "HIGH" ||
      incident.eventGroup === "payment" ||
      incident.eventGroup === "auth" ||
      incident.eventGroup === "support")
  ) {
    return {
      shouldEscalate: true,
      reason: "Incident impacts a higher-tier or high-revenue tenant.",
    };
  }

  if (
    incident.supportRequestId &&
    (context.supportPriority === "HIGH" || context.revenueTier === "HIGH")
  ) {
    return {
      shouldEscalate: true,
      reason: "Incident is linked to a high-priority or high-revenue support request.",
    };
  }

  return {
    shouldEscalate: false,
    reason: "Incident is below current escalation thresholds.",
  };
}

async function upsertIncident(input: ObservedIncidentInput) {
  const timestamp = input.timestamp ?? new Date();
  const title = buildIncidentTitle({
    source: input.source,
    eventGroup: input.eventGroup,
    route: input.route ?? null,
    summary: input.summary,
  });
  const incidentId = randomUUID();

  const rows = await prisma.$queryRaw<IncidentRow[]>(Prisma.sql`
    INSERT INTO "ObservedIncident" (
      "id",
      "fingerprint",
      "fingerprintType",
      "eventGroup",
      "source",
      "severity",
      "environment",
      "eventVersion",
      "title",
      "firstSeenAt",
      "lastSeenAt",
      "occurrenceCount",
      "affectedCompanyCount",
      "recentWindowOccurrenceCount",
      "recentWindowCompanyCount",
      "recentWindowCalculatedAt",
      "lastCompanyId",
      "lastUserId",
      "lastRoute",
      "supportRequestId",
      "escalationStatus",
      "createdAt",
      "updatedAt"
    ) VALUES (
      ${incidentId},
      ${input.fingerprint},
      ${input.fingerprintType},
      ${input.eventGroup},
      ${input.source},
      ${input.severity},
      ${input.environment},
      ${input.eventVersion},
      ${title},
      ${timestamp},
      ${timestamp},
      1,
      ${input.companyId ? 1 : 0},
      0,
      0,
      NULL,
      ${input.companyId ?? null},
      ${input.userId ?? null},
      ${input.route ?? null},
      ${input.supportRequestId ?? null},
      CAST(${"PENDING"} AS "IncidentEscalationStatus"),
      NOW(),
      NOW()
    )
    ON CONFLICT ("fingerprint", "environment") DO UPDATE
    SET
      "fingerprintType" = EXCLUDED."fingerprintType",
      "eventGroup" = EXCLUDED."eventGroup",
      "source" = EXCLUDED."source",
      "severity" = CASE
        WHEN "ObservedIncident"."severity" = 'HIGH' THEN 'HIGH'
        WHEN "ObservedIncident"."severity" = 'MEDIUM' AND EXCLUDED."severity" = 'LOW' THEN 'MEDIUM'
        ELSE EXCLUDED."severity"
      END,
      "eventVersion" = EXCLUDED."eventVersion",
      "title" = EXCLUDED."title",
      "lastSeenAt" = EXCLUDED."lastSeenAt",
      "occurrenceCount" = "ObservedIncident"."occurrenceCount" + 1,
      "lastCompanyId" = EXCLUDED."lastCompanyId",
      "lastUserId" = EXCLUDED."lastUserId",
      "lastRoute" = EXCLUDED."lastRoute",
      "supportRequestId" = COALESCE(EXCLUDED."supportRequestId", "ObservedIncident"."supportRequestId"),
      "updatedAt" = NOW()
    RETURNING
      "id",
      "fingerprint",
      "fingerprintType",
      "eventGroup",
      "source",
      "severity",
      "environment",
      "eventVersion",
      "title",
      "firstSeenAt",
      "lastSeenAt",
      "occurrenceCount",
      "affectedCompanyCount",
      "recentWindowOccurrenceCount",
      "recentWindowCompanyCount",
      "recentWindowCalculatedAt",
      "lastCompanyId",
      "lastUserId",
      "lastRoute",
      "supportRequestId",
      "linearIssueId",
      "linearIssueIdentifier",
      "linearIssueUrl",
      "lastLinearSyncSummaryHash",
      "lastLinearSeveritySynced",
      "lastLinearAffectedCompanyCountSynced",
      "lastLinearUpdateAt",
      "escalationStatus",
      "escalatedAt",
      "nextEligibleEscalationAt",
      "lastEscalationReason"
  `);

  return rows[0];
}

async function pruneIncidentOccurrences(incidentId: string) {
  const retentionCutoff = new Date(Date.now() - INCIDENT_OCCURRENCE_RETENTION_HOURS * 60 * 60 * 1000);

  await prisma.$executeRaw(Prisma.sql`
    DELETE FROM "ObservedIncidentOccurrence"
    WHERE "incidentId" = ${incidentId}
      AND "seenAt" < ${retentionCutoff}
  `);

  const countRows = await prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
    SELECT COUNT(*)::bigint AS "count"
    FROM "ObservedIncidentOccurrence"
    WHERE "incidentId" = ${incidentId}
  `);
  const count = Number(countRows[0]?.count ?? 0);

  if (count <= INCIDENT_MAX_OCCURRENCES_PER_INCIDENT) {
    return;
  }

  const overflow = count - INCIDENT_MAX_OCCURRENCES_PER_INCIDENT;
  await prisma.$executeRaw(Prisma.sql`
    DELETE FROM "ObservedIncidentOccurrence"
    WHERE "id" IN (
      SELECT "id"
      FROM "ObservedIncidentOccurrence"
      WHERE "incidentId" = ${incidentId}
      ORDER BY "seenAt" ASC
      LIMIT ${overflow}
    )
  `);
}

async function maybeRunGlobalIncidentPruning() {
  const now = Date.now();
  if (
    globalIncidentPruneInFlight ||
    now - lastGlobalIncidentPruneAt < INCIDENT_GLOBAL_PRUNE_INTERVAL_MS
  ) {
    return;
  }

  globalIncidentPruneInFlight = true;
  lastGlobalIncidentPruneAt = now;

  const occurrenceCutoff = new Date(
    now - INCIDENT_OCCURRENCE_RETENTION_HOURS * 60 * 60 * 1000,
  );
  const staleIncidentCutoff = new Date(
    now - INCIDENT_STALE_INCIDENT_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  );

  try {
    await prisma.$executeRaw(Prisma.sql`
      WITH stale_rows AS (
        SELECT "id"
        FROM "ObservedIncidentOccurrence"
        WHERE "seenAt" < ${occurrenceCutoff}
        ORDER BY "seenAt" ASC
        LIMIT ${INCIDENT_GLOBAL_PRUNE_OCCURRENCE_BATCH_SIZE}
      )
      DELETE FROM "ObservedIncidentOccurrence"
      WHERE "id" IN (SELECT "id" FROM stale_rows)
    `);

    await prisma.$executeRaw(Prisma.sql`
      WITH stale_incidents AS (
        SELECT "id"
        FROM "ObservedIncident"
        WHERE "lastSeenAt" < ${staleIncidentCutoff}
          AND "escalationStatus" IN (
            CAST(${"SUPPRESSED"} AS "IncidentEscalationStatus"),
            CAST(${"RESOLVED"} AS "IncidentEscalationStatus"),
            CAST(${"IGNORED"} AS "IncidentEscalationStatus")
          )
        ORDER BY "lastSeenAt" ASC
        LIMIT ${INCIDENT_GLOBAL_PRUNE_INCIDENT_BATCH_SIZE}
      )
      DELETE FROM "ObservedIncident"
      WHERE "id" IN (SELECT "id" FROM stale_incidents)
    `);
  } catch (error) {
    logWarn("Incident global pruning failed.", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
  } finally {
    globalIncidentPruneInFlight = false;
  }
}

function isRateLimited(fingerprint: string, environment: string, now = Date.now()) {
  const key = buildIncidentRateLimitKey(fingerprint, environment);
  const cutoff = now - 60_000;
  const existing = incidentIngestionWindows.get(key) ?? [];
  const windowEntries = existing.filter((timestamp) => timestamp > cutoff);
  windowEntries.push(now);
  incidentIngestionWindows.set(key, windowEntries);

  const rateLimited = windowEntries.length > INCIDENT_INGEST_RATE_LIMIT_PER_MINUTE;

  if (
    rateLimited &&
    process.env.NODE_ENV !== "production"
  ) {
    console.debug("Incident ingestion rate limited", {
      fingerprint,
      environment,
      count: windowEntries.length,
      perMinuteLimit: INCIDENT_INGEST_RATE_LIMIT_PER_MINUTE,
    });
  }

  return rateLimited;
}

async function recordIncidentOccurrence(incidentId: string, companyId: string | null, seenAt: Date) {
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "ObservedIncidentOccurrence" (
      "id",
      "incidentId",
      "companyId",
      "seenAt"
    ) VALUES (
      ${randomUUID()},
      ${incidentId},
      ${companyId ?? null},
      ${seenAt}
    )
  `);

  await pruneIncidentOccurrences(incidentId);
}

async function syncAffectedCompanyCount(incidentId: string, companyId: string | null) {
  if (!companyId) {
    return 0;
  }

  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "ObservedIncidentCompany" ("incidentId", "companyId", "firstSeenAt")
    VALUES (${incidentId}, ${companyId}, NOW())
    ON CONFLICT ("incidentId", "companyId") DO NOTHING
  `);

  const rows = await prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
    SELECT COUNT(*)::bigint AS "count"
    FROM "ObservedIncidentCompany"
    WHERE "incidentId" = ${incidentId}
  `);
  const count = Number(rows[0]?.count ?? 0);

  await prisma.$executeRaw(Prisma.sql`
    UPDATE "ObservedIncident"
    SET
      "affectedCompanyCount" = ${count},
      "updatedAt" = NOW()
    WHERE "id" = ${incidentId}
  `);

  return count;
}

async function getRecentIncidentMetrics(incidentId: string) {
  const calculatedAt = new Date();
  const rows = await prisma.$queryRaw<Array<{
    recentOccurrenceCount: bigint;
    recentCompanyCount: bigint;
  }>>(Prisma.sql`
    SELECT
      COUNT(*)::bigint AS "recentOccurrenceCount",
      COUNT(DISTINCT "companyId")::bigint AS "recentCompanyCount"
    FROM "ObservedIncidentOccurrence"
    WHERE "incidentId" = ${incidentId}
      AND "seenAt" >= NOW() - (${INCIDENT_ESCALATION_WINDOW_MINUTES} * INTERVAL '1 minute')
  `);

  return {
    recentOccurrenceCount: Number(rows[0]?.recentOccurrenceCount ?? 0),
    recentCompanyCount: Number(rows[0]?.recentCompanyCount ?? 0),
    calculatedAt,
  };
}

function buildRateLimitedRecentMetrics(input: {
  incident: IncidentRow;
  companyId: string | null;
  timestamp: Date;
}) {
  const windowMs = INCIDENT_ESCALATION_WINDOW_MINUTES * 60 * 1000;
  const cacheIsFresh =
    input.incident.recentWindowCalculatedAt !== null &&
    input.timestamp.getTime() - input.incident.recentWindowCalculatedAt.getTime() <= windowMs;

  const recentOccurrenceCount = cacheIsFresh
    ? input.incident.recentWindowOccurrenceCount + 1
    : 1;
  const recentCompanyCount = cacheIsFresh
    ? Math.max(
        input.incident.recentWindowCompanyCount,
        input.companyId
          ? Math.min(
              Math.max(input.incident.affectedCompanyCount, 1),
              INCIDENT_ESCALATION_COMPANY_COUNT_THRESHOLD,
            )
          : 0,
      )
    : input.companyId
      ? Math.min(
          Math.max(input.incident.affectedCompanyCount, 1),
          INCIDENT_ESCALATION_COMPANY_COUNT_THRESHOLD,
        )
      : 0;

  return {
    recentOccurrenceCount,
    recentCompanyCount,
    calculatedAt: input.timestamp,
  };
}

async function updateIncidentState(input: {
  incidentId: string;
  status?: IncidentEscalationStatus;
  severity?: PostHogSeverity;
  reason?: string | null;
  linearIssueId?: string | null;
  linearIssueIdentifier?: string | null;
  linearIssueUrl?: string | null;
  lastLinearSyncSummaryHash?: string | null;
  lastLinearSeveritySynced?: string | null;
  lastLinearAffectedCompanyCountSynced?: number | null;
  lastLinearUpdateAt?: Date | null;
  recentWindowOccurrenceCount?: number | null;
  recentWindowCompanyCount?: number | null;
  recentWindowCalculatedAt?: Date | null;
  escalatedAt?: Date | null;
  nextEligibleEscalationAt?: Date | null;
  clearNextEligibleEscalationAt?: boolean;
}) {
  await prisma.$executeRaw(Prisma.sql`
    UPDATE "ObservedIncident"
    SET
      "escalationStatus" = COALESCE(CAST(${input.status ?? null} AS "IncidentEscalationStatus"), "escalationStatus"),
      "severity" = COALESCE(${input.severity ?? null}, "severity"),
      "lastEscalationReason" = COALESCE(${input.reason ?? null}, "lastEscalationReason"),
      "linearIssueId" = COALESCE(${input.linearIssueId ?? null}, "linearIssueId"),
      "linearIssueIdentifier" = COALESCE(${input.linearIssueIdentifier ?? null}, "linearIssueIdentifier"),
      "linearIssueUrl" = COALESCE(${input.linearIssueUrl ?? null}, "linearIssueUrl"),
      "lastLinearSyncSummaryHash" = COALESCE(${input.lastLinearSyncSummaryHash ?? null}, "lastLinearSyncSummaryHash"),
      "lastLinearSeveritySynced" = COALESCE(${input.lastLinearSeveritySynced ?? null}, "lastLinearSeveritySynced"),
      "lastLinearAffectedCompanyCountSynced" = COALESCE(${input.lastLinearAffectedCompanyCountSynced ?? null}, "lastLinearAffectedCompanyCountSynced"),
      "lastLinearUpdateAt" = COALESCE(${input.lastLinearUpdateAt ?? null}, "lastLinearUpdateAt"),
      "recentWindowOccurrenceCount" = COALESCE(${input.recentWindowOccurrenceCount ?? null}, "recentWindowOccurrenceCount"),
      "recentWindowCompanyCount" = COALESCE(${input.recentWindowCompanyCount ?? null}, "recentWindowCompanyCount"),
      "recentWindowCalculatedAt" = COALESCE(${input.recentWindowCalculatedAt ?? null}, "recentWindowCalculatedAt"),
      "escalatedAt" = COALESCE(${input.escalatedAt ?? null}, "escalatedAt"),
      "nextEligibleEscalationAt" = CASE
        WHEN ${input.clearNextEligibleEscalationAt === true} THEN NULL
        ELSE COALESCE(${input.nextEligibleEscalationAt ?? null}, "nextEligibleEscalationAt")
      END,
      "updatedAt" = NOW()
    WHERE "id" = ${input.incidentId}
  `);
}

async function hydrateIncidentRows(rows: IncidentRow[]) {
  return rows.map((row) => ({
    ...row,
    recentWindowOccurrenceCount: row.recentWindowOccurrenceCount ?? 0,
    recentWindowCompanyCount: row.recentWindowCompanyCount ?? 0,
    recentWindowCalculatedAt: row.recentWindowCalculatedAt ?? null,
    lastLinearSyncSummaryHash: row.lastLinearSyncSummaryHash ?? null,
    lastLinearSeveritySynced: row.lastLinearSeveritySynced ?? null,
    lastLinearAffectedCompanyCountSynced: row.lastLinearAffectedCompanyCountSynced ?? null,
    lastLinearUpdateAt: row.lastLinearUpdateAt ?? null,
  }));
}

async function loadIncidentByFingerprint(fingerprint: string, environment: string) {
  const rows = await prisma.$queryRaw<IncidentRow[]>(Prisma.sql`
    SELECT
      "id",
      "fingerprint",
      "fingerprintType",
      "eventGroup",
      "source",
      "severity",
      "environment",
      "eventVersion",
      "title",
      "firstSeenAt",
      "lastSeenAt",
      "occurrenceCount",
      "affectedCompanyCount",
      "recentWindowOccurrenceCount",
      "recentWindowCompanyCount",
      "recentWindowCalculatedAt",
      "lastCompanyId",
      "lastUserId",
      "lastRoute",
      "supportRequestId",
      "linearIssueId",
      "linearIssueIdentifier",
      "linearIssueUrl",
      "lastLinearSyncSummaryHash",
      "lastLinearSeveritySynced",
      "lastLinearAffectedCompanyCountSynced",
      "lastLinearUpdateAt",
      "escalationStatus",
      "escalatedAt",
      "nextEligibleEscalationAt",
      "lastEscalationReason"
    FROM "ObservedIncident"
    WHERE "fingerprint" = ${fingerprint}
      AND "environment" = ${environment}
    LIMIT 1
  `);

  return (await hydrateIncidentRows(rows))[0] ?? null;
}

async function loadIncidentById(incidentId: string) {
  const rows = await prisma.$queryRaw<IncidentRow[]>(Prisma.sql`
    SELECT
      "id",
      "fingerprint",
      "fingerprintType",
      "eventGroup",
      "source",
      "severity",
      "environment",
      "eventVersion",
      "title",
      "firstSeenAt",
      "lastSeenAt",
      "occurrenceCount",
      "affectedCompanyCount",
      "recentWindowOccurrenceCount",
      "recentWindowCompanyCount",
      "recentWindowCalculatedAt",
      "lastCompanyId",
      "lastUserId",
      "lastRoute",
      "supportRequestId",
      "linearIssueId",
      "linearIssueIdentifier",
      "linearIssueUrl",
      "lastLinearSyncSummaryHash",
      "lastLinearSeveritySynced",
      "lastLinearAffectedCompanyCountSynced",
      "lastLinearUpdateAt",
      "escalationStatus",
      "escalatedAt",
      "nextEligibleEscalationAt",
      "lastEscalationReason"
    FROM "ObservedIncident"
    WHERE "id" = ${incidentId}
    LIMIT 1
  `);

  return (await hydrateIncidentRows(rows))[0] ?? null;
}

async function syncLinearIssueIfNeeded(input: {
  incident: IncidentRow;
  nextStatus: IncidentEscalationStatus;
  reason: string;
  priority: LinearPriority;
}) {
  if (!input.incident.linearIssueId || input.incident.escalationStatus === "IGNORED") {
    return;
  }

  const change = shouldAllowLinearUpdate({
    incident: input.incident,
    nextStatus: input.nextStatus,
  });

  if (!change.shouldUpdate) {
    return;
  }

  const title = buildIncidentIssueTitle({
    incident: input.incident,
    priority: input.priority,
  });
  const description = buildIncidentIssueDescription({
    incident: input.incident,
    reason: input.reason,
    priority: input.priority,
  });
  const summaryHash = buildLinearSyncSummaryHash({
    title,
    description,
    severity: input.incident.severity,
    affectedCompanyCount: input.incident.affectedCompanyCount,
    status: input.nextStatus,
  });

  if (
    input.incident.lastLinearSyncSummaryHash === summaryHash &&
    input.incident.lastLinearSeveritySynced === input.incident.severity &&
    (input.incident.lastLinearAffectedCompanyCountSynced ?? 0) === input.incident.affectedCompanyCount
  ) {
    return;
  }

  try {
    const labelIds = [
      env.LINEAR_BUG_LABEL_ID ?? null,
      getLinearPriorityLabelId(input.priority) ?? null,
    ].filter((value): value is string => Boolean(value));

    const issue = await updateLinearIssue({
      issueId: input.incident.linearIssueId,
      title,
      description,
      labelIds,
    });

    await updateIncidentState({
      incidentId: input.incident.id,
      linearIssueIdentifier: issue?.identifier ?? input.incident.linearIssueIdentifier,
      linearIssueUrl: issue?.url ?? input.incident.linearIssueUrl,
      lastLinearSyncSummaryHash: summaryHash,
      lastLinearSeveritySynced: input.incident.severity,
      lastLinearAffectedCompanyCountSynced: input.incident.affectedCompanyCount,
      lastLinearUpdateAt: new Date(),
    });
  } catch (error) {
    logWarn("Incident Linear update failed.", {
      incidentId: input.incident.id,
      fingerprint: input.incident.fingerprint,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

async function maybeEscalateIncident(
  incident: IncidentRow,
  recentOverride?: RecentIncidentMetrics,
) {
  const now = new Date();
  const context = await loadEscalationContext(
    incident.lastCompanyId ?? null,
    incident.supportRequestId ?? null,
  );
  const recent = recentOverride ?? (await getRecentIncidentMetrics(incident.id));

  incident.recentWindowOccurrenceCount = recent.recentOccurrenceCount;
  incident.recentWindowCompanyCount = recent.recentCompanyCount;
  incident.recentWindowCalculatedAt = recent.calculatedAt;

  const mergedSeverity = mergeIncidentSeverity({
    current: incident.severity,
    incoming: incident.severity as PostHogSeverity,
    affectedCompanyCount: incident.affectedCompanyCount,
    context,
  });

  await updateIncidentState({
    incidentId: incident.id,
    severity: mergedSeverity,
    recentWindowOccurrenceCount: recent.recentOccurrenceCount,
    recentWindowCompanyCount: recent.recentCompanyCount,
    recentWindowCalculatedAt: recent.calculatedAt,
  });
  incident.severity = mergedSeverity;

  if (incident.escalationStatus === "IGNORED") {
    return;
  }

  const decision = shouldEscalateIncident({ incident, context, recent });

  if (!decision.shouldEscalate) {
    if (
      incident.escalationStatus !== "ESCALATED" &&
      incident.escalationStatus !== "REOPENED" &&
      incident.escalationStatus !== "RESOLVED"
    ) {
      await updateIncidentState({
        incidentId: incident.id,
        status: "SUPPRESSED",
        reason: decision.reason,
      });
    }
    return;
  }

  const nextStatus =
    incident.escalationStatus === "RESOLVED" ? "REOPENED" : "ESCALATED";
  const priority = mapIncidentPriorityFromContext({
    incident,
    reason: decision.reason,
    context,
  });

  if (
    incident.nextEligibleEscalationAt &&
    incident.nextEligibleEscalationAt > now &&
    (incident.escalationStatus === "ESCALATED" || incident.escalationStatus === "REOPENED")
  ) {
    await syncLinearIssueIfNeeded({
      incident,
      nextStatus,
      reason: decision.reason,
      priority,
    });
    return;
  }

  if (incident.linearIssueId || incident.linearIssueIdentifier) {
    await updateIncidentState({
      incidentId: incident.id,
      status: nextStatus,
      reason: decision.reason,
      severity: incident.severity as PostHogSeverity,
      escalatedAt: incident.escalatedAt ?? now,
      nextEligibleEscalationAt: buildNextEligibleEscalationAt(now),
    });

    await syncLinearIssueIfNeeded({
      incident: {
        ...incident,
        escalationStatus: nextStatus,
      },
      nextStatus,
      reason: decision.reason,
      priority,
    });
    return;
  }

  if (!featureFlags.hasLinear) {
    await updateIncidentState({
      incidentId: incident.id,
      status: "PENDING",
      reason: `${decision.reason} Linear integration is not configured.`,
      severity: incident.severity as PostHogSeverity,
    });
    return;
  }

  try {
    const title = buildIncidentIssueTitle({
      incident,
      priority,
    });
    const description = buildIncidentIssueDescription({
      incident,
      reason: decision.reason,
      priority,
    });
    const labelIds = [
      env.LINEAR_BUG_LABEL_ID ?? null,
      getLinearPriorityLabelId(priority) ?? null,
    ].filter((value): value is string => Boolean(value));
    const issue = await createLinearIssue({
      title,
      description,
      labelIds,
    });
    const summaryHash = buildLinearSyncSummaryHash({
      title,
      description,
      severity: incident.severity,
      affectedCompanyCount: incident.affectedCompanyCount,
      status: nextStatus,
    });

    await updateIncidentState({
      incidentId: incident.id,
      status: nextStatus,
      reason: decision.reason,
      severity: incident.severity as PostHogSeverity,
      linearIssueId: issue?.id ?? null,
      linearIssueIdentifier: issue?.identifier ?? null,
      linearIssueUrl: issue?.url ?? null,
      lastLinearSyncSummaryHash: summaryHash,
      lastLinearSeveritySynced: incident.severity,
      lastLinearAffectedCompanyCountSynced: incident.affectedCompanyCount,
      lastLinearUpdateAt: now,
      escalatedAt: now,
      nextEligibleEscalationAt: buildNextEligibleEscalationAt(now),
    });
  } catch (error) {
    logError("Incident escalation to Linear failed.", {
      fingerprint: incident.fingerprint,
      environment: incident.environment,
      incidentId: incident.id,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    await updateIncidentState({
      incidentId: incident.id,
      status: "PENDING",
      reason: `${decision.reason} Linear escalation failed.`,
      severity: incident.severity as PostHogSeverity,
    });
  }
}

export async function recordObservedIncident(input: ObservedIncidentInput) {
  if (!featureFlags.hasDatabase) {
    return null;
  }

  await maybeRunGlobalIncidentPruning();

  const timestamp = input.timestamp ?? new Date();
  const incident = await upsertIncident({
    ...input,
    timestamp,
  });

  const rateLimited = isRateLimited(input.fingerprint, input.environment, timestamp.getTime());

  if (!rateLimited) {
    await recordIncidentOccurrence(incident.id, input.companyId ?? null, timestamp);
  }

  const affectedCompanyCount = await syncAffectedCompanyCount(
    incident.id,
    input.companyId ?? null,
  );
  const refreshed = await loadIncidentByFingerprint(input.fingerprint, input.environment);
  if (!refreshed) {
    return null;
  }

  if (affectedCompanyCount !== refreshed.affectedCompanyCount) {
    refreshed.affectedCompanyCount = affectedCompanyCount;
  }

  const recentMetrics = rateLimited
    ? buildRateLimitedRecentMetrics({
        incident: refreshed,
        companyId: input.companyId ?? null,
        timestamp,
      })
    : undefined;

  await maybeEscalateIncident(refreshed, recentMetrics);

  return loadIncidentByFingerprint(input.fingerprint, input.environment);
}

async function assertIncidentBelongsToCompany(incidentId: string, companyId: string) {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT oi."id"
    FROM "ObservedIncident" oi
    INNER JOIN "ObservedIncidentCompany" oic
      ON oic."incidentId" = oi."id"
    WHERE oi."id" = ${incidentId}
      AND oic."companyId" = ${companyId}
    LIMIT 1
  `);

  if (!rows[0]) {
    throw new Error("Incident not found.");
  }
}

export async function markObservedIncidentResolved(input: {
  tenant: TenantContext;
  incidentId: string;
}) {
  if (!featureFlags.hasDatabase || !input.tenant.companyId) {
    throw new Error("Incident resolution requires a database-backed tenant.");
  }

  await assertIncidentBelongsToCompany(input.incidentId, input.tenant.companyId);

  await updateIncidentState({
    incidentId: input.incidentId,
    status: "RESOLVED",
    reason: "Marked resolved by an operator.",
    clearNextEligibleEscalationAt: true,
  });

  return loadIncidentById(input.incidentId);
}

export async function markObservedIncidentIgnored(input: {
  tenant: TenantContext;
  incidentId: string;
}) {
  if (!featureFlags.hasDatabase || !input.tenant.companyId) {
    throw new Error("Incident ignore requires a database-backed tenant.");
  }

  await assertIncidentBelongsToCompany(input.incidentId, input.tenant.companyId);

  await updateIncidentState({
    incidentId: input.incidentId,
    status: "IGNORED",
    reason: "Marked ignored by an operator.",
    clearNextEligibleEscalationAt: true,
  });

  return loadIncidentById(input.incidentId);
}

export async function markObservedIncidentUnignored(input: {
  tenant: TenantContext;
  incidentId: string;
}) {
  if (!featureFlags.hasDatabase || !input.tenant.companyId) {
    throw new Error("Incident unignore requires a database-backed tenant.");
  }

  await assertIncidentBelongsToCompany(input.incidentId, input.tenant.companyId);

  await updateIncidentState({
    incidentId: input.incidentId,
    status: "PENDING",
    reason: "Removed ignore by an operator.",
    clearNextEligibleEscalationAt: true,
  });

  return loadIncidentById(input.incidentId);
}

export async function listObservedIncidentsForCompany(
  companyId: string,
  fingerprint?: string | null,
) {
  const rows = await prisma.$queryRaw<IncidentRow[]>(Prisma.sql`
    SELECT
      oi."id",
      oi."fingerprint",
      oi."fingerprintType",
      oi."eventGroup",
      oi."source",
      oi."severity",
      oi."environment",
      oi."eventVersion",
      oi."title",
      oi."firstSeenAt",
      oi."lastSeenAt",
      oi."occurrenceCount",
      oi."affectedCompanyCount",
      oi."recentWindowOccurrenceCount",
      oi."recentWindowCompanyCount",
      oi."recentWindowCalculatedAt",
      oi."lastCompanyId",
      oi."lastUserId",
      oi."lastRoute",
      oi."supportRequestId",
      oi."linearIssueId",
      oi."linearIssueIdentifier",
      oi."linearIssueUrl",
      oi."lastLinearSyncSummaryHash",
      oi."lastLinearSeveritySynced",
      oi."lastLinearAffectedCompanyCountSynced",
      oi."lastLinearUpdateAt",
      oi."escalationStatus",
      oi."escalatedAt",
      oi."nextEligibleEscalationAt",
      oi."lastEscalationReason"
    FROM "ObservedIncident" oi
    INNER JOIN "ObservedIncidentCompany" oic
      ON oic."incidentId" = oi."id"
    WHERE oic."companyId" = ${companyId}
      ${fingerprint ? Prisma.sql`AND oi."fingerprint" = ${fingerprint}` : Prisma.sql``}
    ORDER BY
      ${fingerprint ? Prisma.sql`CASE WHEN oi."fingerprint" = ${fingerprint} THEN 0 ELSE 1 END,` : Prisma.sql``}
      oi."lastSeenAt" DESC
    LIMIT 100
  `);

  return hydrateIncidentRows(rows);
}
