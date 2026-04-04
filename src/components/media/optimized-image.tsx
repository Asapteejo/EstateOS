import Image, { type ImageProps } from "next/image";

import { getImageSizes, shouldUseUnoptimizedImage, type ImagePreset } from "@/lib/media/images";

type OptimizedImageProps = Omit<ImageProps, "sizes"> & {
  alt: string;
  preset?: ImagePreset;
  sizes?: string;
};

export function OptimizedImage({
  preset = "card",
  sizes,
  unoptimized,
  ...props
}: OptimizedImageProps) {
  const src = typeof props.src === "string" ? props.src : "";

  return (
    // eslint-disable-next-line jsx-a11y/alt-text
    <Image
      {...props}
      sizes={getImageSizes(preset, sizes)}
      unoptimized={unoptimized ?? shouldUseUnoptimizedImage(src)}
    />
  );
}
