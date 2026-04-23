import { z } from "zod";

const optionalString = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}, z.string().trim().optional());

export const supportCategorySchema = z.enum([
  "bug",
  "feature_request",
  "question",
  "billing",
  "onboarding",
  "other",
]);

export const supportRequestSchema = z.object({
  category: supportCategorySchema,
  subject: z.string().trim().min(3).max(140),
  message: z.string().trim().min(10).max(5000),
  pageUrl: optionalString.refine(
    (value) => value == null || value.length <= 500,
    "Page URL is too long.",
  ),
  browserInfo: optionalString.refine(
    (value) => value == null || value.length <= 1000,
    "Browser information is too long.",
  ),
});

export const supportRetrySchema = z.object({
  requestId: z.string().trim().min(1),
});

export type SupportRequestInput = z.infer<typeof supportRequestSchema>;
export type SupportCategory = z.infer<typeof supportCategorySchema>;
