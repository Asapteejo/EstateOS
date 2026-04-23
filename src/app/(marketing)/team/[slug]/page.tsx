import Link from "next/link";
import { notFound } from "next/navigation";

import { Container } from "@/components/shared/container";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requirePublicTenantContext } from "@/lib/tenancy/context";
import { buildMailtoHref, buildWhatsAppHref } from "@/modules/team/contact";
import { getTenantMarketerPerformanceSummary } from "@/modules/team/performance";
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

  const [weeklyPerformance, monthlyPerformance] = await Promise.all([
    getTenantMarketerPerformanceSummary(tenant, member.id, new Date(), "WEEKLY"),
    getTenantMarketerPerformanceSummary(tenant, member.id, new Date(), "MONTHLY"),
  ]);
  const performance = monthlyPerformance ?? weeklyPerformance;

  const mailtoHref = buildMailtoHref(member.email);
  const whatsappHref = buildWhatsAppHref(member.whatsappNumber);

  return (
    <Container className="grid gap-8 py-16 lg:grid-cols-[0.42fr_0.58fr]">
      <Card className="overflow-hidden rounded-[32px] border-[var(--line)] bg-white">
        <div className="flex h-[420px] items-center justify-center bg-[linear-gradient(140deg,#f7f1e7,#edf5f0)] p-8">
          <Avatar
            name={member.fullName}
            imageUrl={member.avatarUrl}
            size="lg"
            className="h-full w-full rounded-[28px] border-white/80 bg-white/70"
          />
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
          {performance ? (
            <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--ink-500)]">
              {weeklyPerformance ? <Badge>#{weeklyPerformance.rank} this week</Badge> : null}
              {monthlyPerformance ? <Badge>#{monthlyPerformance.rank} this month</Badge> : null}
              <span className="font-semibold text-[var(--brand-700)]">{performance.starRating.toFixed(1)} / 5.0 stars</span>
              <span>{performance.summary}</span>
            </div>
          ) : null}
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

        {performance ? (
          <Card className="rounded-[28px] border-[var(--line)] bg-white p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-[var(--ink-500)]">Performance snapshot</div>
                <h2 className="mt-2 text-lg font-semibold text-[var(--ink-950)]">Recent deal activity</h2>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-[var(--brand-700)]">{performance.starRating.toFixed(1)} / 5.0 stars</div>
                <div className="text-xs text-[var(--ink-500)]">Based on current tenant activity</div>
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl bg-[var(--sand-50)] px-4 py-4">
                <div className="text-xs uppercase tracking-[0.16em] text-[var(--ink-500)]">Deals closed</div>
                <div className="mt-2 text-2xl font-semibold text-[var(--ink-950)]">{performance.metrics.completedDeals}</div>
              </div>
              <div className="rounded-2xl bg-[var(--sand-50)] px-4 py-4">
                <div className="text-xs uppercase tracking-[0.16em] text-[var(--ink-500)]">Payments</div>
                <div className="mt-2 text-2xl font-semibold text-[var(--ink-950)]">{performance.metrics.successfulPayments}</div>
              </div>
              <div className="rounded-2xl bg-[var(--sand-50)] px-4 py-4">
                <div className="text-xs uppercase tracking-[0.16em] text-[var(--ink-500)]">Reservations</div>
                <div className="mt-2 text-2xl font-semibold text-[var(--ink-950)]">{performance.metrics.reservations}</div>
              </div>
              <div className="rounded-2xl bg-[var(--sand-50)] px-4 py-4">
                <div className="text-xs uppercase tracking-[0.16em] text-[var(--ink-500)]">Inspections</div>
                <div className="mt-2 text-2xl font-semibold text-[var(--ink-950)]">{performance.metrics.inspectionsHandled}</div>
              </div>
            </div>
          </Card>
        ) : null}

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
