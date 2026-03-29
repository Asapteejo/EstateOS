import { InquiryForm } from "@/components/marketing/inquiry-form";
import { Container } from "@/components/shared/container";
import { SectionHeading } from "@/components/shared/section-heading";
import { Card } from "@/components/ui/card";

export default function ContactPage() {
  return (
    <Container className="grid gap-8 py-16 lg:grid-cols-[1fr_0.9fr]">
      <div className="space-y-6">
        <SectionHeading
          eyebrow="Contact"
          title="Talk to a team that treats the transaction like a product."
          description="Use the inquiry form for purchase intent, partnership conversations, or serious buyer support."
        />
        <Card className="p-8 text-sm leading-7 text-[var(--ink-600)]">
          12 Admiralty Way, Lekki Phase 1, Lagos
          <br />
          support@acmerealty.dev
          <br />
          +234 801 000 1000
        </Card>
      </div>
      <Card className="p-8">
        <InquiryForm />
      </Card>
    </Container>
  );
}
