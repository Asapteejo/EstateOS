import * as Sentry from "@sentry/nextjs";

import { parseInstrumentationEnv } from "@/lib/config";

const instrumentationEnv = parseInstrumentationEnv(process.env);
const hasSentry = Boolean(instrumentationEnv.SENTRY_DSN);
const isProduction = instrumentationEnv.NODE_ENV === "production";

export function initializeSentry() {
  if (!hasSentry) {
    return;
  }

  Sentry.init({
    dsn: instrumentationEnv.SENTRY_DSN,
    tracesSampleRate: isProduction ? 0.1 : 1,
  });
}

export function captureException(error: unknown) {
  if (!hasSentry) {
    console.error(error);
    return;
  }

  Sentry.captureException(error);
}
