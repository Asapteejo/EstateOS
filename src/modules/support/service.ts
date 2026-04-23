import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";

import { env, featureFlags } from "@/lib/env";
import { createLinearSupportIssue } from "@/lib/integrations/linear";
import { captureServerEvent, captureServerException } from "@/lib/integrations/posthog";
import { logError } from "@/lib/ops/logger";
import type { TenantContext } from "@/lib/tenancy/context";
import { prisma } from "@/lib/db/prisma";
import type { SupportCategory, SupportRequestInput } from "@/lib/validations/support";

type SyncStatus = "PENDING" | "SYNCED" | "FAILED" | "SKIPPED" | "MAX_RETRIES_EXCEEDED";
type SupportPriority = "HIGH" | "MEDIUM" | "LOW";
type RevenueTier = "NONE" | "LOW" | "MEDIUM" | "HIGH";

const SUPPORT_LINEAR_MAX_RETRIES = 5;
const SUPPORT_LINEAR_RETRY_BASE_DELAY_MINUTES = 5;

type SupportSubmissionContext = {
  tenant: TenantContext;
  reporterName: string | null;
  reporterEmail: string | null;
};

export type SupportRequestListItem = {
  id: string;
  category: string;
  supportPriority: SupportPriority;
  subject: string;
  message: string;
  reporterName: string | null;
  reporterEmail: string | null;
  pageUrl: string | null;
  companyPlanLabel: string | null;
  revenueSnapshotAmount: string | null;
  revenueSnapshotCurrency: string | null;
  revenueTier: RevenueTier;
  lastPaymentAt: Date | null;
  syncStatus: SyncStatus;
  linearIssueId: string | null;
  linearIssueIdentifier: string | null;
  linearIssueUrl: string | null;
  lastSyncError: string | null;
  retryCount: number;
  lastRetryAt: Date | null;
  nextRetryAt: Date | null;
  syncedAt: Date | null;
  createdAt: Date;
};

type CompanySnapshot = {
  name: string;
  slug: string;
  supportEmail: string | null;
  activePlanName: string | null;
  activePlanInterval: string | null;
  activePlanStatus: string | null;
  revenueSnapshotAmount: string | null;
  revenueSnapshotCurrency: string | null;
  revenueTier: RevenueTier;
  lastPaymentAt: Date | null;
};

function toDbCategory(category: SupportCategory) {
  return category.toUpperCase();
}

function buildPlanLabel(company: CompanySnapshot) {
  if (!company.activePlanName) {
    return null;
  }

  if (!company.activePlanInterval) {
    return company.activePlanName;
  }

  return `${company.activePlanName} ${company.activePlanInterval.toLowerCase()}`;
}

function buildRevenueTier(totalRevenue: number) {
  if (totalRevenue <= 0) {
    return "NONE" as const;
  }

  if (totalRevenue >= 50_000_000) {
    return "HIGH" as const;
  }

  if (totalRevenue >= 5_000_000) {
    return "MEDIUM" as const;
  }

  return "LOW" as const;
}

function inferSupportPriority(input: {
  category: SupportCategory;
  companyPlanLabel: string | null;
  revenueTier: RevenueTier;
  subject: string;
  message: string;
}) {
  const normalizedPlan = input.companyPlanLabel?.toLowerCase() ?? "";
  const normalizedText = `${input.subject} ${input.message}`.toLowerCase();
  const isHigherTierPlan =
    normalizedPlan.includes("growth") ||
    normalizedPlan.includes("scale") ||
    normalizedPlan.includes("enterprise") ||
    normalizedPlan.includes("annual") ||
    normalizedPlan.includes("business") ||
    normalizedPlan.includes("premium");
  const urgentKeyword =
    normalizedText.includes("blocked") ||
    normalizedText.includes("urgent") ||
    normalizedText.includes("cannot pay") ||
    normalizedText.includes("payment failed") ||
    normalizedText.includes("crash") ||
    normalizedText.includes("outage") ||
    normalizedText.includes("down");
  const isHighRevenueTenant = input.revenueTier === "HIGH";
  const isMediumRevenueTenant = input.revenueTier === "MEDIUM";

  if (input.category === "billing") {
    return "HIGH" as const;
  }

  if (input.category === "bug" && (isHigherTierPlan || isHighRevenueTenant || urgentKeyword)) {
    return "HIGH" as const;
  }

  if (input.category === "bug" || input.category === "onboarding") {
    return "MEDIUM" as const;
  }

  if (input.category === "feature_request" && (isHigherTierPlan || isHighRevenueTenant || isMediumRevenueTenant)) {
    return "MEDIUM" as const;
  }

  return "LOW" as const;
}

