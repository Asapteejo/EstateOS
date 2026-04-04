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

  return parsed.hostname !== "images.unsplash.com";
}

export function getImageSizes(preset: ImagePreset, custom?: string) {
  return custom ?? imagePresetSizes[preset];
}
