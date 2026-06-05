import { Ratelimit, type Duration } from "@upstash/ratelimit";
import { NextResponse } from "next/server";

import { redis } from "@/lib/cache/redis";

function createRateLimit(prefix: string, tokens: number, window: Duration) {
  return redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(tokens, window),
        analytics: true,
        prefix: `ratelimit:${prefix}`,
      })
    : null;
}

// ─── Public form submissions (existing) ──────────────────────────────────────
export const inquiryRateLimit = createRateLimit("inquiry", 10, "10 m");
export const inspectionRateLimit = createRateLimit("inspection", 8, "10 m");
export const supportRateLimit = createRateLimit("support", 5, "15 m");

// ─── Payments (cost-incurring → strict) ──────────────────────────────────────
export const paymentInitializeRateLimit = createRateLimit("payment-initialize", 10, "10 m");
export const paymentVerifyRateLimit = createRateLimit("payment-verify", 20, "10 m");

// ─── Uploads (storage + signing cost → strict) ───────────────────────────────
export const uploadSignRateLimit = createRateLimit("upload-sign", 20, "5 m");
export const uploadCompleteRateLimit = createRateLimit("upload-complete", 20, "5 m");

// ─── Authenticated portal mutations ──────────────────────────────────────────
export const kycSubmissionRateLimit = createRateLimit("kyc-submission", 6, "10 m");
export const reservationRateLimit = createRateLimit("reservation", 20, "10 m");
export const savedPropertyRateLimit = createRateLimit("saved-property", 40, "10 m");

// ─── Invitations ─────────────────────────────────────────────────────────────
// Public token lookup is rate-limited per IP to deter token enumeration.
export const invitationLookupRateLimit = createRateLimit("invitation-lookup", 20, "10 m");
export const invitationAcceptRateLimit = createRateLimit("invitation-accept", 10, "10 m");

// ─── Admin / superadmin mutations ────────────────────────────────────────────
export const adminMutationRateLimit = createRateLimit("admin-mutation", 60, "1 m");

// ─── AI generation (LLM API cost → strict) ───────────────────────────────────
export const aiDraftRateLimit = createRateLimit("ai-draft", 15, "10 m");

/**
 * Resolve the best-effort client IP from proxy headers. Vercel/most proxies set
 * x-forwarded-for; the left-most entry is the originating client.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }
  return request.headers.get("x-real-ip")?.trim() || "local";
}

/**
 * Enforce a rate limit against one or more identifiers (e.g. an IP and a user
 * id). Returns a 429 response when any identifier is over its limit, otherwise
 * null so the caller can proceed.
 *
 * Fail-open: when Redis is not configured the limiter is null and this is a
 * no-op, preserving existing behavior in environments without Upstash.
 */
export async function enforceRateLimit(
  limiter: Ratelimit | null,
  identifiers: string | string[],
  message = "Too many requests. Please slow down and try again shortly.",
): Promise<NextResponse | null> {
  if (!limiter) {
    return null;
  }

  const ids = (Array.isArray(identifiers) ? identifiers : [identifiers]).filter(Boolean);
  for (const id of ids) {
    const { success, reset } = await limiter.limit(id);
    if (!success) {
      const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
      return NextResponse.json(
        { success: false, error: message },
        { status: 429, headers: { "Retry-After": String(retryAfter) } },
      );
    }
  }

  return null;
}
