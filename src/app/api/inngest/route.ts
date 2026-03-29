import { serve } from "inngest/next";

import { inngest } from "@/lib/notifications/events";
import { notificationFunctions } from "@/inngest/functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: notificationFunctions,
});
