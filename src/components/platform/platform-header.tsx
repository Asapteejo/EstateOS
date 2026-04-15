import Link from "next/link";

import { Container } from "@/components/shared/container";
import { Button } from "@/components/ui/button";

const links = [
  { href: "/platform/properties", label: "Properties" },
  { href: "/platform/features", label: "Features" },
  { href: "/platform/how-it-works", label: "How it works" },
  { href: "/platform/pricing", label: "Pricing" },
  { href: "/platform/why-estateos", label: "Why EstateOS" },
  { href: "/platform/faq", label: "FAQ" },
  { href: "/platform/contact", label: "Contact" },
];

export function PlatformHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-black/5 bg-[rgba(245,247,244,0.92)] backdrop-blur-xl">
      <Container className="flex h-20 items-center justify-between gap-6">
        <Link href="/" className="inline-flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--ink-950)] text-white">
            EO
          </div>
          <div>
            <div className="font-serif text-xl font-semibold text-[var(--ink-950)]">EstateOS</div>
            <div className="text-xs uppercase tracking-[0.22em] text-[var(--ink-500)]">
              Real Estate SaaS
            </div>
          </div>
        </Link>

        <nav className="hidden items-center gap-6 lg:flex">
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
          <Link href="/demo" className="hidden text-sm font-medium text-[var(--ink-700)] sm:inline">
            View demo
          </Link>
          <Link href="/platform/pricing" className="hidden text-sm font-medium text-[var(--ink-700)] sm:inline">
            Hybrid pricing
          </Link>
          <Link href="/app/onboarding">
            <Button>Get Started</Button>
          </Link>
        </div>
      </Container>
    </header>
  );
}
