import { z } from "zod";

const emptyStringToUndefined = <TSchema extends z.ZodTypeAny>(schema: TSchema) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    schema,
  );

const optionalString = emptyStringToUndefined(z.string().trim().min(1).optional());
const optionalUrl = emptyStringToUndefined(z.string().trim().url().optional());
const optionalSlug = emptyStringToUndefined(
  z.string().trim().regex(/^[a-z0-9-]+$/).optional(),
);
const optionalBoolean = z.preprocess((value) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "") {
      return undefined;
    }

    if (normalized === "true") {
      return true;
    }

    if (normalized === "false") {
      return false;
    }
  }

  return value;
}, z.boolean().optional());

const serverEnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: optionalString,
    DIRECT_URL: optionalString,
    NEXT_PUBLIC_APP_URL: z.string().trim().url().default("http://localhost:3000"),
    NEXT_PUBLIC_PLATFORM_BASE_URL: optionalUrl,
    NEXT_PUBLIC_PORTAL_BASE_URL: optionalUrl,
    APP_BASE_URL: optionalUrl,
    PLATFORM_BASE_URL: optionalUrl,
    PORTAL_BASE_URL: optionalUrl,
    DEFAULT_COMPANY_SLUG: optionalSlug,
    ESTATEOS_ENABLE_DEV_BYPASS: optionalBoolean,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: optionalString,
    CLERK_SECRET_KEY: optionalString,
    CLERK_WEBHOOK_SECRET: optionalString,
    PAYSTACK_SECRET_KEY: optionalString,
    PAYSTACK_PUBLIC_KEY: optionalString,
    PAYSTACK_WEBHOOK_SECRET: optionalString,
    R2_ACCOUNT_ID: optionalString,
    R2_ACCESS_KEY_ID: optionalString,
    R2_SECRET_ACCESS_KEY: optionalString,
    R2_BUCKET_NAME: optionalString,
    R2_PUBLIC_BASE_URL: optionalUrl,
    MAPBOX_ACCESS_TOKEN: optionalString,
    NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN: optionalString,
    INNGEST_EVENT_KEY: optionalString,
    INNGEST_SIGNING_KEY: optionalString,
    INNGEST_BASE_URL: optionalUrl,
    CRON_SECRET: optionalString,
    UPSTASH_REDIS_REST_URL: optionalUrl,
    UPSTASH_REDIS_REST_TOKEN: optionalString,
    RESEND_API_KEY: optionalString,
    EMAIL_FROM: z.string().trim().min(3).default("Acme Realty <no-reply@example.com>"),
    TWILIO_ENABLED: optionalBoolean,
    TWILIO_ACCOUNT_SID: optionalString,
    TWILIO_AUTH_TOKEN: optionalString,
    TWILIO_WHATSAPP_FROM: optionalString, // e.g. "whatsapp:+14155238886"
    GEMINI_API_KEY: optionalString,
    SENTRY_DSN: optionalUrl,
  })
  .superRefine((value, ctx) => {
    const requireGroup = (name: string, keys: Array<keyof typeof value>) => {
      const present = keys.filter((key) => Boolean(value[key]));
      if (present.length > 0 && present.length < keys.length) {
        for (const key of keys.filter((item) => !value[item])) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${name} configuration is incomplete.`,
            path: [key],
          });
        }
      }
    };

    requireGroup("Clerk", [
      "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
      "CLERK_SECRET_KEY",
      "CLERK_WEBHOOK_SECRET",
    ]);
    requireGroup("Paystack", [
      "PAYSTACK_SECRET_KEY",
      "PAYSTACK_PUBLIC_KEY",
      "PAYSTACK_WEBHOOK_SECRET",
    ]);
    requireGroup("Cloudflare R2", [
      "R2_ACCOUNT_ID",
      "R2_ACCESS_KEY_ID",
      "R2_SECRET_ACCESS_KEY",
      "R2_BUCKET_NAME",
    ]);
    requireGroup("Upstash Redis", [
      "UPSTASH_REDIS_REST_URL",
      "UPSTASH_REDIS_REST_TOKEN",
    ]);
    requireGroup("Inngest", [
      "INNGEST_EVENT_KEY",
      "INNGEST_SIGNING_KEY",
    ]);
    if (value.TWILIO_ENABLED) {
      requireGroup("Twilio", [
        "TWILIO_ACCOUNT_SID",
        "TWILIO_AUTH_TOKEN",
        "TWILIO_WHATSAPP_FROM",
      ]);
    }

    if (
      Boolean(value.MAPBOX_ACCESS_TOKEN) !== Boolean(value.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Mapbox configuration should provide both server and public tokens together.",
        path: ["MAPBOX_ACCESS_TOKEN"],
      });
    }

  });

const publicEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.string().trim().url().default("http://localhost:3000"),
  NEXT_PUBLIC_PLATFORM_BASE_URL: optionalUrl,
  NEXT_PUBLIC_PORTAL_BASE_URL: optionalUrl,
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: optionalString,
  NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN: optionalString,
});

const instrumentationEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  SENTRY_DSN: optionalUrl,
});

export type ServerEnv = z.infer<typeof serverEnvSchema> & {
  APP_BASE_URL: string;
  PLATFORM_BASE_URL: string;
  PORTAL_BASE_URL: string;
};
export type PublicEnv = z.infer<typeof publicEnvSchema>;
export type InstrumentationEnv = z.infer<typeof instrumentationEnvSchema>;
export type FeatureFlags = ReturnType<typeof buildFeatureFlags>;

const productionRequiredKeys = [
  "DATABASE_URL",
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "CLERK_SECRET_KEY",
  "CLERK_WEBHOOK_SECRET",
  "PAYSTACK_SECRET_KEY",
  "PAYSTACK_PUBLIC_KEY",
  "PAYSTACK_WEBHOOK_SECRET",
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
] as const;

const productionServiceRules = [
  {
    service: "database",
    required: ["DATABASE_URL"] as const,
  },
  {
    service: "clerk",
    required: [
      "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
      "CLERK_SECRET_KEY",
      "CLERK_WEBHOOK_SECRET",
    ] as const,
  },
  {
    service: "paystack",
    required: [
      "PAYSTACK_SECRET_KEY",
      "PAYSTACK_PUBLIC_KEY",
      "PAYSTACK_WEBHOOK_SECRET",
    ] as const,
  },
  {
    service: "r2",
    required: [
      "R2_ACCOUNT_ID",
      "R2_ACCESS_KEY_ID",
      "R2_SECRET_ACCESS_KEY",
      "R2_BUCKET_NAME",
    ] as const,
  },
] as const;

export function parseServerEnv(raw: NodeJS.ProcessEnv): ServerEnv {
  const parsed = serverEnvSchema.parse(raw);
  return {
    ...parsed,
    APP_BASE_URL: parsed.APP_BASE_URL ?? parsed.NEXT_PUBLIC_APP_URL,
    PLATFORM_BASE_URL:
      parsed.PLATFORM_BASE_URL ??
      parsed.NEXT_PUBLIC_PLATFORM_BASE_URL ??
      parsed.APP_BASE_URL ??
      parsed.NEXT_PUBLIC_APP_URL,
    PORTAL_BASE_URL:
      parsed.PORTAL_BASE_URL ??
      parsed.NEXT_PUBLIC_PORTAL_BASE_URL ??
      parsed.APP_BASE_URL ??
      parsed.NEXT_PUBLIC_APP_URL,
  };
}

export function parsePublicEnv(raw: NodeJS.ProcessEnv): PublicEnv {
  return publicEnvSchema.parse(raw);
}

export function parseInstrumentationEnv(raw: NodeJS.ProcessEnv): InstrumentationEnv {
  return instrumentationEnvSchema.parse(raw);
}

export function buildFeatureFlags(env: ServerEnv) {
  return {
    isProduction: env.NODE_ENV === "production",
    isTest: env.NODE_ENV === "test",
    allowDevBypass:
      env.NODE_ENV === "test" ||
      (env.NODE_ENV !== "production" && env.ESTATEOS_ENABLE_DEV_BYPASS === true),
    hasDatabase: Boolean(env.DATABASE_URL),
    hasClerk:
      Boolean(env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) &&
      Boolean(env.CLERK_SECRET_KEY) &&
      Boolean(env.CLERK_WEBHOOK_SECRET),
    hasPaystack:
      Boolean(env.PAYSTACK_SECRET_KEY) &&
      Boolean(env.PAYSTACK_PUBLIC_KEY) &&
      Boolean(env.PAYSTACK_WEBHOOK_SECRET),
    hasR2:
      Boolean(env.R2_ACCOUNT_ID) &&
      Boolean(env.R2_ACCESS_KEY_ID) &&
      Boolean(env.R2_SECRET_ACCESS_KEY) &&
      Boolean(env.R2_BUCKET_NAME),
    hasMapbox:
      Boolean(env.MAPBOX_ACCESS_TOKEN) &&
      Boolean(env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN),
    hasRedis:
      Boolean(env.UPSTASH_REDIS_REST_URL) &&
      Boolean(env.UPSTASH_REDIS_REST_TOKEN),
    hasResend: Boolean(env.RESEND_API_KEY),
    hasGeminiAi: Boolean(env.GEMINI_API_KEY),
    hasSentry: Boolean(env.SENTRY_DSN),
    hasInngest:
      Boolean(env.INNGEST_EVENT_KEY) &&
      Boolean(env.INNGEST_SIGNING_KEY),
    hasTwilio:
      env.TWILIO_ENABLED === true &&
      Boolean(env.TWILIO_ACCOUNT_SID) &&
      Boolean(env.TWILIO_AUTH_TOKEN) &&
      Boolean(env.TWILIO_WHATSAPP_FROM),
  };
}

export function buildClientFlags(env: PublicEnv) {
  return {
    isProduction: env.NODE_ENV === "production",
    hasClerk: Boolean(env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY),
    hasMapbox: Boolean(env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN),
  };
}

export function getProductionReadinessIssues(env: ServerEnv) {
  if (env.NODE_ENV !== "production") {
    return [];
  }

  const issues: string[] = [];

  for (const key of productionRequiredKeys) {
    if (!env[key]) {
      issues.push(`${key} is required in production.`);
    }
  }

  for (const rule of productionServiceRules) {
    const missing = rule.required.filter((key) => !env[key]);
    if (missing.length > 0) {
      issues.push(
        `${rule.service} is not production-ready. Missing: ${missing.join(", ")}`,
      );
    }
  }

  if (
    env.TWILIO_ENABLED === true &&
    (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_WHATSAPP_FROM)
  ) {
    issues.push(
      "twilio is enabled but not production-ready. Missing: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, or TWILIO_WHATSAPP_FROM",
    );
  }

  return issues;
}

export function assertProductionRuntimeEnv(env: ServerEnv) {
  const issues = getProductionReadinessIssues(env);

  if (issues.length === 0) {
    return;
  }

  throw new Error(`Invalid production runtime environment: ${issues.join(" | ")}`);
}
