import { requireAdminSession } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { verifyDomainCname } from "@/lib/domains/verify";
import { featureFlags } from "@/lib/env";
import { fail, ok } from "@/lib/http";

export async function POST() {
  let tenant: Awaited<ReturnType<typeof requireAdminSession>>;
  try {
    tenant = await requireAdminSession(["ADMIN"], { redirectOnMissingAuth: false });
  } catch {
    return fail("Authentication required.", 401);
  }

  if (!featureFlags.hasDatabase || !tenant.companyId) {
    return fail("Service unavailable.", 503);
  }

  const company = await prisma.company.findUnique({
    where: { id: tenant.companyId },
    select: { customDomain: true },
  });

  if (!company?.customDomain) {
    return fail("No custom domain is configured.", 400);
  }

  const result = await verifyDomainCname(company.customDomain);

  const updated = await prisma.company.update({
    where: { id: tenant.companyId },
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

  return ok({
    verified: result.verified,
    reason: result.verified ? null : (result as { verified: false; reason: string }).reason,
    company: updated,
  });
}
