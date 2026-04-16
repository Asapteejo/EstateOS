"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DEVELOPMENT_PRESETS, type DevelopmentPresetKey } from "@/modules/development-calculations/presets";
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

type ProjectGroup = {
  versionGroupId: string;
  projectName: string;
  location: string | null;
  latest: DevelopmentCalculationListItem;
  versions: DevelopmentCalculationListItem[];
};

type DecisionStatus = "PENDING" | "APPROVED" | "REJECTED";

const DECISION_CONFIG: Record<DecisionStatus, { label: string; className: string }> = {
  PENDING: {
    label: "Pending",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  APPROVED: {
    label: "Approved",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  REJECTED: {
    label: "Rejected",
    className: "border-red-200 bg-red-50 text-red-600",
  },
};

function DecisionBadge({
  status,
  calculationId,
  onStatusChange,
}: {
  status: DecisionStatus;
  calculationId: string;
  onStatusChange: (id: string, status: DecisionStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const cfg = DECISION_CONFIG[status];

  async function pick(next: DecisionStatus) {
    setOpen(false);
    if (next === status) return;
    try {
      await fetch(`/api/admin/development-calculations/${calculationId}/decision`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      onStatusChange(calculationId, next);
    } catch {
      // silent — stale UI at worst
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] transition-opacity hover:opacity-80 ${cfg.className}`}
      >
        {cfg.label}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-20 min-w-[130px] overflow-hidden rounded-xl border border-[var(--line)] bg-white shadow-md">
            {(["PENDING", "APPROVED", "REJECTED"] as DecisionStatus[]).map((s) => (
              <button
                key={s}
                onClick={() => pick(s)}
                className={`w-full px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors hover:bg-[var(--sand-50)] ${s === status ? "text-[var(--brand-700)]" : "text-[var(--ink-600)]"}`}
              >
                {DECISION_CONFIG[s].label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function PresetModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [selected, setSelected] = useState<DevelopmentPresetKey>("BALANCED");
  const [loading, setLoading] = useState(false);

  async function create() {
    setLoading(true);
    router.push(`/admin/feasibility/new?preset=${selected}`);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-xl rounded-[28px] bg-white p-6 shadow-xl">
        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--brand-700)]">
          New feasibility project
        </div>
        <h2 className="mt-3 text-2xl font-semibold text-[var(--ink-950)]">Choose a starting preset</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--ink-500)]">
          Presets pre-fill cost ratios and rate assumptions so you can start modelling within minutes. You can adjust every number in the workspace.
        </p>

        <div className="mt-5 space-y-3">
          {DEVELOPMENT_PRESETS.map((preset) => (
            <button
              key={preset.key}
              onClick={() => setSelected(preset.key)}
              className={`w-full rounded-2xl border p-4 text-left transition-all ${
                selected === preset.key
                  ? "border-[var(--brand-600)] bg-[var(--brand-50)] ring-1 ring-[var(--brand-400)]"
                  : "border-[var(--line)] bg-white hover:border-[var(--brand-300)] hover:bg-[var(--sand-50)]"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-[var(--ink-950)]">{preset.label}</span>
                {selected === preset.key && (
                  <span className="h-2 w-2 rounded-full bg-[var(--brand-600)]" />
                )}
              </div>
              <p className="mt-1 text-xs leading-5 text-[var(--ink-500)]">{preset.summary}</p>
              <p className="mt-1 text-[11px] leading-5 text-[var(--ink-400)] italic">{preset.guidance}</p>
            </button>
          ))}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={create} disabled={loading}>
            {loading ? "Creating…" : "Start with this preset"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <Card className="rounded-[28px] border-[var(--line)] p-10 shadow-none">
      <div className="mx-auto max-w-xl text-center">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--line)] bg-[var(--sand-50)]">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--brand-600)]">
            <path d="M3 3h18v18H3zM3 9h18M9 21V9" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-[var(--ink-950)]">No feasibility projects yet</h2>
        <p className="mt-3 text-sm leading-6 text-[var(--ink-500)]">
          The feasibility calculator helps land developers and real estate companies underwrite new projects — sizing land efficiency, modelling delivery cost, setting pricing targets, and stress-testing returns across scenarios before committing capital.
        </p>
        <p className="mt-3 text-sm leading-6 text-[var(--ink-500)]">
          Use it before acquiring a site, pitching to investors, or setting a pricing strategy for a new estate.
        </p>
        <div className="mt-6">
          <Button onClick={onNew}>Create your first project</Button>
        </div>
        <p className="mt-4 text-xs text-[var(--ink-400)]">
          Takes about 5 minutes to get a complete picture with a balanced preset.
        </p>
      </div>
    </Card>
  );
}

function ProjectCard({
  project,
  defaultCurrency,
  onStatusChange,
}: {
  project: ProjectGroup;
  defaultCurrency: string;
  onStatusChange: (id: string, status: DecisionStatus) => void;
}) {
  const latest = project.latest;
  const roi = latest.roiPercent;
  const roiColor = roi >= 20 ? "text-emerald-600" : roi >= 10 ? "text-amber-600" : "text-red-600";

  return (
    <Card className="rounded-[24px] border-[var(--line)] p-6 shadow-none flex flex-col gap-0">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-lg font-semibold text-[var(--ink-950)]">
            {project.projectName}
          </div>
          <div className="mt-0.5 text-sm text-[var(--ink-500)]">
            {project.location || "Location not set"}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <DecisionBadge
            status={latest.decisionStatus}
            calculationId={latest.id}
            onStatusChange={onStatusChange}
          />
          <span className="rounded-full border border-[var(--line)] bg-[var(--sand-50)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-500)]">
            {project.versions.length}v
          </span>
        </div>
      </div>

      {/* Key metrics */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric
          label="Total investment"
          value={formatCurrency(latest.adjustedTotalCost, defaultCurrency)}
        />
        <Metric
          label="Projected IRR"
          value={formatPercent(latest.irrPercent)}
          valueClass={roiColor}
        />
        <Metric
          label="ROI"
          value={formatPercent(roi)}
          valueClass={roiColor}
        />
        <Metric
          label="Est. revenue"
          value={formatCurrency(latest.estimatedRevenue, defaultCurrency)}
        />
      </div>

      {/* Last modified */}
      <div className="mt-4 text-[11px] text-[var(--ink-400)]">
        Last modified{" "}
        <span className="font-medium text-[var(--ink-600)]">
          {new Date(latest.updatedAt).toLocaleDateString("en-NG", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </span>
      </div>

      {/* Actions */}
      <div className="mt-5 flex flex-wrap gap-2">
        <Link href={`/admin/feasibility/${latest.id}`}>
          <Button>Continue modelling</Button>
        </Link>
        <Link href={`/admin/feasibility/${latest.id}/decision`}>
          <Button variant="outline">Decision review</Button>
        </Link>
        <Link href={`/admin/feasibility/${latest.id}/report`}>
          <Button variant="outline">Report</Button>
        </Link>
      </div>
    </Card>
  );
}

function Metric({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-[16px] border border-[var(--line)] bg-white px-3 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-400)]">
        {label}
      </div>
      <div className={`mt-1.5 text-sm font-semibold ${valueClass ?? "text-[var(--ink-950)]"}`}>
        {value}
      </div>
    </div>
  );
}

export function FeasibilityProjectHub({
  calculations,
  defaultCurrency,
}: {
  calculations: DevelopmentCalculationListItem[];
  defaultCurrency: string;
}) {
  const [showPresetModal, setShowPresetModal] = useState(false);
  const [localCalculations, setLocalCalculations] = useState(calculations);

  function handleStatusChange(id: string, status: DecisionStatus) {
    setLocalCalculations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, decisionStatus: status } : c)),
    );
  }

  const grouped = localCalculations.reduce<Map<string, ProjectGroup>>((acc, item) => {
    const existing = acc.get(item.versionGroupId);
    if (!existing) {
      acc.set(item.versionGroupId, {
        versionGroupId: item.versionGroupId,
        projectName: item.projectName,
        location: item.location,
        latest: item,
        versions: [item],
      });
      return acc;
    }
    existing.versions.push(item);
    if (new Date(item.updatedAt).getTime() > new Date(existing.latest.updatedAt).getTime()) {
      existing.latest = item;
      existing.projectName = item.projectName;
      existing.location = item.location;
    }
    return acc;
  }, new Map());

  const projects = [...grouped.values()].sort(
    (a, b) => new Date(b.latest.updatedAt).getTime() - new Date(a.latest.updatedAt).getTime(),
  );

  const approvedCount = projects.filter((p) => p.latest.decisionStatus === "APPROVED").length;
  const totalRevenue = projects.reduce((sum, p) => sum + p.latest.estimatedRevenue, 0);

  return (
    <>
      {showPresetModal && <PresetModal onClose={() => setShowPresetModal(false)} />}

      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-400)]">
              Feasibility & Planning
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.02em] text-[var(--ink-950)]">
              Saved feasibility projects
            </h1>
            <p className="mt-2 text-sm leading-6 text-[var(--ink-500)]">
              Underwrite land acquisitions, stress-test returns, and move into executive decision review.
            </p>
          </div>
          <Button onClick={() => setShowPresetModal(true)}>New project</Button>
        </div>

        {projects.length === 0 ? (
          <EmptyState onNew={() => setShowPresetModal(true)} />
        ) : (
          <>
            {/* Summary row */}
            <div className="grid gap-3 md:grid-cols-3">
              <Metric label="Total projects" value={String(projects.length)} />
              <Metric label="Approved" value={String(approvedCount)} valueClass="text-emerald-600" />
              <Metric
                label="Revenue tracked"
                value={formatCurrency(totalRevenue, defaultCurrency)}
              />
            </div>

            {/* Project cards */}
            <div className="grid gap-4 xl:grid-cols-2">
              {projects.map((project) => (
                <ProjectCard
                  key={project.versionGroupId}
                  project={project}
                  defaultCurrency={defaultCurrency}
                  onStatusChange={handleStatusChange}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
