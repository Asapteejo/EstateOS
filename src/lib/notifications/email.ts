import { Resend } from "resend";

import { env, featureFlags } from "@/lib/env";

export const resend = featureFlags.hasResend
  ? new Resend(env.RESEND_API_KEY)
  : null;

export async function sendTransactionalEmail(input: {
  to: string;
  subject: string;
  html: string;
}) {
  if (!resend) {
    return { id: "demo-email", ...input };
  }

  return resend.emails.send({
    from: env.EMAIL_FROM,
    to: input.to,
    subject: input.subject,
    html: input.html,
  });
}
