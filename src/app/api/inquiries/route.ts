import { Prisma } from "@prisma/client";

import { writeAuditLog } from "@/lib/audit/service";
import { ok, fail } from "@/lib/http";
import { publishDomainEvent } from "@/lib/notifications/events";
import { inquiryRateLimit } from "@/lib/rate-limit";
import { requirePublicTenantContext } from "@/lib/tenancy/context";
import { rejectUnsafeCompanyIdInput } from "@/lib/tenancy/db";
import { inquirySchema } from "@/lib/validations/inquiries";

export async function POST(request: Request) {
  const tenant = await requirePublicTenantContext();
  const ip = request.headers.get("x-forwarded-for") ?? "local";

  if (inquiryRateLimit) {
    const { success } = await inquiryRateLimit.limit(ip);
    if (!success) {
      return fail("Too many inquiries. Please try again shortly.", 429);
    }
  }

  const json = (await request.json()) as Record<string, unknown>;
  try {
    rejectUnsafeCompanyIdInput(json);
  } catch {
    return fail("Caller-provided companyId is not allowed.", 400);
  }

  const body = inquirySchema.safeParse(json);
  if (!body.success) {
    return fail("Invalid inquiry payload.");
  }

  await publishDomainEvent("inquiry/received", body.data);
  await writeAuditLog({
    companyId: tenant.companyId,
    action: "CREATE",
    entityType: "Inquiry",
    entityId: body.data.propertyId ?? "general",
    summary: `Inquiry received from ${body.data.fullName}`,
    payload: body.data as unknown as Prisma.JsonObject,
  });

  return ok({ message: "Inquiry received." }, { status: 201 });
}
