import { z } from "zod";

export const uploadRequestSchema = z.object({
  domain: z.enum(["property-media", "kyc", "receipts", "contracts", "brochures"]),
  fileName: z.string().min(2),
  contentType: z.string().min(3),
});
