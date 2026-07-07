import { HeartHandshake, Sparkles, TrendingUp } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Container } from "@/components/shared/container";
import { Reveal } from "@/components/shared/reveal";
import { SectionHeading } from "@/components/shared/section-heading";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { buildAuthRedirect, buildServerDomainConfig } from "@/lib/domains";
import { env } from "@/lib/env";
import { requirePublicTenantContext } from "@/lib/tenancy/context";
import { getPublicTenantPresentation } from "@/modules/branding/service";
import { resolveTenantSiteContent } from "@/modules/cms/site-content";
import { getPublishedSiteContent } from "@/modules/cms/site-content-service";

export const dynamic = "force-dynamic";

/** Fixed icon set for the three value cards; copy comes from the tenant CMS. */
const VALUE_ICONS = [TrendingUp, HeartHandshake, Sparkles] as const;

export default async function CareersPage() {
  const tenant = await requirePublicTenantContext();
  const [presentation, storedContent] = await Promise.all([
    getPublicTenantPresentation(tenant),
    getPublishedSiteContent(tenant),
  ]);
  const runtimeConfig = buildServerDomainConfig(env);
  const siteContent = resolveTenantSiteContent({
    companyName: presentation.companyName,
    startPurchaseHref: buildAuthRedirect(runtimeConfig, {
      returnTo: "/portal",
      tenantSlug: tenant.companySlug,
      tenantHost: tenant.host,
      entry: "buyer",
    }),
    stored: storedContent,
  });

  // Companies that aren't hiring can hide the page entirely from the CMS.
  if (!siteContent.careers.visible) {
    notFound();
  }

  const careers = siteContent.careers;

  return (
    <Container className="space-y-12 py-16">
      <Reveal>
        <SectionHeading
          eyebrow={careers.eyebrow}
          title={careers.title}
          description={careers.intro}
        />
      </Reveal>

      <Reveal className="grid gap-4 sm:grid-cols-3">
        {careers.values.map((value, index) => {
          const Icon = VALUE_ICONS[index] ?? Sparkles;
          return (
            <Card key={value.title} className="p-6">
              <span className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--brand-100,#dcfce7)] text-[var(--brand-700)]">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <h3 className="mt-4 text-lg font-semibold text-[var(--ink-950)]">{value.title}</h3>
              <p className="mt-2 text-sm leading-7 text-[var(--ink-600)]">{value.description}</p>
            </Card>
          );
        })}
      </Reveal>

      <Reveal>
        <Card className="flex flex-col items-start gap-4 p-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-xl font-semibold text-[var(--ink-950)]">{careers.ctaHeading}</h3>
            <p className="mt-1 text-sm leading-7 text-[var(--ink-600)]">{careers.ctaBody}</p>
          </div>
          <Link href="/contact" className="shrink-0">
            <Button>{careers.ctaLabel}</Button>
          </Link>
        </Card>
      </Reveal>
    </Container>
  );
}
