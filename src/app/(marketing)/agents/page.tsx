import Image from "next/image";

import { Container } from "@/components/shared/container";
import { SectionHeading } from "@/components/shared/section-heading";
import { Card } from "@/components/ui/card";
import { getPublicCmsContext, getPublicTeamMembers } from "@/modules/cms/queries";

export default async function AgentsPage() {
  const tenant = await getPublicCmsContext();
  const teamMembers = await getPublicTeamMembers(tenant);

  return (
    <Container className="space-y-10 py-16">
      <SectionHeading
        eyebrow="Team"
        title="The people behind client confidence."
        description="Sales, transactions, legal, and client operations are modeled as one coordinated system."
      />
      <div className="grid gap-6 lg:grid-cols-3">
        {teamMembers.map((member) => (
          <Card key={member.slug} className="overflow-hidden">
            <div className="relative h-80">
              <Image src={member.image} alt={member.fullName} fill className="object-cover" />
            </div>
            <div className="space-y-3 p-6">
              <h3 className="text-2xl font-semibold text-[var(--ink-950)]">{member.fullName}</h3>
              <p className="text-sm font-medium text-[var(--brand-700)]">{member.title}</p>
              <p className="text-sm leading-7 text-[var(--ink-600)]">{member.bio}</p>
            </div>
          </Card>
        ))}
      </div>
    </Container>
  );
}
