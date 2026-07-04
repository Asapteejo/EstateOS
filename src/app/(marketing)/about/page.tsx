import { Eye, ShieldCheck, Zap, type LucideIcon } from "lucide-react";

import { Container } from "@/components/shared/container";
import { Reveal } from "@/components/shared/reveal";
import { SectionHeading } from "@/components/shared/section-heading";
import { Card } from "@/components/ui/card";
import { requirePublicTenantContext } from "@/lib/tenancy/context";
import { getPublicTenantPresentation } from "@/modules/branding/service";
import { resolveTenantSiteContent } from "@/modules/cms/site-content";
import { getPublishedSiteContent } from "@/modules/cms/site-content-service";

export const dynamic = "force-dynamic";

const VALUES: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Eye,
    title: "Clarity",
    body: "Listing discovery, transaction progress, payments, and documents stay visible and structured — for buyers and the team alike.",
  },
  {
    icon: Zap,
    title: "Speed",
    body: "Buyers move from first interest to reservation and payment without the friction of spreadsheets, threads, and manual follow-up.",
  },
  {
    icon: ShieldCheck,
    title: "Accountability",
    body: "Every deal has a clear owner and a clear next step, so nothing slips between inquiry, inspection, and collection.",
  },
];

export default async function AboutPage() {
  const tenant = await requirePublicTenantContext();
  const presentation = await getPublicTenantPresentation(tenant);
  const storedContent = await getPublishedSiteContent(tenant);
  const content = resolveTenantSiteContent({
    companyName: presentation.companyName,
    startPurchaseHref: "/portal",
    stored: storedContent,
  });

  return (
    <Container className="space-y-10 py-16">
      <Reveal>
        <SectionHeading
          eyebrow={content.about.eyebrow}
          title={content.about.title}
          description={content.about.intro}
        />
      </Reveal>
      <div className="grid gap-6 lg:grid-cols-3">
        {VALUES.map((value, index) => (
          <Reveal key={value.title} delay={index * 0.06}>
            <Card interactive className="h-full p-8">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--brand-100,#dcfce7)] text-[var(--brand-700)]">
                <value.icon className="h-5 w-5" aria-hidden />
              </span>
              <h3 className="mt-5 text-xl font-semibold text-[var(--ink-950)]">{value.title}</h3>
              <p className="mt-3 text-sm leading-7 text-[var(--ink-600)]">{value.body}</p>
            </Card>
          </Reveal>
        ))}
      </div>
    </Container>
  );
}
