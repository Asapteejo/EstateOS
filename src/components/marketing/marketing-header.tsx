import Link from "next/link";

import { Container } from "@/components/shared/container";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";

const links = [
  { href: "/about", label: "About" },
  { href: "/properties", label: "Listings" },
  { href: "/team", label: "Team" },
  { href: "/blog", label: "Insights" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
];

export function MarketingHeader({
  companyName = "Acme Realty",
  logoUrl = null,
  buyerPortalHref = "/portal",
}: {
  companyName?: string;
  logoUrl?: string | null;
  buyerPortalHref?: string;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--tenant-nav-border,var(--line))] bg-[var(--tenant-nav-surface)] shadow-[var(--tenant-nav-shadow,none)] backdrop-blur-xl">
      <Container className="flex h-20 items-center justify-between gap-6">
        <Logo href="/" name={companyName} tagline="Trusted Transactions" logoUrl={logoUrl} />
        <nav className="hidden items-center gap-6 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-[var(--ink-700)] transition hover:text-[var(--ink-950)]"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <Link href={buyerPortalHref} className="hidden text-sm font-medium text-[var(--ink-700)] sm:inline">
            Buyer Portal
          </Link>
          <Link href="/properties">
            <Button>Explore Listings</Button>
          </Link>
        </div>
      </Container>
    </header>
  );
}
