import { z } from "zod";

export const inquirySchema = z.object({
  propertyId: z.string().optional(),
  fullName: z.string().min(2),
  email: z.email(),
  phone: z.string().optional(),
  message: z.string().min(10),
});

export const inspectionSchema = z.object({
  propertyId: z.string().min(1),
  fullName: z.string().min(2),
  email: z.email(),
  phone: z.string().min(7),
  scheduledFor: z.string().min(1),
});
