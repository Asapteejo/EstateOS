import Link from "next/link";

import { Container } from "@/components/shared/container";
import { Logo } from "@/components/shared/logo";

export function MarketingFooter() {
  return (
    <footer className="border-t border-[var(--line)] bg-white">
      <Container className="grid gap-10 py-14 md:grid-cols-[1.6fr_1fr_1fr]">
        <div className="space-y-4">
          <Logo href="/properties" />
          <p className="max-w-md text-sm leading-7 text-[var(--ink-600)]">
            A modern real estate operating system for high-trust property discovery,
            reservations, payments, and transaction visibility.
          </p>
        </div>
        <div className="space-y-3">
          <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--ink-500)]">
            Platform
          </h4>
          <div className="space-y-2 text-sm text-[var(--ink-700)]">
            <Link href="/properties" className="block">Listings</Link>
            <Link href="/portal" className="block">Buyer Portal</Link>
            <Link href="/admin" className="block">Admin Dashboard</Link>
          </div>
        </div>
        <div className="space-y-3">
          <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--ink-500)]">
            Company
          </h4>
          <div className="space-y-2 text-sm text-[var(--ink-700)]">
            <Link href="/about" className="block">About</Link>
            <Link href="/team" className="block">Team</Link>
            <Link href="/careers" className="block">Careers</Link>
            <Link href="/contact" className="block">Contact</Link>
          </div>
        </div>
      </Container>
    </footer>
  );
}