function toSupportFailureSeverity(input: {
  category: SupportCategory;
  priority: SupportPriority;
}) {
  if (input.category === "billing" || input.priority === "HIGH") {
    return "HIGH" as const;
  }

  return "MEDIUM" as const;
}

function buildInternalSupportUrl(requestId: string) {
  return new URL(`/admin/support?requestId=${encodeURIComponent(requestId)}`, env.PLATFORM_BASE_URL).toString();
}

function getSupportRetryDelayMinutes(attemptNumber: number) {
  return SUPPORT_LINEAR_RETRY_BASE_DELAY_MINUTES * (2 ** Math.max(attemptNumber - 1, 0));
}

function buildNextRetryAt(attemptNumber: number) {
  return new Date(Date.now() + getSupportRetryDelayMinutes(attemptNumber) * 60 * 1000);
}

function buildLinearDescription(input: {
  requestId: string;
  company: CompanySnapshot;
  planLabel: string | null;
  revenueSnapshotAmount: string | null;
  revenueSnapshotCurrency: string | null;
  revenueTier: RevenueTier;
  lastPaymentAt: Date | null;
  category: SupportCategory;
  subject: string;
  message: string;
  reporterName: string | null;
  reporterEmail: string | null;
  pageUrl?: string | null;
  browserInfo?: string | null;
  priority: SupportPriority;
}) {
  const lines = [
    `Support request submitted from EstateOS.`,
    ``,
    `- Internal request ID: ${input.requestId}`,
    `- Internal support record: ${buildInternalSupportUrl(input.requestId)}`,
    `- Company: ${input.company.name} (${input.company.slug})`,
    `- Category: ${input.category}`,
    `- Priority: ${input.priority}`,
    `- Reporter: ${input.reporterName ?? "Unknown"}`,
    `- Email: ${input.reporterEmail ?? "Unknown"}`,
    `- Plan: ${input.planLabel ?? "No active plan"}`,
    `- Revenue tier: ${input.revenueTier}`,
    `- Gross revenue snapshot: ${
      input.revenueSnapshotAmount && input.revenueSnapshotCurrency
        ? `${input.revenueSnapshotCurrency} ${input.revenueSnapshotAmount}`
        : "No successful payments yet"
    }`,
    `- Last successful payment: ${input.lastPaymentAt?.toISOString() ?? "None"}`,
    `- Subscription status: ${input.company.activePlanStatus ?? "Unknown"}`,
    `- Support email: ${input.company.supportEmail ?? "Not configured"}`,
    `- Page URL: ${input.pageUrl ?? "Not provided"}`,
    `- Browser / device: ${input.browserInfo ?? "Not provided"}`,
    ``,
    `Subject: ${input.subject}`,
    ``,
    input.message,
  ];

  return lines.join("\n");
}

