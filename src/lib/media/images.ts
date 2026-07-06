export const imagePresetSizes = {
  thumbnail: "(max-width: 768px) 40vw, 160px",
  card: "(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw",
  hero: "(max-width: 768px) 100vw, 1200px",
  profile: "(max-width: 768px) 44vw, 280px",
} as const;

export type ImagePreset = keyof typeof imagePresetSizes;

function tryParseUrl(value: string) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

export function isRelativeAssetUrl(value: string) {
  return value.startsWith("/");
}

/**
 * Hosts the next/image optimizer is allowed to fetch from — must stay in sync
 * with images.remotePatterns in next.config.ts. NEXT_PUBLIC_R2_PUBLIC_HOST is
 * inlined at build time from R2_PUBLIC_BASE_URL, so tenant media on the
 * public R2 domain gets real optimization (AVIF/WebP, resizing) instead of
 * shipping full-size originals. Presigned *.r2.cloudflarestorage.com URLs
 * stay unoptimized on purpose: per-request signatures defeat the optimizer
 * cache and can expire before the fetch happens.
 */
function isOptimizableHost(hostname: string) {
  if (hostname === "images.unsplash.com") {
    return true;
  }

  if (hostname.endsWith(".r2.dev")) {
    return true;
  }

  const r2PublicHost = process.env.NEXT_PUBLIC_R2_PUBLIC_HOST;
  return Boolean(r2PublicHost) && hostname === r2PublicHost;
}

export function shouldUseUnoptimizedImage(value: string) {
  if (!value) {
    return false;
  }

  if (isRelativeAssetUrl(value)) {
    return false;
  }

  const parsed = tryParseUrl(value);
  if (!parsed) {
    return false;
  }

  return !isOptimizableHost(parsed.hostname);
}

export function getImageSizes(preset: ImagePreset, custom?: string) {
  return custom ?? imagePresetSizes[preset];
}
