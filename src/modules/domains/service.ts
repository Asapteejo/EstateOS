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
} from "@/lib/domains/custom-domain";
import { verifyDomainCname } from "@/lib/domains/verify";

type DomainActor = {
  userId?: string | null;
  source: "tenant_admin" | "superadmin";
};

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
    select: { customDomain: true },
  });
  if (!company?.customDomain) throw new Error("No custom domain is configured.");

  const result = await verifyDomainCname(company.customDomain, env.CUSTOM_DOMAIN_CNAME_TARGET);
  const updated = await prisma.company.update({
    where: { id: input.companyId },
    data: {
      customDomainStatus: result.verified ? "VERIFIED" : "FAILED",
      customDomainVerifiedAt: result.verified ? new Date() : null,
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
      verified: result.verified,
      reason: result.verified ? null : result.reason,
      source: input.actor.source,
    } as Prisma.InputJsonValue,
  });

  return {
    verified: result.verified,
    reason: result.verified ? null : result.reason,
    company: updated,
  };
}
