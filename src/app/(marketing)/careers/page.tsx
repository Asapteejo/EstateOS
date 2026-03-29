import { Container } from "@/components/shared/container";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeading } from "@/components/shared/section-heading";

export default function CareersPage() {
  return (
    <Container className="space-y-10 py-16">
      <SectionHeading
        eyebrow="Careers & Partnerships"
        title="Phase 2 hiring and partner ecosystem surface."
        description="This route is intentionally scaffolded so the platform can add careers, channel partners, and developer-facing partnership flows without breaking architecture."
      />
      <EmptyState
        title="Careers and partnerships scaffolded"
        description="Wire role applications, partner onboarding, and CRM intake here in the next phase."
      />
    </Container>
  );
}
