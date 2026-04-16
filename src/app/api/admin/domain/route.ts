import { z } from "zod";

import { requireAdminSession } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";
import { fail, ok } from "@/lib/http";

const schema = z.object({
  customDomain: z
    .string()
    .trim()
    .toLowerCase()
    .transform((v) => v.replace(/^https?:\/\//, "").split("/")[0] ?? "")
    .refine((v) => !v || /^[a-z0-9.-]+\.[a-z]{2,}$/.test(v), {
      message: "Enter a valid domain (e.g. sales.yourbrand.com).",
    })
    .optional()
    .or(z.literal("")),
});

// ─── PATCH — save custom domain ──────────────────────────────────────────────

export async function PATCH(request: Request) {
  let tenant: Awaited<ReturnType<typeof requireAdminSession>>;
  try {
    tenant = await requireAdminSession(["ADMIN"], { redirectOnMissingAuth: false });
  } catch {
    return fail("Authentication required.", 401);
  }

  if (!featureFlags.hasDatabase || !tenant.companyId) {
    return fail("Service unavailable.", 503);
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return fail("Invalid request body.", 400);
  }

  const body = schema.safeParse(json);
  if (!body.success) {
    return fail(body.error.issues[0]?.message ?? "Invalid input.", 400);
  }

  const newDomain = body.data.customDomain || null;

  // Check uniqueness if setting a domain
  if (newDomain) {
    const conflict = await prisma.company.findFirst({
      where: { customDomain: newDomain, id: { not: tenant.companyId } },
      select: { id: true },
    });
    if (conflict) {
      return fail("This domain is already in use by another workspace.", 409);
    }
  }

  const company = await prisma.company.update({
    where: { id: tenant.companyId },
    data: {
      customDomain: newDomain,
      // Reset verification whenever the domain changes
      customDomainStatus: newDomain ? "PENDING" : null,
      customDomainVerifiedAt: null,
    },
    select: {
      customDomain: true,
      customDomainStatus: true,
      customDomainVerifiedAt: true,
    },
  });

  return ok({ company });
}
