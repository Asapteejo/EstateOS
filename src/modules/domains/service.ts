import type { Prisma } from "@prisma/client";

import { writeAuditLog } from "@/lib/audit/service";
import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";
import {
  assertDomainAssignable,
  buildCustomDomainDnsInstructions,
  buildDomainMetadataUpdate,
  normalizeCustomDomain,
  REMOVE_CUSTOM_DOMAIN_CONFIRMATION,
  isCustomDomainIntentionallySkipped,
  readCustomDomainSetupMetadata,
} from "@/lib/domains/custom-domain";
import { verifyTenantDomainDns } from "@/lib/domains/verify";
import {
  addVercelProjectDomainsForTenant,
  checkVercelProjectDomainsForTenant,
  removeVercelProjectDomainsForTenant,
  toCustomDomainVercelMetadata,
} from "@/lib/vercel/domains";

type DomainActor = {
  userId?: string | null;
  source: "tenant_admin" | "superadmin";
};

function getVercelConfig() {
  return {
    apiToken: env.VERCEL_API_TOKEN,
    projectId: env.VERCEL_PROJECT_ID,
    projectName: env.VERCEL_PROJECT_NAME,
    teamId: env.VERCEL_TEAM_ID,
  };
}

export async function getCompanyDomainSetup(companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      name: true,
      slug: true,
      customDomain: true,
      customDomainStatus: true,
      customDomainVerifiedAt: true,
      brandSettings: true,
    },
  });
  if (!company) throw new Error("Company not found.");

  return {
    company,
    intentionallySkipped: isCustomDomainIntentionallySkipped(company.brandSettings),
    vercel: readCustomDomainSetupMetadata(company.brandSettings).customDomainSetup?.vercel ?? null,
    dns: buildCustomDomainDnsInstructions({
      cnameTarget: env.CUSTOM_DOMAIN_CNAME_TARGET,
      rootTarget: env.CUSTOM_DOMAIN_ROOT_TARGET,
    }),
    routingStatus: company.customDomainStatus === "VERIFIED"
      ? "Domain verified. Routing should work once the platform host accepts this domain."
      : "Domain collected; routing verification pending platform configuration.",
  };
}

export async function setCompanyCustomDomain(input: {
  companyId: string;
  customDomain: string | null;
  actor: DomainActor;
}) {
  const normalizedDomain = normalizeCustomDomain(input.customDomain);
  const current = await prisma.company.findUnique({
    where: { id: input.companyId },
    select: { id: true, customDomain: true, brandSettings: true },
  });
  if (!current) throw new Error("Company not found.");

  if (normalizedDomain) {
    const conflict = await prisma.company.findFirst({
      where: { customDomain: normalizedDomain, id: { not: input.companyId } },
      select: { id: true },
    });
    assertDomainAssignable({
      requestedDomain: normalizedDomain,
      targetCompanyId: input.companyId,
      conflictCompanyId: conflict?.id,
    });
  }

  const vercelResult = normalizedDomain
    ? await addVercelProjectDomainsForTenant(normalizedDomain, getVercelConfig())
    : null;

  const company = await prisma.company.update({
    where: { id: input.companyId },
    data: {
      customDomain: normalizedDomain,
      customDomainStatus: normalizedDomain ? "PENDING" : null,
      customDomainVerifiedAt: null,
      brandSettings: buildDomainMetadataUpdate({
        brandSettings: current.brandSettings,
        intentionallySkipped: false,
        actorUserId: input.actor.userId,
        actor: input.actor.source,
        vercel: vercelResult ? toCustomDomainVercelMetadata(vercelResult) : null,
      }),
    },
    select: {
      id: true,
      customDomain: true,
      customDomainStatus: true,
      customDomainVerifiedAt: true,
    },
  });

  await writeAuditLog({
    companyId: input.companyId,
    actorUserId: input.actor.userId ?? undefined,
    action: "UPDATE",
    entityType: "CompanyCustomDomain",
    entityId: input.companyId,
    summary: `${input.actor.source === "superadmin" ? "Superadmin" : "Tenant admin"} updated tenant custom domain.`,
    payload: {
      customDomain: normalizedDomain,
      source: input.actor.source,
      vercel: vercelResult
        ? {
            configured: vercelResult.configured,
            attached: vercelResult.attached,
            manualSetupRequired: vercelResult.manualSetupRequired,
            domains: vercelResult.domains.map((record) => ({
              name: record.name,
              attached: record.attached,
              verified: record.verified ?? null,
              misconfigured: record.misconfigured ?? null,
              error: record.error ?? null,
            })),
          }
        : null,
    } as Prisma.InputJsonValue,
  });

  return company;
}

