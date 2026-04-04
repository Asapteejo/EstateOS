import { env } from "@/lib/env";

export function buildPublicAssetUrl(storageKey: string) {
  if (env.R2_PUBLIC_BASE_URL) {
    return `${env.R2_PUBLIC_BASE_URL.replace(/\/$/, "")}/${storageKey}`;
  }

  return `/api/assets/public/${storageKey}`;
}
