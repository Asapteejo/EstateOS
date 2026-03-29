import { z } from "zod";

export const notificationActionSchema = z.object({
  notificationId: z.string().min(1),
});
