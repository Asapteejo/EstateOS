import Link from "next/link";

import { Container } from "@/components/shared/container";
import { Button } from "@/components/ui/button";

const links = [
  { href: "/platform/properties", label: "Properties" },
  { href: "/platform/features", label: "Features" },
  { href: "/platform/pricing", label: "Pricing" },
  { href: "/platform/contact", label: "Contact" },
];

const resourceLinks = [
  { href: "/platform/how-it-works", label: "How it works" },
  { href: "/platform/why-estateos", label: "Why EstateOS" },
  { href: "/platform/faq", label: "FAQ" },
  { href: "/demo", label: "View demo" },
  { href: "/platform/pricing", label: "Hybrid pricing" },
];

export function PlatformHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-black/5 bg-[rgba(245,247,244,0.92)] backdrop-blur-xl">
      <Container className="flex h-20 items-center justify-between gap-4">
        <Link href="/" className="inline-flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--ink-950)] text-white">
            EO
          </div>
          <div className="min-w-0">
            <div className="font-serif text-xl font-semibold text-[var(--ink-950)]">EstateOS</div>
            <div className="hidden whitespace-nowrap text-xs uppercase tracking-[0.22em] text-[var(--ink-500)] sm:block">
              Real Estate SaaS
            </div>
          </div>
        </Link>

        <nav className="hidden items-center gap-4 xl:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="whitespace-nowrap text-[13px] font-medium text-[var(--ink-700)] transition hover:text-[var(--ink-950)]"
            >
              {link.label}
            </Link>
          ))}
          <details className="group relative">
            <summary className="list-none whitespace-nowrap text-[13px] font-medium text-[var(--ink-700)] transition hover:cursor-pointer hover:text-[var(--ink-950)] [&::-webkit-details-marker]:hidden">
              Resources
            </summary>
            <div className="absolute right-0 top-8 z-50 min-w-48 rounded-2xl border border-[var(--border-subtle)] bg-white p-2 shadow-[var(--shadow-md)]">
              {resourceLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="block whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium text-[var(--ink-700)] hover:bg-[var(--sand-100)] hover:text-[var(--ink-950)]"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </details>
        </nav>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <Link href="/demo" className="hidden whitespace-nowrap text-sm font-medium text-[var(--ink-700)] 2xl:inline">
            View demo
          </Link>
          <Link href="/platform/pricing" className="hidden whitespace-nowrap text-sm font-medium text-[var(--ink-700)] 2xl:inline">
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
