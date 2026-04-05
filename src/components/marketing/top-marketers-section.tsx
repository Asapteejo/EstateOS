import Link from "next/link";

import { OptimizedImage } from "@/components/media/optimized-image";
import { SectionHeading } from "@/components/shared/section-heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { MarketerPerformanceEntry } from "@/modules/team/performance";

type PublicLeaderboardPeriod = "WEEKLY" | "MONTHLY";

function formatStatLabel(value: number, singular: string, plural: string) {
  return `${value} ${value === 1 ? singular : plural}`;
}

export function TopMarketersSection({
  leaderboard,
  title = "Top marketers clients already trust",
  description = "Ranked from real tenant-scoped activity across reservations, inspections, qualified inquiries, completed deals, and successful payments.",
  compact = false,
  period = "MONTHLY",
  periodHrefBuilder,
}: {
  leaderboard: MarketerPerformanceEntry[];
  title?: string;
  description?: string;
  compact?: boolean;
  period?: PublicLeaderboardPeriod;
  periodHrefBuilder?: (period: PublicLeaderboardPeriod) => string;
}) {
  if (leaderboard.length === 0) {
    return null;
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <SectionHeading
          eyebrow="Top Marketers"
          title={title}
          description={description}
        />
        {periodHrefBuilder ? (
          <div className="inline-flex rounded-full border border-[var(--line)] bg-white p-1">
            {(["WEEKLY", "MONTHLY"] as const).map((value) => (
              <Link
                key={value}
                href={periodHrefBuilder(value)}
                className={cn(
                  "rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ink-500)] transition",
                  value === period && "bg-[var(--brand-700)] text-white",
                )}
              >
                {value === "WEEKLY" ? "Weekly" : "Monthly"}
              </Link>
            ))}
          </div>
        ) : null}
      </div>
      <div className={`grid gap-5 ${compact ? "xl:grid-cols-3" : "lg:grid-cols-3"}`}>
        {leaderboard.map((member) => (
          <Card
            key={member.id}
            className="rounded-[30px] border-[var(--line)] bg-[linear-gradient(140deg,#fbf7f0,#eef6f2)] p-6"
          >
            <div className="flex items-center justify-between gap-4">
              <Badge>#{member.rank}</Badge>
              <div className="text-sm font-semibold text-[var(--brand-700)]">
                {member.starRating.toFixed(1)} / 5.0 stars
              </div>
            </div>
            <div className="mt-4 flex items-center gap-4">
              <div className="relative h-16 w-16 overflow-hidden rounded-2xl bg-white shadow-sm">
                {member.avatarUrl ? (
                  <OptimizedImage
                    src={member.avatarUrl}
                    alt={member.fullName}
                    fill
                    preset="profile"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xl font-semibold text-[var(--ink-400)]">
                    {member.fullName.charAt(0)}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <div className="truncate text-lg font-semibold text-[var(--ink-950)]">{member.fullName}</div>
                <div className="text-sm text-[var(--ink-500)]">{member.title}</div>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-[var(--ink-600)]">{member.summary}</p>
            <div className="mt-5 flex flex-wrap gap-2 text-xs text-[var(--ink-500)]">
              <span className="rounded-full bg-white px-3 py-1.5">
                {formatStatLabel(member.metrics.completedDeals, "deal", "deals")} closed
              </span>
              <span className="rounded-full bg-white px-3 py-1.5">
                {formatStatLabel(member.metrics.successfulPayments, "payment", "payments")}
              </span>
              <span className="rounded-full bg-white px-3 py-1.5">
                {formatStatLabel(member.metrics.reservations, "reservation", "reservations")}
              </span>
            </div>
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-[0.16em] text-[var(--ink-500)]">
                <span>{period === "WEEKLY" ? "Weekly score" : "Monthly score"}</span>
                <span>{member.score}</span>
              </div>
              <div className="h-2 rounded-full bg-white/90">
                <div
                  className="h-2 rounded-full bg-[var(--brand-700)]"
                  style={{ width: `${Math.min(100, Math.max(16, member.score * 4))}%` }}
                />
              </div>
            </div>
            <div className="mt-5">
              <Link href={`/team/${member.slug}`}>
                <Button variant="outline">{compact ? "View marketer" : "Open profile"}</Button>
              </Link>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
