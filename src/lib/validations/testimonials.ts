import { z } from "zod";

export const testimonialSubmissionSchema = z.object({
  propertyId: z.string().trim().optional().transform((value) => value || undefined),
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().trim().max(120).optional().transform((value) => value || undefined),
  quote: z.string().trim().min(20, "Write at least 20 characters.").max(2000),
});

export const testimonialResubmissionSchema = testimonialSubmissionSchema;

export const testimonialAdminActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("APPROVE"),
    adminNote: z.string().trim().max(1000).optional().transform((value) => value || undefined),
  }),
  z.object({
    action: z.literal("APPROVE_AND_PUBLISH"),
    adminNote: z.string().trim().max(1000).optional().transform((value) => value || undefined),
  }),
  z.object({
    action: z.literal("REJECT"),
    rejectionReason: z.string().trim().min(5, "Rejection reason is required.").max(1000),
    adminNote: z.string().trim().max(1000).optional().transform((value) => value || undefined),
  }),
  z.object({
    action: z.literal("PUBLISH"),
  }),
  z.object({
    action: z.literal("UNPUBLISH"),
  }),
  z.object({
    action: z.literal("DELETE"),
  }),
]);

export const publicTestimonialsFilterSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5).optional(),
  propertyId: z.string().trim().optional().transform((value) => value || undefined),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  from: z.string().trim().optional().transform((value) => value || undefined),
  to: z.string().trim().optional().transform((value) => value || undefined),
  q: z.string().trim().max(120).optional().transform((value) => value || undefined),
});

export type TestimonialSubmissionInput = z.infer<typeof testimonialSubmissionSchema>;
export type TestimonialAdminActionInput = z.infer<typeof testimonialAdminActionSchema>;
export type PublicTestimonialsFilterInput = z.infer<typeof publicTestimonialsFilterSchema>;
