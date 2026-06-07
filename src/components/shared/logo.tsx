import Link from "next/link";

import { OptimizedImage } from "@/components/media/optimized-image";

function buildMonogram(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "EO";
}

export function Logo({
  href = "/properties",
  name = "Acme Realty",
  tagline = "Trusted Transactions",
  logoUrl,
}: {
  href?: string;
  name?: string;
  tagline?: string;
  logoUrl?: string | null;
}) {
  const monogram = buildMonogram(name);

  return (
    <Link href={href} className="tenant-logo inline-flex max-w-full min-w-0 items-center gap-3 [container-type:inline-size]" aria-label={`${name} home`} title={name}>
      <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[var(--tenant-primary,var(--brand-700))] text-sm font-semibold text-[var(--tenant-primary-foreground,#fff)] ring-1 ring-[var(--tenant-border,var(--line))]">
        {logoUrl ? (
          <OptimizedImage src={logoUrl} alt={`${name} logo`} fill preset="thumbnail" className="bg-white object-contain p-1.5" />
        ) : (
          monogram
        )}
      </div>
      <div className="min-w-0 flex-1 overflow-visible sm:min-w-[11rem]">
        <div className="tenant-logo-name font-serif text-lg font-semibold leading-tight text-[var(--ink-950)]">
          {name}
        </div>
        <div className="tenant-logo-tagline mt-1 hidden text-xs uppercase leading-tight tracking-[0.18em] text-[var(--ink-500)] sm:block">
          {tagline}
        </div>
      </div>
    </Link>
  );
}