export async function markCompanyCustomDomainSkipped(input: {
  companyId: string;
  actor: DomainActor;
}) {
  const current = await prisma.company.findUnique({
    where: { id: input.companyId },
    select: { id: true, brandSettings: true },
  });
  if (!current) throw new Error("Company not found.");

  const company = await prisma.company.update({
    where: { id: input.companyId },
    data: {
      customDomain: null,
      customDomainStatus: null,
      customDomainVerifiedAt: null,
      brandSettings: buildDomainMetadataUpdate({
        brandSettings: current.brandSettings,
        intentionallySkipped: true,
        actorUserId: input.actor.userId,
        actor: input.actor.source,
        vercel: null,
      }),
    },
    select: { id: true, customDomain: true, customDomainStatus: true },
  });

  await writeAuditLog({
    companyId: input.companyId,
    actorUserId: input.actor.userId ?? undefined,
    action: "UPDATE",
    entityType: "CompanyCustomDomain",
    entityId: input.companyId,
    summary: "Custom domain intentionally skipped.",
    payload: { source: input.actor.source } as Prisma.InputJsonValue,
  });

  return company;
}

export async function removeCompanyCustomDomain(input: {
  companyId: string;
  confirmation: string | null;
  actor: DomainActor;
}) {
  if (input.confirmation !== REMOVE_CUSTOM_DOMAIN_CONFIRMATION) {
    throw new Error(`Removing a custom domain requires confirmation: ${REMOVE_CUSTOM_DOMAIN_CONFIRMATION}.`);
  }

  const current = await prisma.company.findUnique({
    where: { id: input.companyId },
    select: { customDomain: true },
  });
  if (!current?.customDomain) {
    return setCompanyCustomDomain({
      companyId: input.companyId,
      customDomain: null,
      actor: input.actor,
    });
  }

  const stillAssigned = await prisma.company.findFirst({
    where: {
      customDomain: current.customDomain,
      id: { not: input.companyId },
    },
    select: { id: true },
  });
  if (!stillAssigned) {
    await removeVercelProjectDomainsForTenant(current.customDomain, getVercelConfig());
  }

  return setCompanyCustomDomain({
    companyId: input.companyId,
    customDomain: null,
    actor: input.actor,
  });
}

export async function verifyCompanyCustomDomain(input: {
  companyId: string;
  actor: DomainActor;
}) {
  const company = await prisma.company.findUnique({
    where: { id: input.companyId },
    select: { customDomain: true, brandSettings: true },
  });
  if (!company?.customDomain) throw new Error("No custom domain is configured.");

  const collision = await prisma.company.findFirst({
    where: { customDomain: company.customDomain, id: { not: input.companyId } },
    select: { id: true },
  });
  assertDomainAssignable({
    requestedDomain: company.customDomain,
    targetCompanyId: input.companyId,
    conflictCompanyId: collision?.id,
  });

  const [dnsResult, vercelResult] = await Promise.all([
    verifyTenantDomainDns(company.customDomain, {
      cnameTarget: env.CUSTOM_DOMAIN_CNAME_TARGET,
      rootTarget: env.CUSTOM_DOMAIN_ROOT_TARGET,
    }),
    checkVercelProjectDomainsForTenant(company.customDomain, getVercelConfig()),
  ]);
  const verified = dnsResult.verified && vercelResult.configured && vercelResult.attached;
  const reason = verified
    ? null
    : [
        dnsResult.reason,
        vercelResult.configured
          ? vercelResult.error
          : "Vercel API not configured. Add this domain manually in Vercel.",
        vercelResult.configured && !vercelResult.attached
          ? "Domain is not attached to the EstateOS Vercel project."
          : null,
      ].filter(Boolean).join(" ");
  const vercelMetadata = toCustomDomainVercelMetadata(vercelResult, new Date(), "verify");
  const updated = await prisma.company.update({
    where: { id: input.companyId },
    data: {
      customDomainStatus: verified ? "VERIFIED" : "FAILED",
      customDomainVerifiedAt: verified ? new Date() : null,
      brandSettings: buildDomainMetadataUpdate({
        brandSettings: company.brandSettings,
        intentionallySkipped: false,
        actorUserId: input.actor.userId,
        actor: input.actor.source,
        vercel: vercelMetadata,
      }),
    },
    select: {
      customDomain: true,
      customDomainStatus: true,
      customDomainVerifiedAt: true,
    },
  });

  await writeAuditLog({
    companyId: input.companyId,
    actorUserId: input.actor.userId ?? undefined,
    action: "UPDATE",
    entityType: "CompanyCustomDomain",
    entityId: input.companyId,
    summary: "Custom domain verification attempted.",
    payload: {
      verified,
      reason,
      dns: dnsResult,
      vercel: {
        configured: vercelResult.configured,
        attached: vercelResult.attached,
        manualSetupRequired: vercelResult.manualSetupRequired,
        domains: vercelMetadata.domains ?? [],
      },
      source: input.actor.source,
    } as Prisma.InputJsonValue,
  });

  return {
    verified,
    reason,
    dns: dnsResult,
    vercel: vercelMetadata,
    company: updated,
  };
}
