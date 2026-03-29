import Link from "next/link";

export function Logo({ href = "/properties" }: { href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--brand-700)] text-white">
        AR
      </div>
      <div>
        <div className="font-serif text-xl font-semibold text-[var(--ink-950)]">
          Acme Realty
        </div>
        <div className="text-xs uppercase tracking-[0.24em] text-[var(--ink-500)]">
          Trusted Transactions
        </div>
      </div>
    </Link>
  );
}
