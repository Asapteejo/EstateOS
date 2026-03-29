import { Container } from "@/components/shared/container";
import { SectionHeading } from "@/components/shared/section-heading";
import { Card } from "@/components/ui/card";
import { platformWhyEstateOS } from "@/modules/platform-site/content";

export default function PlatformWhyEstateOSPage() {
  return (
    <div className="py-16">
      <Container className="space-y-10">
        <SectionHeading
          eyebrow="Why EstateOS"
          title="Designed for the operating realities of real estate companies."
          description="EstateOS treats trust, payments, documents, role boundaries, and platform monetization as core product concerns instead of afterthoughts."
        />
        <div className="grid gap-6 lg:grid-cols-2">
          {platformWhyEstateOS.map((point) => (
            <Card key={point} className="p-8">
              <p className="text-base leading-8 text-[var(--ink-700)]">{point}</p>
            </Card>
          ))}
        </div>
      </Container>
    </div>
  );
}
