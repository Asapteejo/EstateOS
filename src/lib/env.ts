import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().default("http://localhost:3000"),
  DEFAULT_COMPANY_SLUG: z.string().optional(),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().optional(),
  CLERK_SECRET_KEY: z.string().optional(),
  CLERK_WEBHOOK_SECRET: z.string().optional(),
  PAYSTACK_SECRET_KEY: z.string().optional(),
  PAYSTACK_PUBLIC_KEY: z.string().optional(),
  PAYSTACK_WEBHOOK_SECRET: z.string().optional(),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().optional(),
  R2_PUBLIC_BASE_URL: z.string().optional(),
  MAPBOX_ACCESS_TOKEN: z.string().optional(),
  NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN: z.string().optional(),
  INNGEST_EVENT_KEY: z.string().optional(),
  INNGEST_SIGNING_KEY: z.string().optional(),
  INNGEST_BASE_URL: z.string().optional(),
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("Acme Realty <no-reply@example.com>"),
  SENTRY_DSN: z.string().optional(),
});

export const env = envSchema.parse(process.env);

export const featureFlags = {
  isProduction: env.NODE_ENV === "production",
  hasDatabase: Boolean(env.DATABASE_URL),
  hasClerk:
    Boolean(env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) &&
    Boolean(env.CLERK_SECRET_KEY),
  hasPaystack: Boolean(env.PAYSTACK_SECRET_KEY),
  hasR2:
    Boolean(env.R2_ACCOUNT_ID) &&
    Boolean(env.R2_ACCESS_KEY_ID) &&
    Boolean(env.R2_SECRET_ACCESS_KEY) &&
    Boolean(env.R2_BUCKET_NAME),
  hasMapbox: Boolean(env.MAPBOX_ACCESS_TOKEN || env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN),
  hasRedis:
    Boolean(env.UPSTASH_REDIS_REST_URL) &&
    Boolean(env.UPSTASH_REDIS_REST_TOKEN),
  hasResend: Boolean(env.RESEND_API_KEY),
  hasSentry: Boolean(env.SENTRY_DSN),
};
