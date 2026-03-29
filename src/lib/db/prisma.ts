import { PrismaClient } from "@prisma/client";

import { env, featureFlags } from "@/lib/env";

declare global {
  var prisma: PrismaClient | undefined;
}

export const prisma =
  globalThis.prisma ??
  new PrismaClient({
    log: env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (!featureFlags.isProduction) {
  globalThis.prisma = prisma;
}
