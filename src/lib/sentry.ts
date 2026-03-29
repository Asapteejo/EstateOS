import * as Sentry from "@sentry/nextjs";

import { env, featureFlags } from "@/lib/env";

export function initializeSentry() {
  if (!featureFlags.hasSentry) {
    return;
  }

  Sentry.init({
    dsn: env.SENTRY_DSN,
    tracesSampleRate: featureFlags.isProduction ? 0.1 : 1,
  });
}

export function captureException(error: unknown) {
  if (!featureFlags.hasSentry) {
    console.error(error);
    return;
  }

  Sentry.captureException(error);
}
