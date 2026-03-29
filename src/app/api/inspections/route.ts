import { Prisma } from "@prisma/client";

import { writeAuditLog } from "@/lib/audit/service";
import { ok, fail } from "@/lib/http";
import { publishDomainEvent } from "@/lib/notifications/events";
import { requirePublicTenantContext } from "@/lib/tenancy/context";
import { rejectUnsafeCompanyIdInput } from "@/lib/tenancy/db";
import { inspectionSchema } from "@/lib/validations/inquiries";

export async function POST(request: Request) {
  const tenant = await requirePublicTenantContext();
  const json = (await request.json()) as Record<string, unknown>;
  try {
    rejectUnsafeCompanyIdInput(json);
  } catch {
    return fail("Caller-provided companyId is not allowed.", 400);
  }

  const body = inspectionSchema.safeParse(json);
  if (!body.success) {
    return fail("Invalid inspection booking payload.");
  }

  await publishDomainEvent("inspection/booked", body.data);
  await writeAuditLog({
    companyId: tenant.companyId,
    action: "CREATE",
    entityType: "InspectionBooking",
    entityId: body.data.propertyId,
    summary: `Inspection booked by ${body.data.fullName}`,
    payload: body.data as unknown as Prisma.JsonObject,
  });

  return ok({ message: "Inspection booking submitted." }, { status: 201 });
}
