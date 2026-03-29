import { Container } from "@/components/shared/container";
import { EmptyState } from "@/components/shared/empty-state";

export default function BrochurePage() {
  return (
    <Container className="py-16">
      <EmptyState
        title="Brochure download endpoint scaffolded"
        description="Attach public brochure assets or generate signed brochure URLs from R2 in phase 2."
      />
    </Container>
  );
}
