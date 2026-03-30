import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Container } from "@/components/shared/container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requirePublicTenantContext } from "@/lib/tenancy/context";
import { buildMailtoHref, buildWhatsAppHref } from "@/modules/team/contact";
import { getVisibleTeamMemberBySlug } from "@/modules/team/queries";

export default async function TeamProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const tenant = await requirePublicTenantContext();
  const { slug } = await params;
  const member = await getVisibleTeamMemberBySlug(tenant, slug);

  if (!member) {
    notFound();
  }

  const mailtoHref = buildMailtoHref(member.email);
  const whatsappHref = buildWhatsAppHref(member.whatsappNumber);

  return (
    <Container className="grid gap-8 py-16 lg:grid-cols-[0.42fr_0.58fr]">
      <Card className="overflow-hidden rounded-[32px] border-[var(--line)] bg-white">
        <div className="relative h-[420px] bg-[linear-gradient(140deg,#f7f1e7,#edf5f0)]">
          {member.avatarUrl ? (
            <Image src={member.avatarUrl} alt={member.fullName} fill className="object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-7xl font-semibold text-[var(--ink-300)]">
              {member.fullName.charAt(0)}
            </div>
          )}
        </div>
      </Card>

      <div className="space-y-6">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {member.specialties.map((specialty) => (
              <Badge key={specialty}>
                {specialty}
              </Badge>
            ))}
          </div>
          <h1 className="text-4xl font-semibold text-[var(--ink-950)]">{member.fullName}</h1>
          <p className="text-lg font-medium text-[var(--brand-700)]">{member.title}</p>
          <p className="max-w-3xl text-base leading-8 text-[var(--ink-600)]">{member.bio}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="rounded-[26px] border-[var(--line)] bg-[var(--sand-50)] p-5">
            <div className="text-xs uppercase tracking-[0.2em] text-[var(--ink-500)]">Office</div>
            <div className="mt-2 text-lg font-semibold text-[var(--ink-950)]">
              {member.officeLocation ?? "Main office"}
            </div>
            <div className="mt-3 text-sm text-[var(--ink-500)]">
              Staff code: {member.staffCode ?? "Not published"}
            </div>
          </Card>
          <Card className="rounded-[26px] border-[var(--line)] bg-[var(--sand-50)] p-5">
            <div className="text-xs uppercase tracking-[0.2em] text-[var(--ink-500)]">Contact</div>
            <div className="mt-3 flex flex-wrap gap-3">
              {mailtoHref ? (
                <a href={mailtoHref}>
                  <Button>Email</Button>
                </a>
              ) : null}
              {whatsappHref ? (
                <a href={whatsappHref} target="_blank" rel="noreferrer">
                  <Button variant="outline">WhatsApp</Button>
                </a>
              ) : null}
            </div>
          </Card>
        </div>

        {member.profileHighlights.length > 0 ? (
          <Card className="rounded-[28px] border-[var(--line)] bg-white p-6">
            <h2 className="text-lg font-semibold text-[var(--ink-950)]">Why clients choose {member.fullName.split(" ")[0]}</h2>
            <ul className="mt-4 space-y-3 text-sm leading-7 text-[var(--ink-600)]">
              {member.profileHighlights.map((highlight) => (
                <li key={highlight}>- {highlight}</li>
              ))}
            </ul>
          </Card>
        ) : null}

        {member.portfolioText || member.portfolioLinks.length > 0 || member.socialLinks.length > 0 ? (
          <Card className="rounded-[28px] border-[var(--line)] bg-white p-6">
            <h2 className="text-lg font-semibold text-[var(--ink-950)]">Experience & portfolio</h2>
            {member.portfolioText ? (
              <p className="mt-3 text-sm leading-7 text-[var(--ink-600)]">{member.portfolioText}</p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-3">
              {member.portfolioLinks.map((link) => (
                <Link key={link} href={link} target="_blank" rel="noreferrer">
                  <Button variant="outline">Portfolio link</Button>
                </Link>
              ))}
              {member.socialLinks.map((link) => (
                <Link key={link} href={link} target="_blank" rel="noreferrer">
                  <Button variant="ghost">Social profile</Button>
                </Link>
              ))}
            </div>
          </Card>
        ) : null}
      </div>
    </Container>
  );
}
