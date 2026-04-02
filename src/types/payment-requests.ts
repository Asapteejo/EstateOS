import type { z } from "zod";

import type { paymentRequestCreateSchema } from "@/lib/validations/payments";

export type PaymentRequestCreateInput = z.infer<typeof paymentRequestCreateSchema>;
