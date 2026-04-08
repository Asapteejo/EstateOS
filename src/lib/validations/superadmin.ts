import { z } from "zod";

export const companyLifecycleUpdateSchema = z.object({
  status: z.enum(["ACTIVE", "SUSPENDED", "DISABLED"]),
  reason: z.string().trim().max(300).optional().nullable(),
});

export type CompanyLifecycleUpdateInput = z.infer<typeof companyLifecycleUpdateSchema>;
