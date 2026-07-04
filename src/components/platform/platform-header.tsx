import Link from "next/link";

import { Container } from "@/components/shared/container";
import { ScrollAwareHeader } from "@/components/shared/scroll-aware-header";
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

const mobileLinks = [...links, ...resourceLinks];

export function PlatformHeader() {
  return (
    <ScrollAwareHeader
      className="border border-transparent bg-[rgba(245,247,244,0.92)] backdrop-blur-xl"
      topClassName="border-b-black/5"
      floatingClassName="mx-3 rounded-2xl border-black/5 shadow-[0_18px_50px_rgba(0,0,0,0.12)]"
    >
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

        <nav className="hidden items-center gap-3 lg:flex xl:gap-4">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="nav-underline admin-focus rounded-md whitespace-nowrap text-[13px] font-medium text-[var(--ink-700)] transition hover:text-[var(--ink-950)]"
            >
              {link.label}
            </Link>
          ))}
          <details className="group relative">
            <summary className="nav-underline admin-focus rounded-md list-none whitespace-nowrap text-[13px] font-medium text-[var(--ink-700)] transition hover:cursor-pointer hover:text-[var(--ink-950)] [&::-webkit-details-marker]:hidden">
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
          <details className="relative lg:hidden">
            <summary className="admin-focus inline-flex h-10 w-10 list-none items-center justify-center rounded-full border border-[var(--border-subtle)] bg-white text-[var(--ink-900)] shadow-[var(--shadow-xs)] transition hover:bg-[var(--sand-100)] hover:cursor-pointer [&::-webkit-details-marker]:hidden">
              <span className="sr-only">Open navigation menu</span>
              <span className="flex flex-col gap-1" aria-hidden="true">
                <span className="block h-0.5 w-4 rounded-full bg-current" />
                <span className="block h-0.5 w-4 rounded-full bg-current" />
                <span className="block h-0.5 w-4 rounded-full bg-current" />
              </span>
            </summary>
            <div className="absolute right-0 top-12 z-50 w-64 rounded-2xl border border-[var(--border-subtle)] bg-white p-2 shadow-[var(--shadow-md)]">
              {mobileLinks.map((link) => (
                <Link
                  key={`${link.href}-${link.label}`}
                  href={link.href}
                  className="block whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium text-[var(--ink-700)] hover:bg-[var(--sand-100)] hover:text-[var(--ink-950)]"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </details>
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
    </ScrollAwareHeader>
  );
}
