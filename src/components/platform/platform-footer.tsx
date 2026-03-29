import Link from "next/link";

import { Container } from "@/components/shared/container";

export function PlatformFooter() {
  return (
    <footer className="border-t border-[var(--line)] bg-[var(--sand-50)]">
      <Container className="grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--ink-950)] text-white">
              EO
            </div>
            <div>
              <div className="font-serif text-xl font-semibold text-[var(--ink-950)]">EstateOS</div>
              <div className="text-xs uppercase tracking-[0.22em] text-[var(--ink-500)]">
                Platform owner layer
              </div>
            </div>
          </div>
          <p className="max-w-md text-sm leading-7 text-[var(--ink-600)]">
            EstateOS is the operating layer for real estate companies that need listings,
            CRM, buyer portal, transaction workflow, commissionable payments, and clean
            multi-tenant control.
          </p>
        </div>

        <div className="space-y-3">
          <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--ink-500)]">
            Platform
          </h4>
          <div className="space-y-2 text-sm text-[var(--ink-700)]">
            <Link href="/" className="block">
              Platform home
            </Link>
            <Link href="/platform/features" className="block">
              Features
            </Link>
            <Link href="/platform/pricing" className="block">
              Pricing
            </Link>
            <Link href="/superadmin" className="block">
              Superadmin
            </Link>
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--ink-500)]">
            Tenant surfaces
          </h4>
          <div className="space-y-2 text-sm text-[var(--ink-700)]">
            <Link href="/properties" className="block">
              Tenant listings
            </Link>
            <Link href="/portal" className="block">
              Buyer portal
            </Link>
            <Link href="/admin" className="block">
              Tenant admin
            </Link>
          </div>
        </div>
      </Container>
    </footer>
  );
}
