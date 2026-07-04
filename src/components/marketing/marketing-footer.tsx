import Link from "next/link";

import { Container } from "@/components/shared/container";
import { Logo } from "@/components/shared/logo";

export function MarketingFooter({
  companyName = "Acme Realty",
  logoUrl = null,
  buyerPortalHref = "/portal",
  adminPortalHref = "/admin",
  tagline = "A modern real estate operating system for high-trust property discovery, reservations, payments, and transaction visibility.",
}: {
  companyName?: string;
  logoUrl?: string | null;
  buyerPortalHref?: string;
  adminPortalHref?: string;
  tagline?: string;
}) {
  return (
    <footer className="border-t border-[var(--line)] bg-[color:var(--tenant-surface,white)]">
      <Container className="grid gap-10 py-14 md:grid-cols-[1.6fr_1fr_1fr]">
        <div className="space-y-4">
          <Logo href="/" name={companyName} tagline="Trusted Transactions" logoUrl={logoUrl} />
          <p className="max-w-md text-sm leading-7 text-[var(--ink-600)]">{tagline}</p>
        </div>
        <div className="space-y-3">
          <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--ink-500)]">
            Platform
          </h4>
          <div className="space-y-2 text-sm text-[var(--ink-700)]">
            <Link href="/properties" className="footer-link admin-focus block w-fit rounded">Listings</Link>
            <Link href={buyerPortalHref} className="footer-link admin-focus block w-fit rounded">Buyer Portal</Link>
            <Link href={adminPortalHref} className="footer-link admin-focus block w-fit rounded">Admin Dashboard</Link>
          </div>
        </div>
        <div className="space-y-3">
          <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--ink-500)]">
            Company
          </h4>
          <div className="space-y-2 text-sm text-[var(--ink-700)]">
            <Link href="/about" className="footer-link admin-focus block w-fit rounded">About</Link>
            <Link href="/team" className="footer-link admin-focus block w-fit rounded">Team</Link>
            <Link href="/careers" className="footer-link admin-focus block w-fit rounded">Careers</Link>
            <Link href="/contact" className="footer-link admin-focus block w-fit rounded">Contact</Link>
          </div>
        </div>
      </Container>
    </footer>
  );
}
