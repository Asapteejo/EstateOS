import { z } from "zod";

export const inquirySchema = z.object({
  propertyId: z.string().optional(),
  source: z.enum(["WEBSITE", "WALK_IN", "REFERRAL", "WHATSAPP", "SOCIAL_MEDIA", "PAID_ADS", "AGENT", "PARTNER"]).optional(),
  fullName: z.string().min(2),
  email: z.email(),
  phone: z.string().optional(),
  message: z.string().min(10),
});

export const portalInquirySchema = z.object({
  propertyId: z.string().trim().optional().transform((value) => value || undefined),
  category: z.enum(["PROPERTY_GUIDANCE", "AVAILABILITY", "PAYMENT_STEPS", "DOCUMENTS", "OTHER"]).default("PROPERTY_GUIDANCE"),
  message: z.string().trim().min(10, "Enter a message with at least 10 characters."),
});

export const inspectionSchema = z.object({
  propertyId: z.string().min(1),
  inquiryId: z.string().optional(),
  fullName: z.string().min(2),
  email: z.email(),
  phone: z.string().min(7),
  scheduledFor: z.string().min(1).refine((value) => !Number.isNaN(new Date(value).getTime()), {
    message: "scheduledFor must be a valid date/time",
  }),
});

export const inquiryUpdateSchema = z.object({
  status: z.enum([
    "NEW",
    "CONTACTED",
    "INSPECTION_BOOKED",
    "QUALIFIED",
    "CONVERTED",
    "CLOSED",
    "LOST",
  ]),
  assignedStaffId: z.string().nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

export const inquiryReplySchema = z.object({
  message: z.string().trim().min(10, "Enter a reply with at least 10 characters.").max(2000),
});

export const inspectionUpdateSchema = z.object({
  status: z.enum([
    "PENDING",
    "REQUESTED",
    "CONFIRMED",
    "RESCHEDULED",
    "COMPLETED",
    "CANCELLED",
    "NO_SHOW",
  ]),
  assignedStaffId: z.string().nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  scheduledFor: z
    .string()
    .min(1)
    .refine((value) => !Number.isNaN(new Date(value).getTime()), {
      message: "scheduledFor must be a valid date/time",
    })
    .optional(),
});
