import { Clock, Mail, MapPin, MessageCircle, Phone, type LucideIcon } from "lucide-react";

import { InquiryForm } from "@/components/marketing/inquiry-form";
import { Container } from "@/components/shared/container";
import { Reveal } from "@/components/shared/reveal";
import { SectionHeading } from "@/components/shared/section-heading";
import { Card } from "@/components/ui/card";
import { buildAuthRedirect, buildServerDomainConfig } from "@/lib/domains";
import { env } from "@/lib/env";
import { requirePublicTenantContext } from "@/lib/tenancy/context";
import { resolveTenantSiteContent } from "@/modules/cms/site-content";
import {
  getPublicTenantContact,
  getPublishedSiteContent,
} from "@/modules/cms/site-content-service";
import { getPublicTenantPresentation } from "@/modules/branding/service";

export const dynamic = "force-dynamic";

export default async function ContactPage() {
  const tenant = await requirePublicTenantContext();
  const [contact, presentation, storedContent] = await Promise.all([
    getPublicTenantContact(tenant),
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

  const methods: { icon: LucideIcon; label: string; value: string; href?: string }[] = [];
  if (contact.address) {
    methods.push({ icon: MapPin, label: "Office", value: contact.address });
  }
  if (contact.email) {
    methods.push({ icon: Mail, label: "Email", value: contact.email, href: `mailto:${contact.email}` });
  }
  if (contact.phone) {
    methods.push({
      icon: Phone,
      label: "Phone",
      value: contact.phone,
      href: `tel:${contact.phone.replace(/[^+\d]/g, "")}`,
    });
  }
  if (siteContent.social.whatsapp) {
    methods.push({
      icon: MessageCircle,
      label: "WhatsApp",
      value: siteContent.social.whatsapp,
      href: `https://wa.me/${siteContent.social.whatsapp.replace(/[^\d]/g, "")}`,
    });
  }
  methods.push({ icon: Clock, label: "Office hours", value: siteContent.contact.hours });

  return (
    <Container className="grid items-start gap-8 py-16 lg:grid-cols-[1fr_0.9fr]">
      <Reveal className="space-y-6">
        <SectionHeading
          eyebrow="Contact"
          title={`Talk to the ${presentation.companyName} team.`}
          description={siteContent.contact.note}
        />
        {methods.length > 0 ? (
          <Card className="divide-y divide-[var(--line)] p-2">
            {methods.map((method) => {
              const Row = (
                <div className="flex items-center gap-4 p-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-100,#dcfce7)] text-[var(--brand-700)]">
                    <method.icon className="h-5 w-5" aria-hidden />
                  </span>
                  <span>
                    <span className="block text-xs uppercase tracking-[0.16em] text-[var(--ink-500)]">
                      {method.label}
                    </span>
                    <span className="block text-sm font-semibold text-[var(--ink-950)]">
                      {method.value}
                    </span>
                  </span>
                </div>
              );
              return method.href ? (
                <a
                  key={method.label}
                  href={method.href}
                  className="admin-focus block rounded-2xl transition hover:bg-[var(--sand-50)]"
                >
                  {Row}
                </a>
              ) : (
                <div key={method.label}>{Row}</div>
              );
            })}
          </Card>
        ) : null}
      </Reveal>
      <Reveal delay={0.08}>
        <Card className="p-8">
          <InquiryForm />
        </Card>
      </Reveal>
    </Container>
  );
}
