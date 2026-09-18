import Link from "next/link";

import { Container } from "@/components/shared/container";
import { Reveal } from "@/components/shared/reveal";
import { Button } from "@/components/ui/button";
import { requirePublicTenantContext } from "@/lib/tenancy/context";
import { getPublicTenantPresentation } from "@/modules/branding/service";
import { resolveTenantSiteContent } from "@/modules/cms/site-content";
import { getPublishedSiteContent } from "@/modules/cms/site-content-service";

export const dynamic = "force-dynamic";

/**
 * The buyer journey on its own page, driven by the same CMS content the
 * homepage summarises (siteContent.journey). No new copy is introduced here:
 * a tenant edits the steps once and both surfaces follow.
 */
export default async function HowItWorksPage() {
  const tenant = await requirePublicTenantContext();
  const presentation = await getPublicTenantPresentation(tenant);
  const storedContent = await getPublishedSiteContent(tenant);
  const content = resolveTenantSiteContent({
    companyName: presentation.companyName,
    startPurchaseHref: "/portal",
    stored: storedContent,
  });

  return (
    <Container className="space-y-12 py-16">
      <Reveal>
        <div className="max-w-2xl space-y-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-500)]">
            {presentation.companyName}
          </div>
          <h1 className="font-serif text-4xl leading-tight text-[var(--ink-950)] sm:text-5xl">
            {content.journey.heading}
          </h1>
          <p className="text-base leading-8 text-[var(--ink-600)]">{content.hero.subhead}</p>
        </div>
      </Reveal>

      <Reveal>
        <ol className="grid gap-x-10 gap-y-12 md:grid-cols-3">
          {content.journey.steps.map((step, index) => (
            <li key={step.title} className="border-t-2 border-[var(--brand-700)]/25 pt-5">
              <div className="numeric text-sm font-semibold tracking-[0.18em] text-[var(--brand-700)]">
                0{index + 1}
              </div>
              <h2 className="mt-3 font-serif text-2xl leading-snug text-[var(--ink-950)]">
                {step.title}
              </h2>
              <p className="mt-3 text-sm leading-7 text-[var(--ink-600)]">{step.description}</p>
            </li>
          ))}
        </ol>
      </Reveal>

      <Reveal>
        <div className="flex flex-wrap gap-3 border-t border-[var(--line)] pt-10">
          <Link href="/properties">
            <Button size="lg">{content.hero.primaryCta.label}</Button>
          </Link>
          <Link href="/contact">
            <Button variant="outline">Talk to the team</Button>
          </Link>
        </div>
      </Reveal>
    </Container>
  );
}
