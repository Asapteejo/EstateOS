import Link from "next/link";

import { MarketingMobileNav } from "@/components/marketing/marketing-mobile-nav";
import { Container } from "@/components/shared/container";
import { Logo } from "@/components/shared/logo";
import { ScrollAwareHeader } from "@/components/shared/scroll-aware-header";
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
    <ScrollAwareHeader
      className="border border-transparent bg-[var(--tenant-nav-surface)] backdrop-blur-xl"
      topClassName="border-b-[var(--tenant-nav-border,var(--line))] shadow-[var(--tenant-nav-shadow,none)]"
      floatingClassName="mx-3 rounded-2xl border-[var(--tenant-nav-border,var(--line))] shadow-[0_18px_50px_rgba(0,0,0,0.14)]"
    >
      <Container className="flex h-20 items-center justify-between gap-4 lg:gap-6">
        <Logo href="/" name={companyName} tagline="Trusted Transactions" logoUrl={logoUrl} />
        <nav className="hidden items-center gap-4 lg:flex xl:gap-6">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="nav-underline admin-focus rounded-md whitespace-nowrap text-sm font-medium text-[var(--ink-700)] transition hover:text-[var(--ink-950)]"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <Link href={buyerPortalHref} className="admin-focus rounded hidden whitespace-nowrap text-sm font-medium text-[var(--ink-700)] sm:inline">
            Buyer Portal
          </Link>
          <Link href="/properties">
            <Button>Explore Listings</Button>
          </Link>
          <MarketingMobileNav links={links} buyerPortalHref={buyerPortalHref} />
        </div>
      </Container>
    </ScrollAwareHeader>
  );
}
