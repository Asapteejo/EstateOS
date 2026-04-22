import { requireAdminSession } from "@/lib/auth/guards";
import { writeAuditLog } from "@/lib/audit/service";
import { prisma } from "@/lib/db/prisma";
import { fail, ok } from "@/lib/http";
import { paymentRequestStatusUpdateSchema } from "@/lib/validations/payments";
export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ paymentRequestId: string }> },
) {
  try {
    const tenant = await requireAdminSession(["ADMIN"], { redirectOnMissingAuth: false });
    const params = await context.params;
    const json = (await request.json()) as Record<string, unknown>;
    const body = paymentRequestStatusUpdateSchema.safeParse(json);
    if (!body.success) {
      return fail("Invalid payment request status payload.", 400);
    }

    const updated = await prisma.paymentRequest.updateMany({
      where: {
        id: params.paymentRequestId,
        companyId: tenant.companyId ?? "",
        status: {
          in: ["DRAFT", "SENT", "AWAITING_PAYMENT"],
        },
      },
      data: {
        status: body.data.status,
      },
    });

    if (updated.count === 0) {
      return fail("Payment request not found or can no longer be updated.", 404);
    }

    await writeAuditLog({
      companyId: tenant.companyId ?? undefined,
      actorUserId: tenant.userId ?? undefined,
      action: "PAYMENT",
      entityType: "PaymentRequest",
      entityId: params.paymentRequestId,
      summary: `Updated payment request to ${body.data.status}`,
      payload: {
        status: body.data.status,
      },
    });

    return ok({ id: params.paymentRequestId, status: body.data.status });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to update payment request.", 400);
  }
}