async function loadCompanySnapshot(companyId: string): Promise<CompanySnapshot> {
  const [company, successfulPayments, latestPayment] = await Promise.all([
    prisma.company.findUnique({
      where: { id: companyId },
      select: {
        name: true,
        slug: true,
        siteSetting: {
          select: {
            supportEmail: true,
          },
        },
        billingSettings: {
          select: {
            defaultCurrency: true,
          },
        },
        subscriptions: {
          where: {
            isCurrent: true,
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
          select: {
            status: true,
            interval: true,
            plan: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    }),
    prisma.payment.aggregate({
      where: {
        companyId,
        status: "SUCCESS",
      },
      _sum: {
        amount: true,
      },
    }),
    prisma.payment.findFirst({
      where: {
        companyId,
        status: "SUCCESS",
      },
      orderBy: {
        paidAt: "desc",
      },
      select: {
        paidAt: true,
        currency: true,
      },
    }),
  ]);

  if (!company) {
    throw new Error("Company not found.");
  }

  const successfulRevenue = successfulPayments._sum.amount;
  const totalRevenue = successfulRevenue ? Number(successfulRevenue) : 0;

  return {
    name: company.name,
    slug: company.slug,
    supportEmail: company.siteSetting?.supportEmail ?? null,
    activePlanName: company.subscriptions[0]?.plan.name ?? null,
    activePlanInterval: company.subscriptions[0]?.interval ?? null,
    activePlanStatus: company.subscriptions[0]?.status ?? null,
    revenueSnapshotAmount: successfulRevenue?.toString() ?? null,
    revenueSnapshotCurrency:
      latestPayment?.currency ?? company.billingSettings?.defaultCurrency ?? "NGN",
    revenueTier: buildRevenueTier(totalRevenue),
    lastPaymentAt: latestPayment?.paidAt ?? null,
  };
}

async function findDuplicateSupportRequest(input: {
  companyId: string;
  userId: string | null;
  subject: string;
  message: string;
}) {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id"
    FROM "SupportRequest"
    WHERE "companyId" = ${input.companyId}
      AND ${input.userId ? Prisma.sql`"userId" = ${input.userId}` : Prisma.sql`"userId" IS NULL`}
      AND lower("subject") = lower(${input.subject})
      AND lower("message") = lower(${input.message})
      AND "createdAt" >= NOW() - INTERVAL '10 minutes'
    ORDER BY "createdAt" DESC
    LIMIT 1
  `);

  return rows[0]?.id ?? null;
}

async function createSupportRequestRecord(input: {
  tenant: TenantContext;
  request: SupportRequestInput;
  reporterName: string | null;
  reporterEmail: string | null;
  companyPlanLabel: string | null;
  priority: SupportPriority;
  revenueSnapshotAmount: string | null;
  revenueSnapshotCurrency: string | null;
  revenueTier: RevenueTier;
  lastPaymentAt: Date | null;
}) {
  const id = randomUUID();
  const metadata = JSON.stringify({
    browserInfo: input.request.browserInfo ?? null,
    pageUrl: input.request.pageUrl ?? null,
  });

  const rows = await prisma.$queryRaw<SupportRequestListItem[]>(Prisma.sql`
    INSERT INTO "SupportRequest" (
      "id",
      "companyId",
      "userId",
      "category",
      "supportPriority",
      "subject",
      "message",
      "reporterName",
      "reporterEmail",
      "pageUrl",
      "browserInfo",
      "companyPlanLabel",
      "revenueSnapshotAmount",
      "revenueSnapshotCurrency",
      "revenueTier",
      "lastPaymentAt",
      "syncStatus",
      "retryCount",
      "metadata",
      "createdAt",
      "updatedAt"
    ) VALUES (
      ${id},
      ${input.tenant.companyId!},
      ${input.tenant.userId},
      CAST(${toDbCategory(input.request.category)} AS "SupportRequestCategory"),
      CAST(${input.priority} AS "SupportPriority"),
      ${input.request.subject},
      ${input.request.message},
      ${input.reporterName},
      ${input.reporterEmail},
      ${input.request.pageUrl ?? null},
      ${input.request.browserInfo ?? null},
      ${input.companyPlanLabel},
      ${input.revenueSnapshotAmount !== null ? Prisma.sql`CAST(${input.revenueSnapshotAmount} AS DECIMAL(14,2))` : Prisma.sql`NULL`},
      ${input.revenueSnapshotCurrency},
      CAST(${input.revenueTier} AS "SupportRevenueTier"),
      ${input.lastPaymentAt},
      CAST(${"PENDING"} AS "IntegrationSyncStatus"),
      0,
      CAST(${metadata} AS jsonb),
      NOW(),
      NOW()
    )
    RETURNING
      "id",
      "category",
      "supportPriority",
      "subject",
      "message",
      "reporterName",
      "reporterEmail",
      "pageUrl",
      "companyPlanLabel",
      CAST("revenueSnapshotAmount" AS text) AS "revenueSnapshotAmount",
      "revenueSnapshotCurrency",
      "revenueTier",
      "lastPaymentAt",
      "syncStatus",
      "linearIssueId",
      "linearIssueIdentifier",
      "linearIssueUrl",
      "lastSyncError",
      "retryCount",
      "lastRetryAt",
      "nextRetryAt",
      "syncedAt",
      "createdAt"
  `);

  return rows[0];
}

async function updateSupportRequestSyncState(input: {
  requestId: string;
  status: SyncStatus;
  linearIssueId?: string | null;
  linearIssueIdentifier?: string | null;
      linearIssueUrl?: string | null;
  error?: string | null;
  retryCount?: number;
  lastRetryAt?: Date | null;
  nextRetryAt?: Date | null;
}) {
  await prisma.$executeRaw(Prisma.sql`
    UPDATE "SupportRequest"
    SET
      "syncStatus" = CAST(${input.status} AS "IntegrationSyncStatus"),
      "linearIssueId" = ${input.linearIssueId ?? null},
      "linearIssueIdentifier" = ${input.linearIssueIdentifier ?? null},
      "linearIssueUrl" = ${input.linearIssueUrl ?? null},
      "lastSyncError" = ${input.error ?? null},
      "retryCount" = COALESCE(${input.retryCount}, "retryCount"),
      "lastRetryAt" = COALESCE(${input.lastRetryAt ?? null}, "lastRetryAt"),
      "nextRetryAt" = ${input.nextRetryAt ?? null},
      "syncedAt" = ${input.status === "SYNCED" ? new Date() : null},
      "updatedAt" = NOW()
    WHERE "id" = ${input.requestId}
  `);
}

async function createLinearIssueForRequest(input: {
  requestId: string;
  request: {
    category: SupportCategory;
    subject: string;
    message: string;
    pageUrl: string | null;
    browserInfo: string | null;
  };
  company: CompanySnapshot;
  reporterName: string | null;
  reporterEmail: string | null;
  priority?: SupportPriority;
  planLabel?: string | null;
  revenueSnapshotAmount?: string | null;
  revenueSnapshotCurrency?: string | null;
  revenueTier?: RevenueTier;
  lastPaymentAt?: Date | null;
}) {
  const companyPlanLabel = input.planLabel ?? buildPlanLabel(input.company);
  const priority =
    input.priority ??
    inferSupportPriority({
      category: input.request.category,
      companyPlanLabel,
      revenueTier: input.revenueTier ?? input.company.revenueTier,
      subject: input.request.subject,
      message: input.request.message,
    });

  const issue = await createLinearSupportIssue({
    category: input.request.category,
    priority,
    title: `[${priority}] [Support] ${input.request.subject}`,
    description: buildLinearDescription({
      requestId: input.requestId,
      company: input.company,
      planLabel: companyPlanLabel,
      revenueSnapshotAmount: input.revenueSnapshotAmount ?? input.company.revenueSnapshotAmount,
      revenueSnapshotCurrency: input.revenueSnapshotCurrency ?? input.company.revenueSnapshotCurrency,
      revenueTier: input.revenueTier ?? input.company.revenueTier,
      lastPaymentAt: input.lastPaymentAt ?? input.company.lastPaymentAt,
      category: input.request.category,
      subject: input.request.subject,
      message: input.request.message,
      reporterName: input.reporterName,
      reporterEmail: input.reporterEmail,
      pageUrl: input.request.pageUrl,
      browserInfo: input.request.browserInfo,
      priority,
    }),
  });

  return issue;
}

function mapDbCategory(value: string): SupportCategory {
  return value.toLowerCase() as SupportCategory;
}

export async function submitSupportRequest(
  context: SupportSubmissionContext,
  request: SupportRequestInput,
) {
  if (!featureFlags.hasDatabase || !context.tenant.companyId) {
    throw new Error("Support requests require a database-backed tenant.");
  }

  const duplicateId = await findDuplicateSupportRequest({
    companyId: context.tenant.companyId,
    userId: context.tenant.userId,
    subject: request.subject,
    message: request.message,
  });

  if (duplicateId) {
    throw new Error("A matching support request was submitted recently. Please wait before resending.");
  }

  const company = await loadCompanySnapshot(context.tenant.companyId);
  const companyPlanLabel = buildPlanLabel(company);
  const priority = inferSupportPriority({
    category: request.category,
    companyPlanLabel,
    revenueTier: company.revenueTier,
    subject: request.subject,
    message: request.message,
  });

  const record = await createSupportRequestRecord({
    tenant: context.tenant,
    request,
    reporterName: context.reporterName,
    reporterEmail: context.reporterEmail,
    companyPlanLabel,
    priority,
    revenueSnapshotAmount: company.revenueSnapshotAmount,
    revenueSnapshotCurrency: company.revenueSnapshotCurrency,
    revenueTier: company.revenueTier,
    lastPaymentAt: company.lastPaymentAt,
  });

  if (!featureFlags.hasLinear) {
    await updateSupportRequestSyncState({
      requestId: record.id,
      status: "SKIPPED",
      error: "Linear integration is not configured.",
      nextRetryAt: buildNextRetryAt(1),
    });

    return {
      id: record.id,
      syncStatus: "SKIPPED" as const,
      linearIssueIdentifier: null,
      linearIssueUrl: null,
    };
  }

  try {
    const issue = await createLinearIssueForRequest({
      requestId: record.id,
      request: {
        category: request.category,
        subject: request.subject,
        message: request.message,
        pageUrl: request.pageUrl ?? null,
        browserInfo: request.browserInfo ?? null,
      },
      company,
      reporterName: context.reporterName,
      reporterEmail: context.reporterEmail,
    });

    await updateSupportRequestSyncState({
      requestId: record.id,
      status: "SYNCED",
      linearIssueId: issue?.id ?? null,
      linearIssueIdentifier: issue?.identifier ?? null,
      linearIssueUrl: issue?.url ?? null,
      nextRetryAt: null,
    });

    return {
      id: record.id,
      syncStatus: "SYNCED" as const,
      linearIssueIdentifier: issue?.identifier ?? null,
      linearIssueUrl: issue?.url ?? null,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown Linear sync failure.";

    await captureServerException(error, {
      source: "support",
      route: "/api/portal/support",
      method: "POST",
      companyId: context.tenant.companyId,
      companySlug: context.tenant.companySlug,
      userId: context.tenant.userId,
      area: "portal",
      statusCode: 500,
    }, {
      severity: toSupportFailureSeverity({
        category: request.category,
        priority,
      }),
      supportRequestId: record.id,
    });
    await captureServerEvent(
      "support_request_linear_sync_failed",
      {
        category: request.category,
        supportRequestId: record.id,
        syncStatus: "FAILED",
      },
      {
        source: "support",
        route: "/api/portal/support",
        method: "POST",
        companyId: context.tenant.companyId,
        companySlug: context.tenant.companySlug,
        userId: context.tenant.userId,
        area: "portal",
      },
      {
        severity: toSupportFailureSeverity({
          category: request.category,
          priority,
        }),
        supportRequestId: record.id,
      },
    );

    logError("Support request failed to sync to Linear.", {
      requestId: record.id,
      companyId: context.tenant.companyId,
      error: message,
    });

    await updateSupportRequestSyncState({
      requestId: record.id,
      status: "FAILED",
      error: message,
      nextRetryAt: buildNextRetryAt(1),
    });

    return {
      id: record.id,
      syncStatus: "FAILED" as const,
      linearIssueIdentifier: null,
      linearIssueUrl: null,
    };
  }
}

export async function listSupportRequestsForCompany(
  companyId: string,
  requestId?: string | null,
) {
  return prisma.$queryRaw<SupportRequestListItem[]>(Prisma.sql`
    SELECT
      "id",
      "category",
      "supportPriority",
      "subject",
      "message",
      "reporterName",
      "reporterEmail",
      "pageUrl",
      "companyPlanLabel",
      CAST("revenueSnapshotAmount" AS text) AS "revenueSnapshotAmount",
      "revenueSnapshotCurrency",
      "revenueTier",
      "lastPaymentAt",
      "syncStatus",
      "linearIssueId",
      "linearIssueIdentifier",
      "linearIssueUrl",
      "lastSyncError",
      "retryCount",
      "lastRetryAt",
      "nextRetryAt",
      "syncedAt",
      "createdAt"
    FROM "SupportRequest"
    WHERE "companyId" = ${companyId}
    ORDER BY
      ${requestId ? Prisma.sql`CASE WHEN "id" = ${requestId} THEN 0 ELSE 1 END,` : Prisma.sql``}
      "createdAt" DESC
    LIMIT 100
  `);
}

export async function retrySupportRequestSync(input: {
  tenant: TenantContext;
  requestId: string;
}) {
  if (!featureFlags.hasDatabase || !input.tenant.companyId) {
    throw new Error("Support retries require a database-backed tenant.");
  }

  const rows = await prisma.$queryRaw<Array<{
    id: string;
    companyId: string;
    category: string;
    supportPriority: SupportPriority;
    subject: string;
    message: string;
    reporterName: string | null;
    reporterEmail: string | null;
    pageUrl: string | null;
    browserInfo: string | null;
    companyPlanLabel: string | null;
    revenueSnapshotAmount: string | null;
    revenueSnapshotCurrency: string | null;
    revenueTier: RevenueTier;
    lastPaymentAt: Date | null;
    syncStatus: SyncStatus;
    linearIssueId: string | null;
    linearIssueIdentifier: string | null;
    linearIssueUrl: string | null;
    retryCount: number;
    nextRetryAt: Date | null;
  }>>(Prisma.sql`
    SELECT
      "id",
      "companyId",
      "category",
      "supportPriority",
      "subject",
      "message",
      "reporterName",
      "reporterEmail",
      "pageUrl",
      "browserInfo",
      "companyPlanLabel",
      CAST("revenueSnapshotAmount" AS text) AS "revenueSnapshotAmount",
      "revenueSnapshotCurrency",
      "revenueTier",
      "lastPaymentAt",
      "syncStatus",
      "linearIssueId",
      "linearIssueIdentifier",
      "linearIssueUrl",
      "retryCount",
      "nextRetryAt"
    FROM "SupportRequest"
    WHERE "id" = ${input.requestId}
      AND "companyId" = ${input.tenant.companyId}
    LIMIT 1
  `);

  const request = rows[0];
  if (!request) {
    throw new Error("Support request not found.");
  }

  if (request.linearIssueId || request.linearIssueIdentifier) {
    return {
      id: request.id,
      syncStatus: "SYNCED" as const,
      linearIssueIdentifier: request.linearIssueIdentifier,
      linearIssueUrl: request.linearIssueUrl,
      alreadyLinked: true,
    };
  }

  if (request.syncStatus !== "FAILED" && request.syncStatus !== "SKIPPED") {
    if (request.syncStatus === "MAX_RETRIES_EXCEEDED") {
      throw new Error("This support request has reached the retry cap.");
    }
    throw new Error("Only failed or skipped support requests can be retried.");
  }

  if (!featureFlags.hasLinear) {
    throw new Error("Linear integration is not configured.");
  }

  if (request.retryCount >= SUPPORT_LINEAR_MAX_RETRIES) {
    await updateSupportRequestSyncState({
      requestId: request.id,
      status: "MAX_RETRIES_EXCEEDED",
      error: "Maximum Linear retry attempts reached.",
      nextRetryAt: null,
    });

    throw new Error("This support request has reached the retry cap.");
  }

  const company = await loadCompanySnapshot(request.companyId);
  const nextRetryCount = request.retryCount + 1;

  try {
    const issue = await createLinearIssueForRequest({
      requestId: request.id,
      request: {
        category: mapDbCategory(request.category),
        subject: request.subject,
        message: request.message,
        pageUrl: request.pageUrl,
        browserInfo: request.browserInfo,
      },
      company,
      reporterName: request.reporterName,
      reporterEmail: request.reporterEmail,
      priority: request.supportPriority,
      planLabel: request.companyPlanLabel,
      revenueSnapshotAmount: request.revenueSnapshotAmount,
      revenueSnapshotCurrency: request.revenueSnapshotCurrency,
      revenueTier: request.revenueTier,
      lastPaymentAt: request.lastPaymentAt,
    });

    await updateSupportRequestSyncState({
      requestId: request.id,
      status: "SYNCED",
      linearIssueId: issue?.id ?? null,
      linearIssueIdentifier: issue?.identifier ?? null,
      linearIssueUrl: issue?.url ?? null,
      retryCount: nextRetryCount,
      lastRetryAt: new Date(),
      nextRetryAt: null,
    });

    return {
      id: request.id,
      syncStatus: "SYNCED" as const,
      linearIssueIdentifier: issue?.identifier ?? null,
      linearIssueUrl: issue?.url ?? null,
      alreadyLinked: false,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown Linear retry failure.";

    await captureServerException(error, {
      source: "support",
      route: "/api/admin/support/[requestId]/retry",
      method: "POST",
      companyId: request.companyId,
      userId: input.tenant.userId,
      companySlug: input.tenant.companySlug,
      area: "admin",
      statusCode: 500,
    }, {
      severity:
        request.category === "BILLING" || request.supportPriority === "HIGH"
          ? "HIGH"
          : "MEDIUM",
      supportRequestId: request.id,
    });

    logError("Support request retry failed to sync to Linear.", {
      requestId: request.id,
      companyId: request.companyId,
      retryCount: nextRetryCount,
      error: message,
    });

    await updateSupportRequestSyncState({
      requestId: request.id,
      status:
        nextRetryCount >= SUPPORT_LINEAR_MAX_RETRIES
          ? "MAX_RETRIES_EXCEEDED"
          : "FAILED",
      error:
        nextRetryCount >= SUPPORT_LINEAR_MAX_RETRIES
          ? `${message} Maximum retry attempts reached.`
          : message,
      retryCount: nextRetryCount,
      lastRetryAt: new Date(),
      nextRetryAt:
        nextRetryCount >= SUPPORT_LINEAR_MAX_RETRIES
          ? null
          : buildNextRetryAt(nextRetryCount + 1),
    });

    return {
      id: request.id,
      syncStatus:
        nextRetryCount >= SUPPORT_LINEAR_MAX_RETRIES
          ? ("MAX_RETRIES_EXCEEDED" as const)
          : ("FAILED" as const),
      linearIssueIdentifier: null,
      linearIssueUrl: null,
      alreadyLinked: false,
    };
  }
}
