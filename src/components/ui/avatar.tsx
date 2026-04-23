"use client";

import { useMemo, useState } from "react";

import { OptimizedImage } from "@/components/media/optimized-image";
import { cn } from "@/lib/utils";

function getInitials(name: string) {
  const trimmed = name.trim();
  if (!trimmed) {
    return "?";
  }

  const parts = trimmed
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return "?";
  }

  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }

  return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
}

const sizeClasses = {
  sm: {
    frame: "h-10 w-10",
    text: "text-[10px]",
  },
  md: {
    frame: "h-12 w-12",
    text: "text-xs",
  },
  lg: {
    frame: "h-16 w-16",
    text: "text-sm",
  },
} as const;

export function Avatar({
  name,
  imageUrl,
  size = "md",
  className,
}: {
  name: string;
  imageUrl?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const initials = useMemo(() => getInitials(name), [name]);
  const selectedSize = sizeClasses[size];
  const showImage = Boolean(imageUrl) && failedImageUrl !== imageUrl;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-full border border-[var(--tenant-nav-border)] bg-[var(--sand-100)]",
        selectedSize.frame,
        className,
      )}
      aria-label={name}
    >
      {showImage && imageUrl ? (
        <OptimizedImage
          src={imageUrl}
          alt={name}
          fill
          preset="thumbnail"
          className="object-cover"
          onError={() => setFailedImageUrl(imageUrl)}
        />
      ) : (
        <div
          className={cn(
            "flex h-full w-full items-center justify-center font-semibold uppercase tracking-[0.14em] text-[var(--ink-500)]",
            selectedSize.text,
          )}
        >
          {initials}
        </div>
      )}
    </div>
  );
}
