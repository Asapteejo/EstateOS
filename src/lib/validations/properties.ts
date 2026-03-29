import { z } from "zod";

export const propertyCreateSchema = z.object({
  title: z.string().min(3),
  shortDescription: z.string().min(20),
  description: z.string().min(40),
  propertyType: z.enum([
    "APARTMENT",
    "DUPLEX",
    "TERRACE",
    "DETACHED",
    "SEMI_DETACHED",
    "LAND",
    "COMMERCIAL",
  ]),
  status: z.enum(["DRAFT", "AVAILABLE", "RESERVED", "SOLD", "ARCHIVED"]),
  priceFrom: z.number().positive(),
  city: z.string().min(2),
  state: z.string().min(2),
});
