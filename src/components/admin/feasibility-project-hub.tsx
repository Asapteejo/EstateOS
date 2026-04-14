import Link from "next/link";

import { AdminLifecycleSteps } from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { workflowVocabulary } from "@/modules/admin/workflow-vocabulary";
import type { DevelopmentCalculationListItem } from "@/modules/development-calculations/service";

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-NG", { maximumFractionDigits: 0 }).format(value);
}

type ProjectGroup = {
  versionGroupId: string;
  projectName: string;
  location: string | null;
  latest: DevelopmentCalculationListItem;
  versions: DevelopmentCalculationListItem[];
};

export function FeasibilityProjectHub({
  calculations,
  defaultCurrency,
}: {
  calculations: DevelopmentCalculationListItem[];
  defaultCurrency: string;
}) {
  const grouped = calculations.reduce<Map<string, ProjectGroup>>((accumulator, item) => {
    const existing = accumulator.get(item.versionGroupId);

    if (!existing) {
      accumulator.set(item.versionGroupId, {
        versionGroupId: item.versionGroupId,
        projectName: item.projectName,
        location: item.location,
        latest: item,
        versions: [item],
      });
      return accumulator;
    }

    existing.versions.push(item);
    if (new Date(item.updatedAt).getTime() > new Date(existing.latest.updatedAt).getTime()) {
      existing.latest = item;
      existing.projectName = item.projectName;
      existing.location = item.location;
    }

    return accumulator;
  }, new Map());

  const projects = [...grouped.values()].sort(
    (left, right) =>
      new Date(right.latest.updatedAt).getTime() - new Date(left.latest.updatedAt).getTime(),
  );

  const positiveProjects = projects.filter((project) => project.latest.roiPercent >= 0).length;
  const totalProjectedRevenue = projects.reduce(
    (sum, project) => sum + project.latest.estimatedRevenue,
    0,
  );
  const recentVersions = calculations
    .slice()
    .sort(
      (left, right) =>
        new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
    )
    .slice(0, 6);

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-400)]">
              Feasibility & Planning
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.02em] text-[var(--ink-950)] sm:text-[2.3rem]">
              Saved feasibility projects
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--ink-500)] sm:text-[15px]">
              Start new underwriting work, reopen an active model, or move directly into executive
              decision review.
            </p>
          </div>
          <Link href="/admin/feasibility/new">
            <Button>New project</Button>
          </Link>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <HubMetric label="Saved projects" value={String(projects.length)} />
          <HubMetric label="Healthy ROI cases" value={String(positiveProjects)} />
          <HubMetric
            label="Projected revenue tracked"
            value={formatCurrency(totalProjectedRevenue, defaultCurrency)}
          />
        </div>
      </div>

      {projects.length === 0 ? (
        <Card className="rounded-[24px] border-[var(--line)] p-8 shadow-none">
          <div className="text-lg font-semibold text-[var(--ink-950)]">
            No feasibility projects yet
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--ink-500)]">
            Create a project to start modelling land efficiency, delivery cost, pricing posture,
            and timing risk.
          </p>
          <div className="mt-5">
            <Link href="/admin/feasibility/new">
              <Button>Create first project</Button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 xl:grid-cols-2">
            {projects.map((project) => (
              <Card key={project.versionGroupId} className="rounded-[24px] border-[var(--line)] p-6 shadow-none">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold text-[var(--ink-950)]">
                      {project.projectName}
                    </div>
                    <div className="mt-1 text-sm text-[var(--ink-500)]">
                      {project.location || "Location not set"}
                    </div>
                  </div>
                  <div className="rounded-full border border-[var(--line)] bg-[var(--sand-50)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-500)]">
                    {project.versions.length} version{project.versions.length === 1 ? "" : "s"}
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <HubMetric label="Break-even proxy" value={formatCurrency(project.latest.adjustedTotalCost / Math.max(project.latest.sellableSqm, 1), defaultCurrency)} />
                  <HubMetric label="Estimated revenue" value={formatCurrency(project.latest.estimatedRevenue, defaultCurrency)} />
                  <HubMetric label="ROI" value={formatPercent(project.latest.roiPercent)} />
                  <HubMetric label="Sellable land" value={`${formatNumber(project.latest.sellableSqm)} sqm`} />
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  {project.versions
                    .slice()
                    .sort((left, right) => right.versionNumber - left.versionNumber)
                    .slice(0, 4)
                    .map((version) => (
                      <span
                        key={version.id}
                        className="rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-500)]"
                      >
                        {version.versionLabel || `V${version.versionNumber}`}
                      </span>
                    ))}
                  <span className="rounded-full border border-[var(--line)] bg-[var(--sand-50)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-500)]">
                    Updated {new Date(project.latest.updatedAt).toLocaleDateString()}
                  </span>
                </div>

                <div className="mt-4 rounded-[18px] border border-[var(--line)] bg-[var(--sand-50)] px-4 py-3">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-400)]">
                    Recommended next step
                  </div>
                  <div className="mt-2 text-sm leading-6 text-[var(--ink-600)]">
                    {workflowVocabulary.feasibility.nextAction(project.latest.versionNumber)}
                  </div>
                </div>

                <div className="mt-4">
                  <AdminLifecycleSteps
                    compact
                    steps={workflowVocabulary.feasibility.steps}
                    currentIndex={workflowVocabulary.feasibility.lifecycleIndex(project.latest.versionNumber)}
                  />
                </div>

                <div className="mt-6 flex flex-wrap gap-2">
                  <Link href={`/admin/feasibility/${project.latest.id}`}>
                    <Button>Continue modelling</Button>
                  </Link>
                  <Link href={`/admin/feasibility/${project.latest.id}/decision`}>
                    <Button variant="outline">Executive decision</Button>
                  </Link>
                  <Link href={`/admin/feasibility/${project.latest.id}/report`}>
                    <Button variant="outline">Investor report</Button>
                  </Link>
                </div>
              </Card>
            ))}
          </div>

          <Card className="rounded-[24px] border-[var(--line)] p-6 shadow-none">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-400)]">
                  Recent version activity
                </div>
                <div className="mt-2 text-lg font-semibold text-[var(--ink-950)]">
                  Latest modelling changes
                </div>
              </div>
            </div>
            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b border-[var(--line)] text-left text-[var(--ink-400)]">
                  <tr>
                    <th className="px-3 py-3 font-medium">Project</th>
                    <th className="px-3 py-3 font-medium">Version</th>
                    <th className="px-3 py-3 font-medium">Updated</th>
                    <th className="px-3 py-3 font-medium">ROI</th>
                    <th className="px-3 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line)]">
                  {recentVersions.map((item) => (
                    <tr key={`recent-version-${item.id}`}>
                      <td className="px-3 py-4">
                        <div className="font-medium text-[var(--ink-900)]">{item.projectName}</div>
                        <div className="mt-1 text-xs text-[var(--ink-500)]">{item.location || "Location not set"}</div>
                      </td>
                      <td className="px-3 py-4 text-[var(--ink-700)]">
                        {item.versionLabel || `Version ${item.versionNumber}`}
                      </td>
                      <td className="px-3 py-4 text-[var(--ink-700)]">
                        {new Date(item.updatedAt).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-4 text-[var(--ink-700)]">{formatPercent(item.roiPercent)}</td>
                      <td className="px-3 py-4">
                        <div className="flex flex-wrap gap-2">
                          <Link href={`/admin/feasibility/${item.id}`} className="text-[var(--brand-700)] hover:underline">
                            Workspace
                          </Link>
                          <Link href={`/admin/feasibility/${item.id}/decision`} className="text-[var(--brand-700)] hover:underline">
                            Decision
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function HubMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-[var(--line)] bg-white px-4 py-3.5">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-400)]">
        {label}
      </div>
      <div className="mt-2 text-base font-semibold text-[var(--ink-950)]">{value}</div>
    </div>
  );
}
