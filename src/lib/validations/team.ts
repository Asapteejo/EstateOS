import { z } from "zod";

const optionalTrimmedString = z.string().trim().optional().transform((value) => value || undefined);

export const teamMemberMutationSchema = z.object({
  fullName: z.string().trim().min(3),
  slug: z.string().trim().min(2).optional(),
  title: z.string().trim().min(2),
  bio: z.string().trim().min(20),
  avatarUrl: optionalTrimmedString,
  email: z.email().optional().or(z.literal("")).transform((value) => value || undefined),
  phone: optionalTrimmedString,
  whatsappNumber: optionalTrimmedString,
  staffCode: optionalTrimmedString,
  officeLocation: optionalTrimmedString,
  resumeDocumentId: z.string().optional(),
  profileHighlights: z.array(z.string().trim().min(2)).default([]),
  portfolioText: optionalTrimmedString,
  portfolioLinks: z.array(z.string().trim().url()).default([]),
  socialLinks: z.array(z.string().trim().url()).default([]),
  specialties: z.array(z.string().trim().min(2)).default([]),
  sortOrder: z.coerce.number().int().min(0).default(0),
  isActive: z.coerce.boolean().default(true),
  isPublished: z.coerce.boolean().default(true),
});

export type TeamMemberMutationInput = z.infer<typeof teamMemberMutationSchema>;
