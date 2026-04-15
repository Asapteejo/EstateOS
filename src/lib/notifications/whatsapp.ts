/**
 * WhatsApp Business API wrapper via Twilio.
 *
 * Lazy-initializes the Twilio client on first use.
 * All public functions return silently when Twilio is not configured
 * or when the recipient has no phone number, so callers never need
 * to guard against missing credentials.
 */

import { featureFlags } from "@/lib/env";
import { sanitizeWhatsAppNumber } from "@/modules/team/contact";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SendWhatsAppOptions {
  /** Raw phone number string from the user profile. May be null/undefined. */
  to: string | null | undefined;
  /** Plain-text message body. Keep under 1,600 characters. */
  body: string;
}

// ─── Lazy client ─────────────────────────────────────────────────────────────

// Typed minimally so we don't import the full Twilio SDK at module scope.
interface TwilioClient {
  messages: {
    create(opts: { from: string; to: string; body: string }): Promise<{ sid: string }>;
  };
}

let _client: TwilioClient | null = null;

function getTwilioClient(): TwilioClient | null {
  if (!featureFlags.hasTwilio) return null;

  if (_client) return _client;

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const twilio = require("twilio") as (sid: string, token: string) => TwilioClient;
  _client = twilio(
    process.env.TWILIO_ACCOUNT_SID!,
    process.env.TWILIO_AUTH_TOKEN!,
  );
  return _client;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Sends a WhatsApp message to `to` via the configured Twilio sender.
 *
 * Returns `{ sent: true, sid }` on success.
 * Returns `{ sent: false, reason }` without throwing when:
 *   - Twilio credentials are not configured
 *   - `to` is null, empty, or unparseable as a phone number
 *   - Twilio returns an error (logged to console, not re-thrown)
 */
export async function sendWhatsAppMessage(opts: SendWhatsAppOptions): Promise<
  { sent: true; sid: string } | { sent: false; reason: string }
> {
  const client = getTwilioClient();
  if (!client) {
    return { sent: false, reason: "twilio_not_configured" };
  }

  const digits = sanitizeWhatsAppNumber(opts.to);
  if (!digits) {
    return { sent: false, reason: "no_phone_number" };
  }

  const from = process.env.TWILIO_WHATSAPP_FROM!;
  const to = `whatsapp:+${digits}`;

  try {
    const msg = await client.messages.create({ from, to, body: opts.body });
    return { sent: true, sid: msg.sid };
  } catch (err) {
    console.error("[whatsapp] Failed to send message to", to, err);
    return { sent: false, reason: "twilio_error" };
  }
}
