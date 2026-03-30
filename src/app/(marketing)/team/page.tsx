import Image from "next/image";
import Link from "next/link";

import { Container } from "@/components/shared/container";
import { SectionHeading } from "@/components/shared/section-heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requirePublicTenantContext } from "@/lib/tenancy/context";
import { buildMailtoHref, buildWhatsAppHref } from "@/modules/team/contact";
import { getVisibleTeamMembers } from "@/modules/team/queries";

export default async function TeamDirectoryPage() {
  const tenant = await requirePublicTenantContext();
  const teamMembers = await getVisibleTeamMembers(tenant);

  return (
    <Container className="space-y-10 py-16">
      <SectionHeading
        eyebrow="Team Directory"
        title="Meet the people clients trust to move deals forward."
        description="Browse active staff and marketer profiles for this company, see who handles each part of the client journey, and contact the right person directly."
      />

      {teamMembers.length === 0 ? (
        <Card className="rounded-[32px] border-[var(--line)] bg-[linear-gradient(140deg,#fbf7f0,#f0f6f3)] px-8 py-14 text-center">
          <h2 className="text-2xl font-semibold text-[var(--ink-950)]">Staff directory coming soon</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-[var(--ink-600)]">
            This company has not published any public staff profiles yet. You can still explore listings
            and submit an inquiry from the property pages.
          </p>
          <div className="mt-6">
            <Link href="/properties">
              <Button>Explore properties</Button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {teamMembers.map((member) => {
            const mailtoHref = buildMailtoHref(member.email);
            const whatsappHref = buildWhatsAppHref(member.whatsappNumber);

            return (
              <Card key={member.id} className="overflow-hidden rounded-[30px] border-[var(--line)] bg-white">
                <div className="relative h-80 bg-[linear-gradient(140deg,#f7f1e7,#edf5f0)]">
                  {member.avatarUrl ? (
                    <Image src={member.avatarUrl} alt={member.fullName} fill className="object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-5xl font-semibold text-[var(--ink-300)]">
                      {member.fullName.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="space-y-4 p-6">
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {member.specialties.slice(0, 2).map((specialty) => (
                        <Badge key={specialty}>
                          {specialty}
                        </Badge>
                      ))}
                    </div>
                    <h3 className="text-2xl font-semibold text-[var(--ink-950)]">{member.fullName}</h3>
                    <p className="text-sm font-medium text-[var(--brand-700)]">{member.title}</p>
                    <p className="text-sm leading-7 text-[var(--ink-600)]">{member.bio}</p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Link href={`/team/${member.slug}`}>
                      <Button variant="outline">View profile</Button>
                    </Link>
                    {mailtoHref ? (
                      <a href={mailtoHref}>
                        <Button variant="ghost">Email</Button>
                      </a>
                    ) : null}
                    {whatsappHref ? (
                      <a href={whatsappHref} target="_blank" rel="noreferrer">
                        <Button variant="ghost">WhatsApp</Button>
                      </a>
                    ) : null}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </Container>
  );
}
