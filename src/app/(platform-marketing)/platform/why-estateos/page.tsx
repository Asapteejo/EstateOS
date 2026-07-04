import { ShieldCheck } from "lucide-react";

import { Container } from "@/components/shared/container";
import { Reveal } from "@/components/shared/reveal";
import { SectionHeading } from "@/components/shared/section-heading";
import { Card } from "@/components/ui/card";
import { platformWhyEstateOS } from "@/modules/platform-site/content";

export default function PlatformWhyEstateOSPage() {
  return (
    <div className="py-16">
      <Container className="space-y-10">
        <Reveal>
          <SectionHeading
            eyebrow="Why EstateOS"
            title="Designed for the operating realities of real estate companies."
            description="EstateOS treats trust, payments, documents, role boundaries, and platform monetization as core product concerns instead of afterthoughts."
          />
        </Reveal>
        <div className="grid gap-6 lg:grid-cols-2">
          {platformWhyEstateOS.map((point, index) => (
            <Reveal key={point} delay={index * 0.06}>
              <Card interactive className="flex h-full items-start gap-4 p-8">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-100,#dcfce7)] text-[var(--brand-700)]">
                  <ShieldCheck className="h-4 w-4" aria-hidden />
                </span>
                <p className="text-base leading-8 text-[var(--ink-700)]">{point}</p>
              </Card>
            </Reveal>
          ))}
        </div>
      </Container>
    </div>
  );
}
