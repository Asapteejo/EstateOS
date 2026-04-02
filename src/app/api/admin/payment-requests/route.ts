import { requireAdminSession } from "@/lib/auth/guards";
import { fail, ok } from "@/lib/http";
import { paymentRequestCreateSchema } from "@/lib/validations/payments";
import { createPaymentRequestForAdmin, listPaymentRequestsForAdmin } from "@/modules/payment-requests/service";

export async function GET() {
  try {
    const tenant = await requireAdminSession(["ADMIN"], { redirectOnMissingAuth: false });
    const rows = await listPaymentRequestsForAdmin(tenant);
    return ok(rows);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to load payment requests.", 400);
  }
}

export async function POST(request: Request) {
  try {
    const tenant = await requireAdminSession(["ADMIN"], { redirectOnMissingAuth: false });
    const json = (await request.json()) as Record<string, unknown>;
    const body = paymentRequestCreateSchema.safeParse(json);
    if (!body.success) {
      return fail("Invalid payment request payload.", 400);
    }

    const created = await createPaymentRequestForAdmin(tenant, {
      ...json,
      ...body.data,
    });
    return ok(created, { status: 201 });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to create payment request.", 400);
  }
}
