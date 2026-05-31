import { ZodError } from "zod";

import { requireAdminSession } from "@/lib/auth/guards";
import { fail, ok, validationFail } from "@/lib/http";
import { replyToInquiryForAdmin } from "@/modules/inquiries/service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ inquiryId: string }> },
) {
  const tenant = await requireAdminSession();
  const { inquiryId } = await params;
  const json = (await request.json()) as Record<string, unknown>;

  try {
    const reply = await replyToInquiryForAdmin(tenant, inquiryId, json);
    return ok({ reply }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return validationFail(error);
    }

    return fail(error instanceof Error ? error.message : "Unable to send inquiry reply.");
  }
}
