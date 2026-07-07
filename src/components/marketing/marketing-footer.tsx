import Link from "next/link";
import { MessageCircle, Music2, X } from "lucide-react";

import { Container } from "@/components/shared/container";
import { Logo } from "@/components/shared/logo";
import type { TenantSiteContent } from "@/modules/cms/site-content";

// Facebook, Instagram, LinkedIn were removed from lucide-react — minimal inline SVGs
function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}
function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}
function LinkedinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect x="2" y="9" width="4" height="12" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}

type SocialLinks = TenantSiteContent["social"];

/**
 * Tenant site footer. Tagline and social links come from the tenant CMS —
 * icons render only for the profiles the company actually filled in.
 * WhatsApp is stored as a phone number and linked via wa.me.
 */
export function MarketingFooter({
  companyName = "Acme Realty",
  logoUrl = null,
  buyerPortalHref = "/portal",
  adminPortalHref = "/admin",
  tagline = "A modern real estate experience for high-trust property discovery, reservations, and payments.",
  social,
  showCareers = true,
}: {
  companyName?: string;
  logoUrl?: string | null;
  buyerPortalHref?: string;
  adminPortalHref?: string;
  tagline?: string;
  social?: SocialLinks | null;
  showCareers?: boolean;
}) {
  const socialEntries = social
    ? ([
        ["Facebook", social.facebook, FacebookIcon],
        ["Instagram", social.instagram, InstagramIcon],
        ["X (Twitter)", social.twitter, X],
        ["LinkedIn", social.linkedin, LinkedinIcon],
        ["TikTok", social.tiktok, Music2],
        [
          "WhatsApp",
          social.whatsapp ? `https://wa.me/${social.whatsapp.replace(/[^\d]/g, "")}` : "",
          MessageCircle,
        ],
      ] as const).filter(([, href]) => Boolean(href))
    : [];

  return (
    <footer className="border-t border-[var(--line)] bg-[color:var(--tenant-surface,white)]">
      <Container className="grid gap-10 py-14 md:grid-cols-[1.6fr_1fr_1fr]">
        <div className="space-y-4">
          <Logo href="/" name={companyName} tagline="Trusted Transactions" logoUrl={logoUrl} />
          <p className="max-w-md text-sm leading-7 text-[var(--ink-600)]">{tagline}</p>
          {socialEntries.length > 0 ? (
            <div className="flex flex-wrap gap-2 pt-1">
              {socialEntries.map(([label, href, Icon]) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="admin-focus footer-link inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--line)] text-[var(--ink-600)] hover:border-[var(--brand-500)] hover:text-[var(--brand-700)]"
                >
                  <Icon className="h-4.5 w-4.5" aria-hidden="true" />
                </a>
              ))}
            </div>
          ) : null}
        </div>
        <div className="space-y-3">
          <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--ink-500)]">
            Explore
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
            {showCareers ? (
              <Link href="/careers" className="footer-link admin-focus block w-fit rounded">Careers</Link>
            ) : null}
            <Link href="/contact" className="footer-link admin-focus block w-fit rounded">Contact</Link>
          </div>
        </div>
      </Container>
    </footer>
  );
}
