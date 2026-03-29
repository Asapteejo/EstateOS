import { z } from "zod";

export const reservationCreateSchema = z.object({
  propertyId: z.string().min(1),
  propertyUnitId: z.string().min(1).optional(),
});

export type ReservationCreateInput = z.infer<typeof reservationCreateSchema>;
