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
  return (
    <Link href={href} className="inline-flex items-center gap-3">
      <div className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-[var(--brand-700)] text-white">
        {logoUrl ? (
          <OptimizedImage src={logoUrl} alt={name} fill preset="thumbnail" className="object-cover" />
        ) : (
          buildMonogram(name)
        )}
      </div>
      <div>
        <div className="font-serif text-xl font-semibold text-[var(--ink-950)]">
          {name}
        </div>
        <div className="text-xs uppercase tracking-[0.24em] text-[var(--ink-500)]">
          {tagline}
        </div>
      </div>
    </Link>
  );
}
