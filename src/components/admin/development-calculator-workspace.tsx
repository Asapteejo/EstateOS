"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  KPIStatCard,
  RecommendationCard as SharedRecommendationCard,
  SegmentedTabs,
  SectionContainer,
} from "@/components/admin/feasibility-ui";
import { cn, formatCurrency } from "@/lib/utils";
import type { DevelopmentCalculationInput } from "@/lib/validations/development-calculations";
import {
  calculateDevelopmentFeasibility,
  createBlankDevelopmentCalculation,
  createBlankDevelopmentPhase,
  createBlankSalesMixItem,
} from "@/modules/development-calculations/engine";
import {
  applyDevelopmentPreset,
  createPhaseTemplateFromPreset,
  DEVELOPMENT_PRESETS,
  getDevelopmentPresetDefinition,
  getPresetDeviationWarnings,
  inferDevelopmentPreset,
  type DevelopmentPresetKey,
} from "@/modules/development-calculations/presets";
import {
  buildCalculatorRecommendations,
  buildComparisonRecommendations,
  type CalculatorRecommendation,
  type CalculatorRecommendationBundle,
  type ComparisonRecommendation,
} from "@/modules/development-calculations/recommendations";
import {
  applyQuickAdjustment,
  buildSensitivitySnapshots,
  getLeastSensitiveVariable,
  getMostSensitiveVariable,
  type QuickAdjustKey,
} from "@/modules/development-calculations/sensitivity";
import type {
  DevelopmentCalculationDetail,
  DevelopmentCalculationListItem,
  DevelopmentCalculationVersionListItem,
} from "@/modules/development-calculations/service";

type WorkspaceProps = {
  calculations: DevelopmentCalculationListItem[];
  selected: DevelopmentCalculationDetail | null;
  versions: DevelopmentCalculationVersionListItem[];
  blankForm: DevelopmentCalculationInput;
  defaultCurrency: string;
  showProjectBrowser?: boolean;
  allowPresentationView?: boolean;
  decisionHref?: string | null;
  initialPreset?: DevelopmentPresetKey | null;
};

type ScenarioItem = ReturnType<typeof calculateDevelopmentFeasibility>["scenarios"][number];
type ComparisonCandidate = {
  id: string;
  label: string;
  kind: "current" | "saved" | "preset";
  form: DevelopmentCalculationInput;
  result: ReturnType<typeof calculateDevelopmentFeasibility>;
  meta?: string;
};
type WorkspaceMode = "SIMPLE" | "STANDARD" | "ADVANCED";
type WorkspaceTab = "OVERVIEW" | "MODEL" | "INSIGHTS" | "COMPARE";
type ModelSectionKey = "BASICS" | "COSTS" | "PRICING" | "PHASING";

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatNumber(value: number, digits = 0) {
  return new Intl.NumberFormat("en-NG", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function calculationRoute(id: string) {
  return `/admin/feasibility/${id}`;
}

function createDraft(defaultCurrency: string) {
  return createBlankDevelopmentCalculation(defaultCurrency);
}

function getWarningTone(warning: string): "danger" | "caution" {
  const normalized = warning.toLowerCase();

  if (
    normalized.includes("below break-even") ||
    normalized.includes("no sellable land") ||
    normalized.includes("exceeds sellable")
  ) {
    return "danger";
  }

  return "caution";
}

function getScenarioTone(key: string): "success" | "default" | "danger" {
  if (key === "BEST") {
    return "success";
  }

  if (key === "WORST") {
    return "danger";
  }

  return "default";
}

export function DevelopmentCalculatorWorkspace({
  calculations,
  selected,
  versions,
  blankForm,
  defaultCurrency,
  showProjectBrowser = true,
  allowPresentationView = true,
  decisionHref = null,
  initialPreset = null,
}: WorkspaceProps) {
  const router = useRouter();
  const [form, setForm] = useState<DevelopmentCalculationInput>(() => {
    const base = selected?.form ?? blankForm ?? createDraft(defaultCurrency);
    return initialPreset && !selected ? applyDevelopmentPreset(base, initialPreset) : base;
  });
  const [pending, setPending] = useState<"save" | "saveVersion" | "delete" | null>(null);
  const [advancedMode, setAdvancedMode] = useState(true);
  const [presentationView, setPresentationView] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [forecastView, setForecastView] = useState<"monthly" | "phase">("monthly");
  const [quickStartMode, setQuickStartMode] = useState(!selected);
  const [comparisonMode, setComparisonMode] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<DevelopmentPresetKey | null>(
    initialPreset ?? inferDevelopmentPreset(selected?.form ?? blankForm ?? createDraft(defaultCurrency)) ?? "BALANCED",
  );
  const [comparisonSelection, setComparisonSelection] = useState<string[]>([]);
  const [comparisonDetails, setComparisonDetails] = useState<Record<string, DevelopmentCalculationDetail>>({});
  const [comparisonLoading, setComparisonLoading] = useState<string | null>(null);
  const [presetComparisonKeys, setPresetComparisonKeys] = useState<DevelopmentPresetKey[]>([]);
  const [showAllQuickAdjusts, setShowAllQuickAdjusts] = useState(false);
  const [focusedQuickAdjust, setFocusedQuickAdjust] = useState<QuickAdjustKey | null>(null);
  const [lastAdjustmentBaseline, setLastAdjustmentBaseline] = useState<ReturnType<typeof calculateDevelopmentFeasibility> | null>(null);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("OVERVIEW");
  const [activeModelSection, setActiveModelSection] = useState<ModelSectionKey | null>("BASICS");
  const [savingState, setSavingState] = useState<"saved" | "draft">(
    selected ? "saved" : "draft",
  );
  const workspaceMode: WorkspaceMode = quickStartMode
    ? "SIMPLE"
    : advancedMode
      ? "ADVANCED"
      : "STANDARD";

  useEffect(() => {
    if (comparisonMode) {
      setActiveTab("COMPARE");
    } else if (activeTab === "COMPARE") {
      setActiveTab("OVERVIEW");
    }
  }, [comparisonMode, activeTab]);

  const activeCalculationId = selected?.id ?? null;
  const activeVersionLabel = selected?.versionLabel ?? null;
  const results = useMemo(() => calculateDevelopmentFeasibility(form), [form]);
  const activeWarnings = results.warnings.filter((warning) => getWarningTone(warning) === "danger");
  const cautionWarnings = results.warnings.filter((warning) => getWarningTone(warning) === "caution");
  const salesMixUnallocatedSqm = Math.max(results.area.sellableSqm - results.salesMix.allocatedSqm, 0);
  const largeAllocationGap = results.area.sellableSqm > 0 && salesMixUnallocatedSqm > results.area.sellableSqm * 0.2;
  const phaseDevelopmentGap = Math.max(100 - results.phasing.totalDevelopmentCostShare, 0);
  const phaseInventoryGap = Math.max(100 - results.phasing.totalSellableInventoryShare, 0);
  const blendedSellingPricePerSqm =
    form.saleMode === "PER_SQM"
      ? results.revenue.effectiveSellingPricePerSqm
      : results.salesMix.allocatedSqm > 0
        ? results.revenue.effectiveSellingPricePerSqm
        : 0;
  const commercialWarnings = [
    ...results.warnings.filter((warning) =>
      warning.includes("below break-even") ||
      warning.includes("sales mix") ||
      warning.includes("No sellable land"),
    ),
  ];
  const installmentPriceUplift = Math.max(
    results.pricing.installmentRecommendedPricePerSqm - results.pricing.outrightRecommendedPricePerSqm,
    0,
  );
  const pricingNarrative =
    form.saleMode === "PER_SQM"
      ? results.revenue.effectiveSellingPricePerSqm >= results.revenue.breakevenPricePerSqm
        ? "Current market pricing is above break-even and supports the modelled delivery cost base."
        : "Current market pricing is below break-even, so the project needs a higher headline rate or leaner cost structure."
      : "Revenue is being driven by the structured sales mix rather than one flat land rate, so allocation quality matters directly.";
  const allocationNarrative =
    form.saleMode === "PER_SQM"
      ? "Per-sqm mode assumes the full sellable estate can clear at one defendable market rate."
      : salesMixUnallocatedSqm > 0
        ? `The commercial plan still leaves ${formatNumber(salesMixUnallocatedSqm)} sqm unallocated, so projected revenue may be conservative until more inventory is mapped.`
        : "The commercial plan covers the sellable estate cleanly, so revenue output is grounded in defined products.";
  const marginNarrative =
    form.requiredTargetProfitMarginRate >= 35
      ? "Target margin is aggressive and may require strong market depth or a premium positioning story."
      : form.requiredTargetProfitMarginRate <= 15
        ? "Target margin is relatively conservative and may leave pricing headroom on the table if demand is stronger than expected."
        : "Target margin sits in a balanced range for management review and market testing.";
  const projectSignal =
    activeWarnings.length > 0
      ? {
          label: "Action required",
          description:
            "The model has feasibility issues that need to be resolved before this pricing should go to market.",
          tone: "danger" as const,
        }
      : results.revenue.estimatedGrossProfit < 0
        ? {
            label: "Below target return",
            description:
              "Current assumptions do not yet support a profitable release after adjusted delivery costs.",
            tone: "danger" as const,
          }
        : cautionWarnings.length > 0
          ? {
              label: "Watch assumptions",
              description:
                "The project is viable on paper, but some assumptions need tightening before using it for investor or pricing decisions.",
              tone: "caution" as const,
            }
          : {
              label: "Feasibility in range",
              description:
                "Core assumptions are internally consistent and pricing is above break-even with margin protection.",
              tone: "success" as const,
          };
  const timingWarnings = results.phasing.timingWarnings;
  const presetWarnings = getPresetDeviationWarnings(form);
  const inferredPreset = useMemo(() => inferDevelopmentPreset(form), [form]);
  const activePresetDefinition = inferredPreset ? getDevelopmentPresetDefinition(inferredPreset) : null;
  const recommendationBundle = useMemo(
    () => buildCalculatorRecommendations(form, results),
    [form, results],
  );
  const sensitivitySnapshots = useMemo(
    () => buildSensitivitySnapshots(form, results),
    [form, results],
  );
  const mostSensitiveVariable = useMemo(
    () => getMostSensitiveVariable(sensitivitySnapshots),
    [sensitivitySnapshots],
  );
  const leastSensitiveVariable = useMemo(
    () => getLeastSensitiveVariable(sensitivitySnapshots),
    [sensitivitySnapshots],
  );
  const currentComparisonCandidate = useMemo<ComparisonCandidate>(() => ({
    id: activeCalculationId ?? "current-draft",
    label: form.projectName || "Current model",
    kind: "current",
    form,
    result: results,
    meta: activeCalculationId ? "Active saved calculation" : "Unsaved draft",
  }), [activeCalculationId, form, results]);
  const presetComparisonCandidates = useMemo<ComparisonCandidate[]>(() =>
    presetComparisonKeys.map((presetKey) => {
      const presetForm = applyDevelopmentPreset(form, presetKey);
      const presetDefinition = getDevelopmentPresetDefinition(presetKey);

      return {
        id: `preset-${presetKey}`,
        label: `${presetDefinition.label} variant`,
        kind: "preset",
        form: presetForm,
        result: calculateDevelopmentFeasibility(presetForm),
        meta: "Preset-driven variant",
      };
    }), [form, presetComparisonKeys]);
  const selectedSavedCandidates = useMemo<ComparisonCandidate[]>(() =>
    comparisonSelection.reduce<ComparisonCandidate[]>((items, id) => {
      const detail = comparisonDetails[id];

      if (!detail) {
        return items;
      }

      items.push({
        id,
        label:
          detail.versionLabel != null
            ? `${detail.form.projectName || "Saved calculation"} - ${detail.versionLabel}`
            : detail.form.projectName || "Saved calculation",
        kind: "saved",
        form: detail.form,
        result: detail.result,
        meta:
          detail.versionLabel != null
            ? `Saved version - V${detail.versionNumber}`
            : "Saved comparison",
      });

      return items;
    }, []), [comparisonDetails, comparisonSelection]);
  const comparisonCandidates = useMemo(
    () => [currentComparisonCandidate, ...selectedSavedCandidates, ...presetComparisonCandidates],
    [currentComparisonCandidate, selectedSavedCandidates, presetComparisonCandidates],
  );
  const comparisonRecommendationBundle = useMemo(
    () => buildComparisonRecommendations(comparisonCandidates),
    [comparisonCandidates],
  );

  useEffect(() => {
    if (!comparisonMode) {
      return;
    }

    const missingId = comparisonSelection.find((id) => !comparisonDetails[id]);

    if (!missingId) {
      return;
    }

    let cancelled = false;
    setComparisonLoading(missingId);

    fetch(`/api/admin/development-calculations/${missingId}`)
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as
          | { success?: boolean; data?: DevelopmentCalculationDetail; error?: string }
          | null;

        if (!response.ok || !payload?.success || !payload.data) {
          throw new Error(payload?.error ?? "Unable to load comparison calculation.");
        }

        if (!cancelled) {
          setComparisonDetails((current) => ({
            ...current,
            [missingId]: payload.data!,
          }));
        }
      })
      .catch((error) => {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : "Unable to load comparison calculation.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setComparisonLoading(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [comparisonDetails, comparisonMode, comparisonSelection]);

  async function saveCalculation() {
    setPending("save");

    try {
      const response = await fetch(
        activeCalculationId
          ? `/api/admin/development-calculations/${activeCalculationId}`
          : "/api/admin/development-calculations",
        {
          method: activeCalculationId ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(form),
        },
      );

      const payload = (await response.json().catch(() => null)) as
        | {
            success?: boolean;
            error?: string;
            data?: { redirectTo?: string };
          }
        | null;

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error ?? "Unable to save feasibility project.");
      }

      setSavingState("saved");
      toast.success(activeCalculationId ? "Feasibility project updated." : "Feasibility project saved.");

      if (!activeCalculationId && payload.data?.redirectTo) {
        router.push(payload.data.redirectTo);
      } else {
        router.refresh();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save feasibility project.");
    } finally {
      setPending(null);
    }
  }

  async function saveAsNewVersion() {
    if (!activeCalculationId) {
      toast.error("Save the project first before creating a new version.");
      return;
    }

    const suggestedLabel = `Version ${versions.length + 1}`;
    const versionLabel = window.prompt("Name this version", suggestedLabel)?.trim();

    if (!versionLabel) {
      return;
    }

    setPending("saveVersion");

    try {
      const response = await fetch(`/api/admin/development-calculations/${activeCalculationId}/versions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          versionLabel,
          sourcePresetKey: inferredPreset ?? selectedPreset ?? undefined,
          form,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | {
            success?: boolean;
            error?: string;
            data?: { redirectTo?: string };
          }
        | null;

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error ?? "Unable to save a new version.");
      }

      toast.success("New feasibility version saved.");

      if (payload.data?.redirectTo) {
        router.push(payload.data.redirectTo);
      } else {
        router.refresh();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save a new version.");
    } finally {
      setPending(null);
    }
  }

  async function archiveCalculation() {
    if (!activeCalculationId) {
      setForm(createDraft(defaultCurrency));
      setSavingState("draft");
      return;
    }

    setPending("delete");

    try {
      const response = await fetch(`/api/admin/development-calculations/${activeCalculationId}`, {
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => null)) as
        | { success?: boolean; error?: string }
        | null;

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error ?? "Unable to archive feasibility project.");
      }

      toast.success("Feasibility project archived.");
      router.push("/admin/feasibility");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to archive feasibility project.");
    } finally {
      setPending(null);
    }
  }

  function updateField<K extends keyof DevelopmentCalculationInput>(
    key: K,
    value: DevelopmentCalculationInput[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
    setSavingState("draft");
  }

  function applyPreset(
    presetKey: DevelopmentPresetKey,
    options?: {
      preserveIdentity?: boolean;
    },
  ) {
    setSelectedPreset(presetKey);
    setForm((current) => {
      const next = applyDevelopmentPreset(current, presetKey);

      if (options?.preserveIdentity ?? true) {
        next.projectName = current.projectName;
        next.location = current.location;
        next.notes = current.notes;
        next.currency = current.currency;
        next.landSizeHectares = current.landSizeHectares;
        next.landPurchasePrice = current.landPurchasePrice;
        next.purchaseDate = current.purchaseDate;
      }

      return next;
    });
    setSavingState("draft");
  }

  function applyQuickStartField<K extends keyof DevelopmentCalculationInput>(
    key: K,
    value: DevelopmentCalculationInput[K],
  ) {
    setForm((current) => {
      const next = {
        ...current,
        [key]: value,
      };

      return selectedPreset ? applyDevelopmentPreset(next, selectedPreset) : next;
    });
    setSavingState("draft");
  }

  function updateSalesMixItem(
    index: number,
    patch: Partial<DevelopmentCalculationInput["salesMixItems"][number]>,
  ) {
    setForm((current) => ({
      ...current,
      salesMixItems: current.salesMixItems.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    }));
    setSavingState("draft");
  }

  function addSalesMixItem() {
    setForm((current) => ({
      ...current,
      salesMixItems: [...current.salesMixItems, createBlankSalesMixItem(current.salesMixItems.length)],
    }));
    setSavingState("draft");
  }

  function removeSalesMixItem(index: number) {
    setForm((current) => ({
      ...current,
      salesMixItems: current.salesMixItems.filter((_, itemIndex) => itemIndex !== index),
    }));
    setSavingState("draft");
  }

  function updatePhase(
    index: number,
    patch: Partial<DevelopmentCalculationInput["phases"][number]>,
  ) {
    setForm((current) => ({
      ...current,
      phases: current.phases.map((phase, phaseIndex) =>
        phaseIndex === index ? { ...phase, ...patch } : phase,
      ),
    }));
    setSavingState("draft");
  }

  function addPhase() {
    setForm((current) => ({
      ...current,
      phases: [...current.phases, createBlankDevelopmentPhase(current.phases.length)],
    }));
    setSavingState("draft");
  }

  function removePhase(index: number) {
    setForm((current) => ({
      ...current,
      phases: current.phases.filter((_, phaseIndex) => phaseIndex !== index),
    }));
    setSavingState("draft");
  }

  function applyPhaseTemplate(templateSize: number) {
    setForm((current) => ({
      ...current,
      phases: createPhaseTemplateFromPreset(templateSize),
    }));
    setSavingState("draft");
  }

  function exportPdf() {
    if (!activeCalculationId) {
      return;
    }

    setExportingPdf(true);

    const popup = window.open(
      `${calculationRoute(activeCalculationId)}/report?export=pdf`,
      "_blank",
      "noopener,noreferrer",
    );

    if (!popup) {
      setExportingPdf(false);
      toast.error("Unable to open the PDF export window. Allow pop-ups and try again.");
      return;
    }

    window.setTimeout(() => setExportingPdf(false), 1200);
  }

  function toggleComparisonSelection(id: string) {
    setComparisonSelection((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id].slice(0, 3),
    );
  }

  function togglePresetComparison(presetKey: DevelopmentPresetKey) {
    setPresetComparisonKeys((current) =>
      current.includes(presetKey)
        ? current.filter((item) => item !== presetKey)
        : [...current, presetKey].slice(0, 2),
    );
  }

  function handleQuickAdjust(key: QuickAdjustKey, delta: number) {
    setLastAdjustmentBaseline(results);
    setFocusedQuickAdjust(key);
    setForm((current) => applyQuickAdjustment(current, key, delta));
    setSavingState("draft");
  }

  function resetAdjustments() {
    setLastAdjustmentBaseline(null);
    setFocusedQuickAdjust(null);

    if (selected?.form) {
      setForm(selected.form);
      setSavingState("saved");
      return;
    }

    if (selectedPreset) {
      setForm(applyDevelopmentPreset(createDraft(defaultCurrency), selectedPreset));
      setSavingState("draft");
      return;
    }

    setForm(blankForm ?? createDraft(defaultCurrency));
    setSavingState("draft");
  }

  function setWorkspaceMode(mode: WorkspaceMode) {
    if (mode === "SIMPLE") {
      setQuickStartMode(true);
      setAdvancedMode(false);
      return;
    }

    setQuickStartMode(false);
    setAdvancedMode(mode === "ADVANCED");
  }

  return (
    <div
      className={cn(
        "grid gap-6 pb-24 xl:gap-8 xl:pb-0",
        presentationView
          ? "xl:grid-cols-1"
          : !showProjectBrowser
            ? activeTab === "COMPARE"
              ? "xl:grid-cols-1"
              : "xl:grid-cols-[minmax(0,1fr)_320px]"
          : activeTab === "COMPARE"
            ? "xl:grid-cols-[260px_minmax(0,1fr)]"
            : "xl:grid-cols-[260px_minmax(0,1fr)_340px] 2xl:grid-cols-[280px_minmax(0,1fr)_360px]",
      )}
    >
      {!presentationView && showProjectBrowser ? (
      <div className="space-y-4 xl:sticky xl:top-6 xl:self-start print:hidden">
        <Card className="rounded-[24px] border-[var(--line)] p-4 shadow-none sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-400)]">
                Saved projects
              </div>
              <h2 className="mt-2 text-lg font-semibold text-[var(--ink-950)]">
                Feasibility workspace
              </h2>
            </div>
            <div className="rounded-full border border-[var(--line)] bg-[var(--sand-50)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-500)]">
              {calculations.length} saved
            </div>
          </div>
          <p className="mt-2 text-sm leading-6 text-[var(--ink-500)]">
            Save land feasibility assumptions, compare scenarios, and keep investor-grade pricing logic in one place.
          </p>
          <div className="mt-4">
            <Link href="/admin/feasibility">
              <Button variant={activeCalculationId ? "outline" : "default"} className="w-full">
                New feasibility project
              </Button>
            </Link>
          </div>
          <div className="mt-5 space-y-3">
            {calculations.length > 0 ? (
              calculations.map((item) => (
                <Link key={item.id} href={calculationRoute(item.id)}>
                  <div
                    className={cn(
                      "rounded-[18px] border p-4 transition",
                      activeCalculationId === item.id
                        ? "border-[var(--brand-500)]/35 bg-[var(--sand-50)]"
                        : "border-[var(--line)] bg-white hover:border-[var(--brand-300)]",
                    )}
                  >
                    <div className="text-sm font-semibold text-[var(--ink-950)]">{item.projectName}</div>
                    <div className="mt-1 text-xs text-[var(--ink-500)]">
                      {item.location || "No location set"} - {item.saleMode.replaceAll("_", " ")}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <StatusChip
                        label={item.versionLabel ? `${item.versionLabel} - V${item.versionNumber}` : `Version ${item.versionNumber}`}
                        tone={activeCalculationId === item.id ? "success" : "default"}
                      />
                      {item.sourcePresetKey ? (
                        <StatusChip label={item.sourcePresetKey.replaceAll("_", " ")} />
                      ) : null}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <StatusChip
                        tone={item.roiPercent >= 0 ? "success" : "danger"}
                        label={item.roiPercent >= 0 ? "Positive ROI" : "Negative ROI"}
                      />
                      <StatusChip label={item.paymentMode.replaceAll("_", " ")} />
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <div className="font-semibold text-[var(--ink-500)]">Revenue</div>
                        <div className="mt-1 text-[var(--ink-900)]">
                          {formatCurrency(item.estimatedRevenue, form.currency)}
                        </div>
                      </div>
                      <div>
                        <div className="font-semibold text-[var(--ink-500)]">ROI</div>
                        <div className="mt-1 text-[var(--ink-900)]">{formatPercent(item.roiPercent)}</div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <div className="rounded-[24px] border border-dashed border-[var(--line)] bg-[var(--sand-50)] p-4 text-sm leading-6 text-[var(--ink-600)]">
                No saved calculations yet. Start a project and save it once the assumptions look right.
              </div>
            )}
          </div>
        </Card>
      </div>
      ) : null}

      <div className="space-y-6 xl:max-w-[1040px]">
        <div className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-400)]">
                Feasibility & Planning
              </div>
              <h1 className="mt-2 text-3xl font-semibold tracking-[-0.02em] text-[var(--ink-950)] sm:text-[2.2rem]">
                Land development calculator
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--ink-500)] sm:text-[15px]">
                Evaluate land efficiency, delivery cost, pricing posture, and timing risk in one calm decision workspace.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 print:hidden">
              <Link href="/admin/feasibility/new">
                <Button variant={activeCalculationId ? "outline" : "default"}>
                  New project
                </Button>
              </Link>
              {!presentationView ? (
                <Button
                  variant={comparisonMode ? "default" : "outline"}
                  onClick={() => setComparisonMode((current) => !current)}
                >
                  {comparisonMode ? "Exit comparison" : "Comparison mode"}
                </Button>
              ) : null}
              {decisionHref ? (
                <Link href={decisionHref}>
                  <Button variant="outline">View decision</Button>
                </Link>
              ) : null}
              {allowPresentationView && activeCalculationId ? (
                <Button
                  variant="outline"
                  onClick={() => setPresentationView((current) => !current)}
                >
                  {presentationView ? "Model workspace" : "Presentation view"}
                </Button>
              ) : null}
              {presentationView && activeCalculationId ? (
                <Button
                  variant="outline"
                  onClick={exportPdf}
                  disabled={exportingPdf}
                >
                  {exportingPdf ? "Preparing PDF..." : "Export PDF"}
                </Button>
              ) : null}
              {presentationView ? (
                <Button variant="outline" onClick={() => window.print()}>
                  Print report
                </Button>
              ) : null}
              <Button onClick={saveCalculation} disabled={pending === "save"}>
                {pending === "save"
                  ? "Saving..."
                  : activeCalculationId
                    ? "Save project"
                    : "Create project"}
              </Button>
            </div>
          </div>

          {!presentationView ? (
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div className="space-y-3">
                <SegmentedTabs
                  value={workspaceMode}
                  onChange={setWorkspaceMode}
                  items={[
                    { value: "SIMPLE", label: "Simple" },
                    { value: "STANDARD", label: "Standard" },
                    { value: "ADVANCED", label: "Advanced" },
                  ]}
                />
                <p className="text-sm leading-6 text-[var(--ink-500)]">
                  {workspaceMode === "SIMPLE"
                    ? "Quick first-pass pricing with only the essential project inputs exposed."
                    : workspaceMode === "STANDARD"
                      ? "Balanced modelling mode for the main delivery and pricing decisions."
                      : "Full commercial review with timing, sensitivity, comparison, and scenario controls."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 lg:justify-end">
                {activeCalculationId ? (
                  <Button
                    variant="outline"
                    onClick={saveAsNewVersion}
                    disabled={pending === "saveVersion"}
                  >
                    {pending === "saveVersion" ? "Saving version..." : "Save as new version"}
                  </Button>
                ) : null}
                <Button variant="outline" onClick={archiveCalculation} disabled={pending === "delete"}>
                  {pending === "delete"
                    ? "Archiving..."
                    : activeCalculationId
                      ? "Archive project"
                      : "Reset draft"}
                </Button>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-400)]">
            <span className="rounded-full border border-[var(--line)] bg-white px-3 py-1.5">
              {savingState === "saved" ? "Saved project" : "Unsaved draft"}
            </span>
            {activeCalculationId ? (
              <span className="rounded-full border border-[var(--line)] bg-white px-3 py-1.5">
                {activeVersionLabel ? `${activeVersionLabel} - V${selected?.versionNumber ?? 1}` : `V${selected?.versionNumber ?? 1}`}
              </span>
            ) : null}
            {selected?.sourcePresetKey ? (
              <span className="rounded-full border border-[var(--line)] bg-white px-3 py-1.5">
                {selected.sourcePresetKey.replaceAll("_", " ")} preset
              </span>
            ) : null}
            <span
              className={cn(
                "rounded-full border px-3 py-1.5",
                projectSignal.tone === "success" && "border-emerald-200 bg-emerald-50/60 text-emerald-800",
                projectSignal.tone === "caution" && "border-amber-200 bg-amber-50/60 text-amber-800",
                projectSignal.tone === "danger" && "border-rose-200 bg-rose-50/60 text-rose-800",
              )}
            >
              {projectSignal.label}
            </span>
          </div>
          <p className="max-w-3xl text-sm leading-6 text-[var(--ink-500)]">
            {projectSignal.description}
          </p>
          {!presentationView && activeTab !== "COMPARE" ? (
            <div className="grid gap-3 md:grid-cols-3">
              <KPIStatCard
                label="Recommended price"
                value={formatCurrency(results.revenue.minimumSellingPricePerSqm, form.currency)}
                detail="Current minimum defendable rate per sqm."
                tone="accent"
              />
              <KPIStatCard
                label="Expected profit"
                value={formatCurrency(results.revenue.estimatedGrossProfit, form.currency)}
                detail={`${formatCurrency(results.revenue.profitPerSqm, form.currency)} per sellable sqm`}
                tone={results.revenue.estimatedGrossProfit >= 0 ? "success" : "danger"}
              />
              <KPIStatCard
                label="ROI"
                value={formatPercent(results.revenue.roiPercent)}
                detail={`${formatPercent(results.revenue.marginPercent)} projected margin`}
                tone={results.revenue.roiPercent >= 0 ? "success" : "danger"}
              />
            </div>
          ) : null}
          {!presentationView ? (
            <SegmentedTabs
              className="pt-1"
              value={activeTab}
              onChange={(next) => {
                setActiveTab(next);
                setComparisonMode(next === "COMPARE");
              }}
              items={[
                { value: "OVERVIEW", label: "Overview" },
                { value: "MODEL", label: "Model" },
                { value: "INSIGHTS", label: "Insights" },
                { value: "COMPARE", label: "Compare", badge: comparisonCandidates.length > 1 ? String(comparisonCandidates.length) : undefined },
              ]}
            />
          ) : null}
        </div>

        {activeCalculationId && versions.length > 0 ? (
          <SectionContainer
            eyebrow="Versioning"
            title="Project versions"
            description="Switch between commercial approaches quickly. Save a new version when you want a persistent branch for a different pricing posture, phasing plan, or preset strategy."
            badge={`${versions.length} versions`}
            collapsible
            defaultOpen={false}
          >
            <div className="space-y-4">
              <div className="flex gap-2 overflow-x-auto pb-1">
                {versions.map((version) => (
                  <Link key={version.id} href={calculationRoute(version.id)} className="min-w-[190px]">
                    <div
                      className={cn(
                        "rounded-[18px] border px-4 py-3 transition",
                        version.id === activeCalculationId
                          ? "border-[var(--brand-500)]/35 bg-[var(--sand-50)]"
                          : "border-[var(--line)] bg-white hover:border-[var(--brand-300)]",
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-[var(--ink-950)]">
                          {version.versionLabel || `Version ${version.versionNumber}`}
                        </div>
                        <StatusChip
                          label={`V${version.versionNumber}`}
                          tone={version.id === activeCalculationId ? "success" : "default"}
                        />
                      </div>
                      <div className="mt-2 text-xs text-[var(--ink-500)]">
                        Updated {new Date(version.updatedAt).toLocaleDateString()}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {version.sourcePresetKey ? (
                          <StatusChip label={version.sourcePresetKey.replaceAll("_", " ")} />
                        ) : null}
                        {version.id === activeCalculationId ? (
                          <StatusChip label="Current version" tone="success" />
                        ) : null}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <MiniStat label="Active version" value={activeVersionLabel || `Version ${selected?.versionNumber ?? 1}`} />
                <MiniStat label="Last modified" value={selected?.updatedAt ? new Date(selected.updatedAt).toLocaleDateString() : "Draft"} />
                <MiniStat label="Preset used" value={selected?.sourcePresetKey ? selected.sourcePresetKey.replaceAll("_", " ") : activePresetDefinition?.label ?? "Custom"} />
              </div>
            </div>
          </SectionContainer>
        ) : null}

        {!presentationView && activeTab === "OVERVIEW" ? (
          <SectionContainer
            eyebrow="Overview"
            title="Workspace snapshot"
            description="Keep the current commercial posture visible while you refine assumptions, phasing, and pricing."
            badge={workspaceMode.toLowerCase()}
          >
            <ChartCard
              title="Cumulative cash position"
              description="Use the liquidity curve to see how deep funding pressure gets and when the plan recovers cumulative cash."
            >
              <CumulativeCashChart
                points={results.phasing.monthlyForecast}
                paybackMonth={results.phasing.paybackMonth}
                currency={form.currency}
              />
            </ChartCard>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <SummaryMetric label="Sellable land" value={`${formatNumber(results.area.sellableSqm)} sqm`} tone="success" />
              <SummaryMetric label="Adjusted cost" value={formatCurrency(results.costs.adjustedTotalCost, form.currency)} />
              <SummaryMetric label="Funding gap" value={formatCurrency(results.phasing.peakFundingGap, form.currency)} tone={results.phasing.peakFundingGap > 0 ? "danger" : "success"} />
              <SummaryMetric label="Payback" value={results.phasing.paybackMonth != null ? `Month ${results.phasing.paybackMonth}` : "Not recovered"} tone={results.phasing.paybackMonth != null ? "success" : "danger"} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setActiveTab("MODEL")}>
                Continue modelling
              </Button>
              {decisionHref ? (
                <Link href={decisionHref}>
                  <Button>View decision</Button>
                </Link>
              ) : null}
            </div>
          </SectionContainer>
        ) : null}

        {presentationView && activeCalculationId ? (
          <InvestorReportView
            form={form}
            results={results}
            pricingNarrative={pricingNarrative}
            allocationNarrative={allocationNarrative}
            marginNarrative={marginNarrative}
            salesMixUnallocatedSqm={salesMixUnallocatedSqm}
            installmentPriceUplift={installmentPriceUplift}
            activeWarnings={activeWarnings}
            cautionWarnings={cautionWarnings}
            createdAt={selected?.createdAt ?? null}
            updatedAt={selected?.updatedAt ?? null}
            recommendationBundle={recommendationBundle}
          />
        ) : comparisonMode ? (
          <ComparisonWorkspace
            calculations={calculations}
            activeCalculationId={activeCalculationId}
            comparisonCandidates={comparisonCandidates}
            comparisonSelection={comparisonSelection}
            comparisonLoading={comparisonLoading}
            onToggleSaved={toggleComparisonSelection}
            presetComparisonKeys={presetComparisonKeys}
            onTogglePreset={togglePresetComparison}
            currentPresetKey={selectedPreset}
            currency={form.currency}
            comparisonRecommendationBundle={comparisonRecommendationBundle}
          />
        ) : (
          <>
        {activeTab === "MODEL" ? (
          <>

        <SectionContainer
          eyebrow="Quick start"
          title="Preset assumptions and startup mode"
          description="Start with a developer-grade baseline instead of a blank sheet. Presets fill land efficiency, cost assumptions, pricing growth, and default phasing so you can get to a first answer quickly."
          collapsible
          defaultOpen
          badge={workspaceMode === "SIMPLE" ? "Primary focus" : "Setup"}
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-[var(--line)] bg-[var(--sand-50)]/55 px-4 py-3.5">
              <div>
                <div className="text-sm font-semibold text-[var(--ink-950)]">Startup mode</div>
                <div className="mt-1 text-sm leading-6 text-[var(--ink-500)]">
                  Quick Start keeps only the essential fields visible and uses the preset as the underwriting baseline.
                </div>
              </div>
              <Button
                variant={quickStartMode ? "default" : "outline"}
                onClick={() => setQuickStartMode((current) => !current)}
              >
                {quickStartMode ? "Switch to full mode" : "Use Quick Start"}
              </Button>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {DEVELOPMENT_PRESETS.map((preset) => (
                <PresetTile
                  key={preset.key}
                  preset={preset}
                  active={selectedPreset === preset.key}
                  onSelect={() => applyPreset(preset.key)}
                />
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {selectedPreset ? (
                <Button variant="outline" onClick={() => applyPreset(selectedPreset)}>
                  Reset to preset
                </Button>
              ) : null}
              <Button
                variant="outline"
                onClick={() => selectedPreset && applyPreset(selectedPreset, { preserveIdentity: false })}
                disabled={!selectedPreset}
              >
                Rebuild full model from preset
              </Button>
              <div className="text-sm text-[var(--ink-500)]">
                Current stance: <span className="font-semibold text-[var(--ink-900)]">{activePresetDefinition?.label ?? "Custom"}</span>
              </div>
            </div>

            <div className="rounded-[18px] border border-[var(--line)] bg-white px-4 py-4">
              <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.9fr)] xl:items-start">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-400)]">
                    Preset guidance
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[var(--ink-500)]">
                    {activePresetDefinition?.guidance ??
                      "This model no longer matches a stock preset closely. Treat it as a custom underwriting case."}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <MetricChip label={`Reserved ${formatPercent(results.area.reservedPercentage)}`} />
                  <MetricChip label={`Target margin ${formatPercent(form.requiredTargetProfitMarginRate)}`} />
                  <MetricChip label={`Inflation ${formatPercent(form.annualInflationRate)}`} />
                  <MetricChip label={`${form.phases.length || activePresetDefinition?.quickStartPhases || 1} phases`} />
                </div>
              </div>
              {presetWarnings.length > 0 ? (
                <div className="mt-4 space-y-2">
                  {presetWarnings.map((warning) => (
                    <WarningCard key={`preset-warning-${warning}`} tone="caution" message={warning} />
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          {quickStartMode ? (
            <div className="rounded-[20px] border border-[var(--line)] bg-white p-5 sm:p-6">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-400)]">
                Quick Start inputs
              </div>
              <h3 className="mt-2 text-lg font-semibold text-[var(--ink-950)]">Get to a first feasibility answer quickly</h3>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--ink-500)]">
                Enter only the site basics below. Estate OS will fill the rest from the active preset, including cost assumptions, pricing growth, and phasing.
              </p>
              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Field label="Project name" helper="Internal project label for the saved feasibility.">
                  <Input
                    placeholder="e.g. Lekki Ridge Estate"
                    value={form.projectName}
                    onChange={(event) => applyQuickStartField("projectName", event.target.value)}
                  />
                </Field>
                <Field label="Location" helper="Optional corridor or market cluster.">
                  <Input
                    placeholder="e.g. Epe, Lagos"
                    value={form.location ?? ""}
                    onChange={(event) => applyQuickStartField("location", event.target.value)}
                  />
                </Field>
                <Field label="Land size (hectares)" helper={`Gross land area. ${formatNumber(results.area.grossSqm)} sqm automatically.`}>
                  <Input
                    type="number"
                    value={form.landSizeHectares}
                    onChange={(event) => applyQuickStartField("landSizeHectares", Number(event.target.value || 0))}
                  />
                </Field>
                <Field label="Land purchase price" helper="This drives the preset-based infrastructure and operating assumptions.">
                  <Input
                    type="number"
                    value={form.landPurchasePrice}
                    onChange={(event) => applyQuickStartField("landPurchasePrice", Number(event.target.value || 0))}
                  />
                </Field>
              </div>
            </div>
          ) : null}
        </SectionContainer>

        {!quickStartMode ? (
        <>
        <SegmentedTabs
          className="mb-1"
          value={activeModelSection ?? "BASICS"}
          onChange={(next) => setActiveModelSection((current) => (current === next ? null : next))}
          items={[
            { value: "BASICS", label: "Basics" },
            { value: "COSTS", label: "Costs" },
            { value: "PRICING", label: "Pricing" },
            { value: "PHASING", label: "Phasing" },
          ]}
        />
        {activeModelSection === null ? (
          <Card className="rounded-[28px] border border-dashed border-[var(--line)] bg-[var(--sand-50)] p-6">
            <div className="text-sm font-semibold text-[var(--ink-950)]">Model section collapsed</div>
            <p className="mt-2 text-sm leading-6 text-[var(--ink-600)]">
              Choose a section above to keep the modelling flow focused. Only one section stays open at a time.
            </p>
          </Card>
        ) : null}
        {activeModelSection === "BASICS" ? (
          <>
        <SectionContainer
          eyebrow="Inputs"
          title="Project basics"
          description="Set the site size, timing, and land acquisition assumptions that anchor the rest of the feasibility model."
          collapsible
          defaultOpen={workspaceMode !== "SIMPLE"}
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Field label="Project name" helper="Use the internal name investors or management will recognise.">
              <Input
                placeholder="e.g. Greenfields Estate Phase 1"
                value={form.projectName}
                onChange={(event) => updateField("projectName", event.target.value)}
              />
            </Field>
            <Field label="Location" helper="Estate location, corridor, or market cluster.">
              <Input
                placeholder="e.g. Ibeju-Lekki, Lagos"
                value={form.location ?? ""}
                onChange={(event) => updateField("location", event.target.value)}
              />
            </Field>
            <Field label="Currency" helper="Used across KPI cards and pricing outputs.">
              <Input
                maxLength={3}
                value={form.currency}
                onChange={(event) => updateField("currency", event.target.value.toUpperCase())}
              />
            </Field>
            <Field label="Land size (hectares)" helper={`Gross land area. ${formatNumber(results.area.grossSqm)} sqm automatically.`}>
              <Input
                type="number"
                value={form.landSizeHectares}
                onChange={(event) => updateField("landSizeHectares", Number(event.target.value || 0))}
              />
            </Field>
            <Field label="Land purchase price" helper="Nominal site acquisition cost before delivery and overhead.">
              <Input
                type="number"
                value={form.landPurchasePrice}
                onChange={(event) => updateField("landPurchasePrice", Number(event.target.value || 0))}
              />
            </Field>
            <Field label="Purchase date" helper="Optional. Useful for internal audit and later reporting.">
              <Input
                type="date"
                value={form.purchaseDate ?? ""}
                onChange={(event) => updateField("purchaseDate", event.target.value)}
              />
            </Field>
            <Field label="Project duration (months)" helper="How long delivery and cost exposure runs.">
              <Input
                type="number"
                value={form.projectDurationMonths}
                onChange={(event) => updateField("projectDurationMonths", Number(event.target.value || 0))}
              />
            </Field>
            <Field label="Sales duration (months)" helper="How long absorption and price appreciation assumptions should run.">
              <Input
                type="number"
                value={form.salesDurationMonths}
                onChange={(event) => updateField("salesDurationMonths", Number(event.target.value || 0))}
              />
            </Field>
          </div>
          <Field
            label="Project notes"
            helper="Optional internal context such as corridor assumptions, title status, or investor caveats."
          >
            <Textarea
              value={form.notes ?? ""}
              onChange={(event) => updateField("notes", event.target.value)}
              placeholder="Key assumptions, land history, title notes, investor caveats..."
            />
          </Field>
        </SectionContainer>

        <SectionContainer
          eyebrow="Efficiency"
          title="Land utilization"
          description="Model the real estate reality: roads, drainage, green areas, and community infrastructure consume saleable land."
          collapsible
          defaultOpen={workspaceMode === "ADVANCED"}
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <PercentField label="Roads" helper="Primary and secondary access roads." value={form.roadsPercentage} onChange={(value) => updateField("roadsPercentage", value)} />
            <PercentField label="Drainage" helper="Drainage corridors and runoff handling." value={form.drainagePercentage} onChange={(value) => updateField("drainagePercentage", value)} />
            <PercentField label="Green/common areas" helper="Parks, landscaping, and community open space." value={form.greenAreaPercentage} onChange={(value) => updateField("greenAreaPercentage", value)} />
            <PercentField label="Utilities/community" helper="Utilities, support uses, and shared facilities." value={form.utilitiesPercentage} onChange={(value) => updateField("utilitiesPercentage", value)} />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <MiniStat label="Total reserved" value={formatPercent(results.area.reservedPercentage)} />
            <MiniStat label="Reserved sqm" value={formatNumber(results.area.reservedSqm)} />
            <MiniStat label="Net sellable sqm" value={formatNumber(results.area.sellableSqm)} tone="success" />
          </div>
        </SectionContainer>
          </>
        ) : null}

        {activeModelSection === "COSTS" ? (
          <>
        <SectionContainer
          eyebrow="Costs"
          title="Cost breakdown"
          description="Separate acquisition, infrastructure, and operating cost pools so escalation and margin assumptions remain inspectable."
          collapsible
          defaultOpen={workspaceMode !== "SIMPLE"}
        >
          <div className="grid gap-6 xl:grid-cols-3">
            <CostColumn
              title="Acquisition"
              helper="Costs required to secure and perfect the site before development begins."
              fields={[
                ["Survey cost", form.surveyCost, (value) => updateField("surveyCost", value)],
                ["Legal / documentation", form.legalDocumentationCost, (value) => updateField("legalDocumentationCost", value)],
                ["Title / perfection", form.titlePerfectionCost, (value) => updateField("titlePerfectionCost", value)],
              ]}
            />
            <CostColumn
              title="Development"
              helper="Physical delivery costs that are most exposed to construction escalation."
              fields={[
                ["Site clearing", form.siteClearingCost, (value) => updateField("siteClearingCost", value)],
                ["Sand filling / earthwork", form.sandFillingEarthworkCost, (value) => updateField("sandFillingEarthworkCost", value)],
                ["Road construction", form.roadConstructionCost, (value) => updateField("roadConstructionCost", value)],
                ["Drainage", form.drainageCost, (value) => updateField("drainageCost", value)],
                ["Power infrastructure", form.powerInfrastructureCost, (value) => updateField("powerInfrastructureCost", value)],
                ["Water infrastructure", form.waterInfrastructureCost, (value) => updateField("waterInfrastructureCost", value)],
                ["Fencing / security", form.fencingGatehouseSecurityCost, (value) => updateField("fencingGatehouseSecurityCost", value)],
              ]}
            />
            <CostColumn
              title="Operating"
              helper="Commercial and operational overhead needed to take inventory to market."
              fields={[
                ["Marketing / commission", form.marketingSalesCommissionCost, (value) => updateField("marketingSalesCommissionCost", value)],
                ["Admin cost", form.adminCost, (value) => updateField("adminCost", value)],
                ["Contingency", form.contingencyCost, (value) => updateField("contingencyCost", value)],
              ]}
            />
          </div>
        </SectionContainer>

        <SectionContainer
          eyebrow="Assumptions"
          title="Financial assumptions"
          description="Make inflation, escalation, risk premium, and target margin explicit so pricing decisions are explainable later."
          collapsible
          defaultOpen={workspaceMode === "ADVANCED"}
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <PercentField label="Annual inflation" helper="General cost drift across the project period." value={form.annualInflationRate} onChange={(value) => updateField("annualInflationRate", value)} />
            <PercentField label="Construction escalation" helper="Additional delivery pressure on infrastructure-heavy costs." value={form.constructionCostEscalationRate} onChange={(value) => updateField("constructionCostEscalationRate", value)} />
            <PercentField label="Selling price appreciation" helper="Expected market lift during the sales window." value={form.annualSellingPriceAppreciationRate} onChange={(value) => updateField("annualSellingPriceAppreciationRate", value)} />
            <PercentField label="Market risk premium" helper="Buffer for execution, market softness, and pricing uncertainty." value={form.marketRiskPremiumRate} onChange={(value) => updateField("marketRiskPremiumRate", value)} />
            {advancedMode ? (
              <PercentField label="Financing cost / interest" helper="Optional carrying cost if the project is not fully equity-funded." value={form.financingCostRate} onChange={(value) => updateField("financingCostRate", value)} />
            ) : null}
            <PercentField label="Required target profit margin" helper="Margin protection used for the recommended minimum selling price." value={form.requiredTargetProfitMarginRate} onChange={(value) => updateField("requiredTargetProfitMarginRate", value)} />
          </div>
        </SectionContainer>
          </>
        ) : null}

        {activeModelSection === "PRICING" ? (
        <SectionContainer
          eyebrow="Revenue model"
          title="Sales model"
          description="Choose how the project is monetised: by sqm, by plot, or through a mixed sales catalogue."
          collapsible
          defaultOpen
          badge="Workflow"
        >
          <div className="space-y-5">
            <WorkflowStep
              step="Step 1"
              title="Choose the commercial structure"
              description="Pick the sales pattern buyers will actually experience. This decides which pricing inputs matter."
            >
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                <div className="grid gap-3 md:grid-cols-3">
                  <ModeCard
                    active={form.saleMode === "PER_SQM"}
                    title="Per sqm"
                    description="Use one headline rate when the site is marketed primarily by square metre."
                  />
                  <ModeCard
                    active={form.saleMode === "PER_PLOT"}
                    title="Per plot"
                    description="Use structured plot products when buyers see standard plot packages."
                  />
                  <ModeCard
                    active={form.saleMode === "MIXED"}
                    title="Mixed"
                    description="Use multiple releases or product types with different sizes and pricing rules."
                  />
                </div>
                <div className="rounded-[24px] border border-[var(--line)] bg-[var(--sand-50)] p-5">
                  <div className="grid gap-4 md:grid-cols-2">
                    <SelectField
                      label="Sale mode"
                      value={form.saleMode}
                      onChange={(value) => updateField("saleMode", value as DevelopmentCalculationInput["saleMode"])}
                      options={[
                        ["PER_SQM", "Per sqm"],
                        ["PER_PLOT", "Per plot"],
                        ["MIXED", "Mixed"],
                      ]}
                      helper="This controls which commercial inputs stay visible below."
                    />
                    <SelectField
                      label="Payment mode"
                      value={form.paymentMode}
                      onChange={(value) => updateField("paymentMode", value as DevelopmentCalculationInput["paymentMode"])}
                      options={[
                        ["OUTRIGHT", "Outright"],
                        ["INSTALLMENT", "Installment"],
                      ]}
                      helper="Choose the buyer payment path you intend to sell into."
                    />
                  </div>
                </div>
              </div>
            </WorkflowStep>

            <WorkflowStep
              step="Step 2"
              title="Enter pricing inputs for the active mode"
              description="Only the inputs relevant to the selected commercial path stay visible, so pricing assumptions are harder to misuse."
            >
              {form.saleMode === "PER_SQM" ? (
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="rounded-[26px] border border-[var(--line)] bg-[var(--sand-50)] p-5">
                    <Field label="Current selling price / sqm" helper="Use the market-facing rate you intend to quote today. If it is lower than break-even, the warning will surface immediately.">
                      <Input
                        type="number"
                        value={form.currentSellingPricePerSqm ?? 0}
                        onChange={(event) => updateField("currentSellingPricePerSqm", Number(event.target.value || 0))}
                      />
                    </Field>
                    {commercialWarnings.length > 0 ? (
                      <div className="mt-4 space-y-3">
                        {commercialWarnings.map((warning) => (
                          <WarningCard key={warning} tone={getWarningTone(warning)} message={warning} />
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="grid gap-3">
                    <MiniStat label="Sellable sqm" value={formatNumber(results.area.sellableSqm)} tone="success" />
                    <MiniStat label="Effective sell price / sqm" value={formatCurrency(results.revenue.effectiveSellingPricePerSqm, form.currency)} />
                    <MiniStat label="Expected revenue" value={formatCurrency(results.revenue.estimatedRevenue, form.currency)} />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-[var(--ink-950)]">Sales mix</h3>
                      <p className="mt-1 text-sm text-[var(--ink-600)]">
                        Build the commercial catalogue exactly as buyers will see it. This is what makes projected revenue realistic.
                      </p>
                    </div>
                    <Button variant="outline" onClick={addSalesMixItem}>
                      Add sales category
                    </Button>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    <MiniStat label="Sellable sqm" value={formatNumber(results.area.sellableSqm)} tone="success" />
                    <MiniStat label="Allocated sqm" value={formatNumber(results.salesMix.allocatedSqm)} />
                    <MiniStat label="Unallocated sqm" value={formatNumber(salesMixUnallocatedSqm)} tone={salesMixUnallocatedSqm > 0 ? "default" : "success"} />
                    <MiniStat label="Blended price / sqm" value={formatCurrency(blendedSellingPricePerSqm, form.currency)} />
                    <MiniStat label="Expected revenue" value={formatCurrency(results.revenue.estimatedRevenue, form.currency)} />
                  </div>
                  {commercialWarnings.length > 0 || largeAllocationGap ? (
                    <div className="space-y-3">
                      {commercialWarnings.map((warning) => (
                        <WarningCard key={warning} tone={getWarningTone(warning)} message={warning} />
                      ))}
                      {largeAllocationGap ? (
                        <WarningCard
                          tone="caution"
                          message="A large share of sellable land is still unallocated. Revenue output may understate the commercial plan until more product categories are defined."
                        />
                      ) : null}
                    </div>
                  ) : null}
                  <div className="space-y-3">
                    {form.salesMixItems.map((item, index) => (
                      <div key={item.id ?? `${item.label}-${index}`} className="rounded-[24px] border border-[var(--line)] p-5">
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
                          <Field label="Label" helper="Category or release name.">
                            <Input value={item.label} onChange={(event) => updateSalesMixItem(index, { label: event.target.value })} />
                          </Field>
                          <Field label="Quantity" helper="Number of plots or units in the category.">
                            <Input type="number" value={item.quantity} onChange={(event) => updateSalesMixItem(index, { quantity: Number(event.target.value || 0) })} />
                          </Field>
                          <Field label="Size sqm" helper="Per-unit land allocation.">
                            <Input type="number" value={item.sizeSqm} onChange={(event) => updateSalesMixItem(index, { sizeSqm: Number(event.target.value || 0) })} />
                          </Field>
                          <SelectField
                            label="Pricing mode"
                            value={item.priceMode}
                            onChange={(value) =>
                              updateSalesMixItem(index, {
                                priceMode: value as DevelopmentCalculationInput["salesMixItems"][number]["priceMode"],
                                pricePerSqm: value === "PER_SQM" ? item.pricePerSqm ?? 0 : undefined,
                                unitPrice: value === "PER_UNIT" ? item.unitPrice ?? 0 : undefined,
                              })
                            }
                            options={[
                              ["PER_UNIT", "Per plot / unit"],
                              ["PER_SQM", "Per sqm"],
                            ]}
                            helper="Use per unit for fixed plot prices and per sqm for flexible land-rate categories."
                          />
                          {item.priceMode === "PER_SQM" ? (
                            <Field label="Price / sqm" helper="Current market-facing price per square metre.">
                              <Input type="number" value={item.pricePerSqm ?? 0} onChange={(event) => updateSalesMixItem(index, { pricePerSqm: Number(event.target.value || 0) })} />
                            </Field>
                          ) : (
                            <Field label="Unit price" helper="Current price for one plot or unit.">
                              <Input type="number" value={item.unitPrice ?? 0} onChange={(event) => updateSalesMixItem(index, { unitPrice: Number(event.target.value || 0) })} />
                            </Field>
                          )}
                          <div className="flex items-end">
                            <Button variant="outline" onClick={() => removeSalesMixItem(index)} disabled={form.salesMixItems.length <= 1}>
                              Remove
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </WorkflowStep>

            <WorkflowStep
              step="Step 3"
              title="Review land allocation coverage"
              description="Pressure-test whether the commercial plan uses enough of the sellable estate to make the revenue projection believable."
            >
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <SummaryMetric label="Sellable sqm" value={formatNumber(results.area.sellableSqm)} tone="success" />
                <SummaryMetric label="Allocated sqm" value={formatNumber(results.salesMix.allocatedSqm)} />
                <SummaryMetric label="Unallocated sqm" value={formatNumber(salesMixUnallocatedSqm)} tone={salesMixUnallocatedSqm > 0 ? "danger" : "success"} />
                <SummaryMetric label="Allocation coverage" value={formatPercent(results.salesMix.allocatedPercentOfSellable)} tone={results.salesMix.allocatedPercentOfSellable >= 80 || form.saleMode === "PER_SQM" ? "success" : "default"} />
              </div>
            </WorkflowStep>

            <WorkflowStep
              step="Step 4"
              title="Compare outright vs installment pricing"
              description="Use this to decide the minimum commercial stance for cash buyers versus slower recovery through installment plans."
            >
              <div className="rounded-[24px] border border-[var(--line)] bg-[var(--sand-50)] p-5">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <SelectField
                    label="Payment mode"
                    value={form.paymentMode}
                    onChange={(value) => updateField("paymentMode", value as DevelopmentCalculationInput["paymentMode"])}
                    options={[
                      ["OUTRIGHT", "Outright"],
                      ["INSTALLMENT", "Installment"],
                    ]}
                    helper="Use installment when your go-to-market plan needs time-based affordability."
                  />
                  {form.paymentMode === "INSTALLMENT" ? (
                    <>
                      <Field label="Installment tenure (months)" helper="How long buyers are allowed to spread payments.">
                        <Input
                          type="number"
                          value={form.installmentTenureMonths ?? 12}
                          onChange={(event) => updateField("installmentTenureMonths", Number(event.target.value || 0))}
                        />
                      </Field>
                      <PercentField
                        label="Installment premium"
                        helper="Additional price uplift required for slower cash recovery."
                        value={form.installmentPremiumRate ?? 0}
                        onChange={(value) => updateField("installmentPremiumRate", value)}
                      />
                      <ToggleField
                        label="Inflation-adjust installment pricing"
                        description="Adds time-value uplift using the annual inflation assumption and installment tenure."
                        checked={form.useInflationAdjustedInstallmentPricing}
                        onChange={(checked) => updateField("useInflationAdjustedInstallmentPricing", checked)}
                      />
                    </>
                  ) : (
                    <div className="md:col-span-3 rounded-[20px] border border-dashed border-[var(--line)] bg-white px-4 py-3 text-sm leading-6 text-[var(--ink-600)]">
                      Outright mode is active. The installment card remains visible below so pricing committees can still compare a financed headline price if market pressure changes later.
                    </div>
                  )}
                </div>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <CommercialDecisionCard
                  title="Outright"
                  emphasis="Recommended minimum"
                  value={formatCurrency(results.pricing.outrightRecommendedPricePerSqm, form.currency)}
                  detail="Use this when you want the cleanest cash recovery and the simplest headline offer."
                  footer={`Projected revenue at this rate: ${formatCurrency(results.pricing.outrightRecommendedRevenue, form.currency)}`}
                  tone="accent"
                />
                <CommercialDecisionCard
                  title="Installment"
                  emphasis="Recommended minimum"
                  value={formatCurrency(results.pricing.installmentRecommendedPricePerSqm, form.currency)}
                  detail="Use this when the market needs time-based affordability, but the project still needs margin protection."
                  footer={`Uplift over outright: ${formatCurrency(installmentPriceUplift, form.currency)} per sqm - ${formatPercent(results.pricing.installmentPremiumRateApplied)} total uplift`}
                  tone="success"
                />
              </div>
            </WorkflowStep>

            <WorkflowStep
              step="Step 5"
              title="Confirm the commercial outcome"
              description="This is the fast decision layer for management, pricing committees, or investor review."
            >
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <MiniStat label="Sellable sqm" value={formatNumber(results.area.sellableSqm)} tone="success" />
                <MiniStat label="Allocated sqm" value={formatNumber(results.salesMix.allocatedSqm)} />
                <MiniStat label="Unallocated sqm" value={formatNumber(salesMixUnallocatedSqm)} />
                <MiniStat label="Outright recommendation" value={formatCurrency(results.pricing.outrightRecommendedPricePerSqm, form.currency)} />
                <MiniStat label="Installment recommendation" value={formatCurrency(results.pricing.installmentRecommendedPricePerSqm, form.currency)} />
              </div>
            </WorkflowStep>
          </div>
        </SectionContainer>
        ) : null}

        {activeModelSection === "PHASING" ? (
        <SectionContainer
          eyebrow="Timing"
          title="Phased planning and cashflow forecast"
          description="Turn the static feasibility into a release plan. Allocate delivery and sell-through across phases so the funding gap, payback timing, and timing risk become visible."
          collapsible
          defaultOpen={workspaceMode === "ADVANCED"}
        >
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[26px] border border-[var(--line)] bg-[var(--sand-50)] p-5">
              <div>
                <h3 className="text-lg font-semibold text-[var(--ink-950)]">Phase plan</h3>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--ink-600)]">
                  Leave phases empty to use one whole-project timing view, or apply a rollout template and refine it for funding and release planning.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => applyPhaseTemplate(2)}>
                  2-phase template
                </Button>
                <Button variant="outline" onClick={() => applyPhaseTemplate(3)}>
                  3-phase template
                </Button>
                <Button variant="outline" onClick={() => applyPhaseTemplate(4)}>
                  4-phase template
                </Button>
                <Button variant="outline" onClick={addPhase}>
                  Add phase
                </Button>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <MiniStat
                label="Development share planned"
                value={formatPercent(results.phasing.totalDevelopmentCostShare)}
                tone={results.phasing.totalDevelopmentCostShare >= 100 ? "success" : "default"}
              />
              <MiniStat
                label="Inventory share planned"
                value={formatPercent(results.phasing.totalSellableInventoryShare)}
                tone={results.phasing.totalSellableInventoryShare >= 100 ? "success" : "default"}
              />
              <MiniStat
                label="Sell-through modelled"
                value={formatPercent(results.phasing.realizedSellThroughShare)}
              />
              <MiniStat
                label="Peak funding gap"
                value={formatCurrency(results.phasing.peakFundingGap, form.currency)}
                tone={results.phasing.peakFundingGap > 0 ? "default" : "success"}
              />
              <MiniStat
                label="Payback"
                value={
                  results.phasing.paybackMonth != null
                    ? `Month ${results.phasing.paybackMonth}`
                    : "Not recovered"
                }
                tone={results.phasing.paybackMonth != null ? "success" : "default"}
              />
            </div>

            {form.phases.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-[var(--line)] bg-white px-5 py-4 text-sm leading-6 text-[var(--ink-600)]">
                No custom phases yet. The forecast is currently using one whole-project phase derived from the saved feasibility assumptions.
              </div>
            ) : (
              <div className="space-y-3">
                {form.phases.map((phase, index) => (
                  <div key={phase.id ?? `${phase.name}-${index}`} className="rounded-[24px] border border-[var(--line)] p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-[var(--ink-950)]">{phase.name || `Phase ${index + 1}`}</div>
                        <div className="mt-1 text-xs text-[var(--ink-500)]">
                          Starts month {phase.startMonthOffset + 1} and runs for {phase.durationMonths} months
                        </div>
                      </div>
                      <Button variant="outline" onClick={() => removePhase(index)} disabled={form.phases.length <= 1}>
                        Remove
                      </Button>
                    </div>
                    <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <Field label="Phase name" helper="Use a release or delivery label that stakeholders recognise.">
                        <Input
                          value={phase.name}
                          onChange={(event) => updatePhase(index, { name: event.target.value })}
                        />
                      </Field>
                      <Field label="Start month offset" helper="Month counting starts from project month 1.">
                        <Input
                          type="number"
                          value={phase.startMonthOffset}
                          onChange={(event) => updatePhase(index, { startMonthOffset: Number(event.target.value || 0) })}
                        />
                      </Field>
                      <Field label="Duration (months)" helper="Use one window for delivery and sales activity in this phase.">
                        <Input
                          type="number"
                          value={phase.durationMonths}
                          onChange={(event) => updatePhase(index, { durationMonths: Number(event.target.value || 0) })}
                        />
                      </Field>
                      <PercentField
                        label="Development cost share"
                        helper="How much of delivery outflow lands in this phase."
                        value={phase.developmentCostShare}
                        onChange={(value) => updatePhase(index, { developmentCostShare: value })}
                      />
                      <PercentField
                        label="Sellable inventory share"
                        helper="How much of the sellable estate is released in this phase."
                        value={phase.sellableInventoryShare}
                        onChange={(value) => updatePhase(index, { sellableInventoryShare: value })}
                      />
                      <PercentField
                        label="Sell-through assumption"
                        helper="What share of released inventory is expected to convert in this phase."
                        value={phase.salesVelocityRate}
                        onChange={(value) => updatePhase(index, { salesVelocityRate: value })}
                      />
                      <Field label="Price override / sqm" helper="Optional fixed phase price if this release has a distinct market rate.">
                        <Input
                          type="number"
                          value={phase.sellingPriceOverridePerSqm ?? 0}
                          onChange={(event) => updatePhase(index, { sellingPriceOverridePerSqm: Number(event.target.value || 0) || undefined })}
                        />
                      </Field>
                      <Field label="Price uplift %" helper="Optional premium or discount on top of the baseline price path.">
                        <Input
                          type="number"
                          value={phase.sellingPriceUpliftRate ?? 0}
                          onChange={(event) => updatePhase(index, { sellingPriceUpliftRate: Number(event.target.value || 0) })}
                        />
                      </Field>
                    </div>
                    <div className="mt-4">
                      <Field label="Phase notes" helper="Optional internal notes on release intent, approvals, or delivery dependencies.">
                        <Textarea
                          value={phase.notes ?? ""}
                          onChange={(event) => updatePhase(index, { notes: event.target.value })}
                          placeholder="Optional delivery, approvals, pricing, or market notes..."
                        />
                      </Field>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {phaseDevelopmentGap > 0 || phaseInventoryGap > 0 || timingWarnings.length > 0 ? (
              <div className="space-y-3">
                {phaseDevelopmentGap > 0 ? (
                  <WarningCard
                    tone="caution"
                    message={`Development timing covers ${formatPercent(results.phasing.totalDevelopmentCostShare)} of project delivery cost. The remaining ${formatPercent(phaseDevelopmentGap)} is pushed into the final phase for forecast continuity.`}
                  />
                ) : null}
                {phaseInventoryGap > 0 ? (
                  <WarningCard
                    tone="caution"
                    message={`Inventory timing covers ${formatPercent(results.phasing.totalSellableInventoryShare)} of sellable land. The remaining ${formatPercent(phaseInventoryGap)} is pushed into the final phase for the timing model.`}
                  />
                ) : null}
                {timingWarnings.map((warning) => (
                  <WarningCard key={`timing-${warning}`} tone="caution" message={warning} />
                ))}
              </div>
            ) : null}

            <div className="grid gap-4">
              <PhasingVisualAnalytics
                results={results}
                currency={form.currency}
                viewMode={forecastView}
                onViewModeChange={setForecastView}
                compact
              />
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
              <div className="rounded-[24px] border border-[var(--line)] overflow-hidden">
                <div className="border-b border-[var(--line)] bg-[var(--sand-50)] px-5 py-4">
                  <div className="text-sm font-semibold text-[var(--ink-950)]">Phase-by-phase summary</div>
                  <div className="mt-1 text-xs leading-5 text-[var(--ink-500)]">
                    Outflow and inflow are shifted by phase timing, price growth, and sell-through assumptions.
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="border-b border-[var(--line)] bg-white text-left text-[var(--ink-500)]">
                      <tr>
                        <th className="px-3 py-3 font-medium">Phase</th>
                        <th className="px-3 py-3 font-medium">Window</th>
                        <th className="px-3 py-3 font-medium">Revenue</th>
                        <th className="px-3 py-3 font-medium">Outflow</th>
                        <th className="px-3 py-3 font-medium">Net cash</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--line)]">
                      {results.phasing.phases.map((phase) => (
                        <tr key={`phase-summary-${phase.name}-${phase.startMonthOffset}`}>
                          <td className="px-3 py-4">
                            <div className="font-medium text-[var(--ink-900)]">{phase.name}</div>
                            <div className="mt-1 text-xs text-[var(--ink-500)]">
                              {formatPercent(phase.sellableInventoryShare)} inventory - {formatPercent(phase.salesVelocityRate)} sell-through
                            </div>
                          </td>
                          <td className="px-3 py-4 text-[var(--ink-700)]">
                            Month {phase.startMonthOffset + 1} to {phase.endMonthOffset}
                          </td>
                          <td className="px-3 py-4 text-[var(--ink-700)]">{formatCurrency(phase.phaseRevenue, form.currency)}</td>
                          <td className="px-3 py-4 text-[var(--ink-700)]">{formatCurrency(phase.phaseOutflow, form.currency)}</td>
                          <td className={cn("px-3 py-4", phase.phaseNetCash >= 0 ? "text-emerald-700" : "text-rose-700")}>
                            {formatCurrency(phase.phaseNetCash, form.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-[24px] border border-[var(--line)] overflow-hidden">
                <div className="border-b border-[var(--line)] bg-[var(--sand-50)] px-5 py-4">
                  <div className="text-sm font-semibold text-[var(--ink-950)]">Cashflow forecast</div>
                  <div className="mt-1 text-xs leading-5 text-[var(--ink-500)]">
                    Month-level timing view showing when cash goes out, when revenue comes back, and how deep the funding gap gets.
                  </div>
                </div>
                <div className="max-h-[420px] overflow-auto">
                  <table className="min-w-full text-sm">
                    <thead className="sticky top-0 border-b border-[var(--line)] bg-white text-left text-[var(--ink-500)]">
                      <tr>
                        <th className="px-3 py-3 font-medium">Month</th>
                        <th className="px-3 py-3 font-medium">Outflow</th>
                        <th className="px-3 py-3 font-medium">Inflow</th>
                        <th className="px-3 py-3 font-medium">Net</th>
                        <th className="px-3 py-3 font-medium">Cumulative</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--line)]">
                      {results.phasing.monthlyForecast.map((entry) => (
                        <tr key={`month-${entry.month}`}>
                          <td className="px-3 py-4 font-medium text-[var(--ink-900)]">{entry.label}</td>
                          <td className="px-3 py-4 text-[var(--ink-700)]">{formatCurrency(entry.outflow, form.currency)}</td>
                          <td className="px-3 py-4 text-[var(--ink-700)]">{formatCurrency(entry.inflow, form.currency)}</td>
                          <td className={cn("px-3 py-4", entry.netCash >= 0 ? "text-emerald-700" : "text-rose-700")}>
                            {formatCurrency(entry.netCash, form.currency)}
                          </td>
                          <td className={cn("px-3 py-4 font-medium", entry.cumulativeCash >= 0 ? "text-emerald-700" : "text-rose-700")}>
                            {formatCurrency(entry.cumulativeCash, form.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </SectionContainer>
        ) : null}
          </>
        ) : (
          <Card className="rounded-[32px] p-8">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ink-500)]">
              Advanced controls hidden
            </div>
            <h2 className="mt-2 text-2xl font-semibold text-[var(--ink-950)]">
              Quick Start is active
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--ink-600)]">
              The model is using the active preset to fill land utilization, cost assumptions, pricing growth, and phasing. Switch to full mode when you want to fine-tune detailed inputs.
            </p>
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <SummaryMetric label="Preset" value={activePresetDefinition?.label ?? "Custom"} tone="accent" />
              <SummaryMetric label="Recommended minimum / sqm" value={formatCurrency(results.revenue.minimumSellingPricePerSqm, form.currency)} />
              <SummaryMetric label="Peak funding gap" value={formatCurrency(results.phasing.peakFundingGap, form.currency)} tone={results.phasing.peakFundingGap > 0 ? "danger" : "success"} />
              <SummaryMetric label="Payback" value={results.phasing.paybackMonth != null ? `Month ${results.phasing.paybackMonth}` : "Not recovered"} tone={results.phasing.paybackMonth != null ? "success" : "danger"} />
            </div>
          </Card>
        )}
          </>
        ) : null}

        {activeTab === "INSIGHTS" ? (
          <>
            <SectionContainer
              eyebrow="Insights"
              title="Scenario analysis"
              description="Stress-test the project against delivery delays, price softness, and upside scenarios before you commit to market pricing."
              collapsible
              defaultOpen={workspaceMode !== "SIMPLE"}
            >
              <ScenarioMatrix scenarios={results.scenarios} currency={form.currency} />
            </SectionContainer>

            <RecommendationsPanel
              title="Guided recommendations"
              description="Actionable next steps derived from pricing cushion, land efficiency, cost pressure, timing, and downside resilience."
              bundle={recommendationBundle}
              onSelectLever={(lever) => setFocusedQuickAdjust(mapLeverToQuickAdjust(lever))}
            />

            <QuickAdjustPanel
              currency={form.currency}
              currentInput={form}
              currentResult={results}
              baselineResult={lastAdjustmentBaseline}
              snapshots={sensitivitySnapshots}
              mostSensitiveVariable={mostSensitiveVariable?.label ?? null}
              leastSensitiveVariable={leastSensitiveVariable?.label ?? null}
              focusedQuickAdjust={focusedQuickAdjust}
              showAllControls={showAllQuickAdjusts}
              onToggleAllControls={() => setShowAllQuickAdjusts((current) => !current)}
              onAdjust={handleQuickAdjust}
              onReset={resetAdjustments}
              biggestLevers={recommendationBundle.biggestLevers.map((lever) => ({
                ...lever,
                quickAdjustKey: mapLeverToQuickAdjust(lever.label),
              }))}
            />

            {results.warnings.length > 0 ? (
              <Card className="rounded-[30px] p-5">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ink-500)]">
                  Feasibility warnings
                </div>
                <p className="mt-2 text-sm leading-6 text-[var(--ink-600)]">
                  These assumptions most affect pricing credibility, investor confidence, or go-to-market readiness.
                </p>
                <div className="mt-4 space-y-3">
                  {activeWarnings.map((warning) => (
                    <WarningCard key={warning} tone="danger" message={warning} />
                  ))}
                  {cautionWarnings.map((warning) => (
                    <WarningCard key={warning} tone="caution" message={warning} />
                  ))}
                </div>
              </Card>
            ) : null}
          </>
        ) : null}
          </>
        )}
      </div>


    </div>
  );
}

export function InvestorReportView({
  form,
  results,
  pricingNarrative,
  allocationNarrative,
  marginNarrative,
  salesMixUnallocatedSqm,
  installmentPriceUplift,
  activeWarnings,
  cautionWarnings,
  createdAt,
  updatedAt,
  recommendationBundle,
}: {
  form: DevelopmentCalculationInput;
  results: ReturnType<typeof calculateDevelopmentFeasibility>;
  pricingNarrative: string;
  allocationNarrative: string;
  marginNarrative: string;
  salesMixUnallocatedSqm: number;
  installmentPriceUplift: number;
  activeWarnings: string[];
  cautionWarnings: string[];
  createdAt: string | null;
  updatedAt: string | null;
  recommendationBundle: CalculatorRecommendationBundle;
}) {
  return (
    <div className="space-y-6 print:space-y-4">
      <Card className="rounded-[32px] p-8 print:shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ink-500)]">
              Executive summary
            </div>
            <h2 className="mt-3 font-serif text-4xl leading-tight text-[var(--ink-950)]">
              {form.projectName}
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--ink-600)]">
              {form.location || "Location to be confirmed"} - investor-facing feasibility view based on the current saved assumptions, pricing stance, and delivery cost model.
            </p>
          </div>
          <div className="rounded-[24px] border border-[var(--line)] bg-[var(--sand-50)] px-5 py-4 text-sm text-[var(--ink-600)]">
            <div>Created: {createdAt ? new Date(createdAt).toLocaleDateString("en-NG") : "Draft"}</div>
            <div className="mt-1">Last updated: {updatedAt ? new Date(updatedAt).toLocaleDateString("en-NG") : "Draft"}</div>
          </div>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <ReportMetric label="Gross land sqm" value={formatNumber(results.area.grossSqm)} />
          <ReportMetric label="Sellable sqm" value={formatNumber(results.area.sellableSqm)} tone="success" />
          <ReportMetric label="Adjusted total cost" value={formatCurrency(results.costs.adjustedTotalCost, form.currency)} />
          <ReportMetric label="ROI" value={formatPercent(results.revenue.roiPercent)} tone={results.revenue.roiPercent >= 0 ? "success" : "danger"} />
          <ReportMetric label="Break-even price" value={formatCurrency(results.revenue.breakevenPricePerSqm, form.currency)} />
          <ReportMetric label="Recommended minimum price" value={formatCurrency(results.revenue.minimumSellingPricePerSqm, form.currency)} tone="accent" />
          <ReportMetric label="Estimated revenue" value={formatCurrency(results.revenue.estimatedRevenue, form.currency)} />
          <ReportMetric label="Estimated profit" value={formatCurrency(results.revenue.estimatedGrossProfit, form.currency)} tone={results.revenue.estimatedGrossProfit >= 0 ? "success" : "danger"} />
        </div>
      </Card>

      <ReportSection
        title="Project Overview"
        description="Commercial position, pricing interpretation, and management-level reading of the current feasibility result."
      >
        <div className="grid gap-4 lg:grid-cols-3">
          <NarrativeCard title="Pricing interpretation" body={pricingNarrative} />
          <NarrativeCard title="Land allocation realism" body={allocationNarrative} />
          <NarrativeCard title="Margin posture" body={marginNarrative} />
        </div>
      </ReportSection>

      <ReportSection
        title="Land Utilization Summary"
        description="Shows how much of the site becomes saleable after infrastructure and shared-use deductions."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <ReportMetric label="Gross land sqm" value={formatNumber(results.area.grossSqm)} />
          <ReportMetric label="Reserved land sqm" value={formatNumber(results.area.reservedSqm)} />
          <ReportMetric label="Reserved land %" value={formatPercent(results.area.reservedPercentage)} />
          <ReportMetric label="Net sellable sqm" value={formatNumber(results.area.sellableSqm)} tone="success" />
        </div>
      </ReportSection>

      <ReportSection
        title="Cost Stack"
        description="Adjusted delivery cost stack used to derive break-even and minimum defendable pricing."
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3 rounded-[24px] border border-[var(--line)] bg-white p-5">
            <ReportLine label="Land acquisition" value={results.costs.landAcquisitionCost} currency={form.currency} />
            <ReportLine label="Base development cost" value={results.costs.totalDevelopmentCost} currency={form.currency} />
            <ReportLine label="Base operating cost" value={results.costs.totalOperatingCost} currency={form.currency} />
            <ReportLine label="Escalated development cost" value={results.costs.escalatedDevelopmentCost} currency={form.currency} />
            <ReportLine label="Inflation-adjusted operating cost" value={results.costs.inflationAdjustedOperatingCost} currency={form.currency} />
            <ReportLine label="Risk provision" value={results.costs.riskProvisionCost} currency={form.currency} />
            <ReportLine label="Financing cost" value={results.costs.financingCost} currency={form.currency} />
          </div>
          <div className="space-y-3 rounded-[24px] border border-[var(--line)] bg-[var(--sand-50)] p-5">
            <ReportLine label="Total project cost" value={results.costs.totalProjectCost} currency={form.currency} />
            <ReportLine label="Adjusted total cost" value={results.costs.adjustedTotalCost} currency={form.currency} emphasis />
            <ReportLine label="Cost per sellable sqm" value={results.costs.costPerSellableSqm} currency={form.currency} />
          </div>
        </div>
      </ReportSection>

      <ReportSection
        title="Pricing Recommendation"
        description="Minimum pricing view based on adjusted cost, land efficiency, and target margin assumptions."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <ReportMetric label="Break-even / sqm" value={formatCurrency(results.revenue.breakevenPricePerSqm, form.currency)} />
          <ReportMetric label="Recommended minimum / sqm" value={formatCurrency(results.revenue.minimumSellingPricePerSqm, form.currency)} tone="accent" />
          <ReportMetric label="Current effective sell price / sqm" value={formatCurrency(results.revenue.effectiveSellingPricePerSqm, form.currency)} tone={results.revenue.effectiveSellingPricePerSqm >= results.revenue.breakevenPricePerSqm ? "success" : "danger"} />
        </div>
      </ReportSection>

      <ReportSection
        title="Revenue and Profitability"
        description="Top-line and return outlook at the current commercial assumptions."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <ReportMetric label="Estimated revenue" value={formatCurrency(results.revenue.estimatedRevenue, form.currency)} />
          <ReportMetric label="Estimated profit" value={formatCurrency(results.revenue.estimatedGrossProfit, form.currency)} tone={results.revenue.estimatedGrossProfit >= 0 ? "success" : "danger"} />
          <ReportMetric label="ROI" value={formatPercent(results.revenue.roiPercent)} tone={results.revenue.roiPercent >= 0 ? "success" : "danger"} />
          <ReportMetric label="Margin" value={formatPercent(results.revenue.marginPercent)} />
        </div>
      </ReportSection>

      <ReportSection
        title="Outright vs Installment Comparison"
        description="Use this to compare a clean cash-recovery headline price versus a time-value adjusted financed offer."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <CommercialDecisionCard
            title="Outright"
            emphasis="Recommended minimum"
            value={formatCurrency(results.pricing.outrightRecommendedPricePerSqm, form.currency)}
            detail="Clean cash recovery benchmark for management approval and immediate market quoting."
            footer={`Recommended revenue: ${formatCurrency(results.pricing.outrightRecommendedRevenue, form.currency)}`}
            tone="accent"
          />
          <CommercialDecisionCard
            title="Installment"
            emphasis="Recommended minimum"
            value={formatCurrency(results.pricing.installmentRecommendedPricePerSqm, form.currency)}
            detail="Time-value adjusted headline price when affordability requires a longer buyer payment cycle."
            footer={`Uplift over outright: ${formatCurrency(installmentPriceUplift, form.currency)} per sqm - ${formatPercent(results.pricing.installmentPremiumRateApplied)} total uplift`}
            tone="success"
          />
        </div>
      </ReportSection>

      <ReportSection
        title="Phase Plan"
        description="Timing plan for delivery outflow, sellable inventory release, and commercial recovery."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <ReportMetric label="Development share planned" value={formatPercent(results.phasing.totalDevelopmentCostShare)} />
          <ReportMetric label="Inventory share planned" value={formatPercent(results.phasing.totalSellableInventoryShare)} />
          <ReportMetric label="Sell-through modelled" value={formatPercent(results.phasing.realizedSellThroughShare)} />
          <ReportMetric label="Payback" value={results.phasing.paybackMonth != null ? `Month ${results.phasing.paybackMonth}` : "Not recovered"} tone={results.phasing.paybackMonth != null ? "success" : "danger"} />
        </div>
        <div className="overflow-x-auto rounded-[24px] border border-[var(--line)]">
          <table className="min-w-full text-sm">
            <thead className="border-b border-[var(--line)] bg-[var(--sand-50)] text-left text-[var(--ink-500)]">
              <tr>
                <th className="px-3 py-3 font-medium">Phase</th>
                <th className="px-3 py-3 font-medium">Window</th>
                <th className="px-3 py-3 font-medium">Development share</th>
                <th className="px-3 py-3 font-medium">Inventory share</th>
                <th className="px-3 py-3 font-medium">Sell-through</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {results.phasing.phases.map((phase) => (
                <tr key={`report-phase-${phase.name}-${phase.startMonthOffset}`}>
                  <td className="px-3 py-4">
                    <div className="font-medium text-[var(--ink-900)]">{phase.name}</div>
                    {phase.notes ? <div className="mt-1 text-xs text-[var(--ink-500)]">{phase.notes}</div> : null}
                  </td>
                  <td className="px-3 py-4 text-[var(--ink-700)]">Month {phase.startMonthOffset + 1} to {phase.endMonthOffset}</td>
                  <td className="px-3 py-4 text-[var(--ink-700)]">{formatPercent(phase.developmentCostShare)}</td>
                  <td className="px-3 py-4 text-[var(--ink-700)]">{formatPercent(phase.sellableInventoryShare)}</td>
                  <td className="px-3 py-4 text-[var(--ink-700)]">{formatPercent(phase.salesVelocityRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ReportSection>

      <ReportSection
        title="Cashflow Forecast"
        description="Timing-aware view of outflow, inflow, cumulative cash exposure, and funding pressure."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <ReportMetric label="Peak funding gap" value={formatCurrency(results.phasing.peakFundingGap, form.currency)} tone={results.phasing.peakFundingGap > 0 ? "danger" : "success"} />
          <ReportMetric label="Cash low point" value={formatCurrency(results.phasing.cumulativeCashLowPoint, form.currency)} tone={results.phasing.cumulativeCashLowPoint < 0 ? "danger" : "success"} />
          <ReportMetric label="Revenue by phase" value={formatCurrency(results.phasing.revenueByPhase, form.currency)} />
          <ReportMetric label="Realized margin" value={formatPercent(results.phasing.realizedMarginPercent)} tone={results.phasing.realizedMarginPercent >= 0 ? "success" : "danger"} />
        </div>
        <PhasingVisualAnalytics results={results} currency={form.currency} reportMode />
        <div className="overflow-x-auto rounded-[24px] border border-[var(--line)]">
          <table className="min-w-full text-sm">
            <thead className="border-b border-[var(--line)] bg-[var(--sand-50)] text-left text-[var(--ink-500)]">
              <tr>
                <th className="px-3 py-3 font-medium">Month</th>
                <th className="px-3 py-3 font-medium">Outflow</th>
                <th className="px-3 py-3 font-medium">Inflow</th>
                <th className="px-3 py-3 font-medium">Net cash</th>
                <th className="px-3 py-3 font-medium">Cumulative cash</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {results.phasing.monthlyForecast.map((entry) => (
                <tr key={`report-month-${entry.month}`}>
                  <td className="px-3 py-4 font-medium text-[var(--ink-900)]">{entry.label}</td>
                  <td className="px-3 py-4 text-[var(--ink-700)]">{formatCurrency(entry.outflow, form.currency)}</td>
                  <td className="px-3 py-4 text-[var(--ink-700)]">{formatCurrency(entry.inflow, form.currency)}</td>
                  <td className={cn("px-3 py-4", entry.netCash >= 0 ? "text-emerald-700" : "text-rose-700")}>{formatCurrency(entry.netCash, form.currency)}</td>
                  <td className={cn("px-3 py-4", entry.cumulativeCash >= 0 ? "text-emerald-700" : "text-rose-700")}>{formatCurrency(entry.cumulativeCash, form.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ReportSection>

      <ReportSection
        title="Phase-by-Phase Summary"
        description="How each release window contributes cost, revenue, liquidity, and pricing progression."
      >
        <div className="overflow-x-auto rounded-[24px] border border-[var(--line)]">
          <table className="min-w-full text-sm">
            <thead className="border-b border-[var(--line)] bg-[var(--sand-50)] text-left text-[var(--ink-500)]">
              <tr>
                <th className="px-3 py-3 font-medium">Phase</th>
                <th className="px-3 py-3 font-medium">Price / sqm</th>
                <th className="px-3 py-3 font-medium">Revenue</th>
                <th className="px-3 py-3 font-medium">Outflow</th>
                <th className="px-3 py-3 font-medium">Net cash</th>
                <th className="px-3 py-3 font-medium">Cumulative</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {results.phasing.phases.map((phase) => (
                <tr key={`report-phase-summary-${phase.name}-${phase.startMonthOffset}`}>
                  <td className="px-3 py-4 font-medium text-[var(--ink-900)]">{phase.name}</td>
                  <td className="px-3 py-4 text-[var(--ink-700)]">{formatCurrency(phase.phasePricePerSqm, form.currency)}</td>
                  <td className="px-3 py-4 text-[var(--ink-700)]">{formatCurrency(phase.phaseRevenue, form.currency)}</td>
                  <td className="px-3 py-4 text-[var(--ink-700)]">{formatCurrency(phase.phaseOutflow, form.currency)}</td>
                  <td className={cn("px-3 py-4", phase.phaseNetCash >= 0 ? "text-emerald-700" : "text-rose-700")}>{formatCurrency(phase.phaseNetCash, form.currency)}</td>
                  <td className={cn("px-3 py-4", phase.cumulativeCash >= 0 ? "text-emerald-700" : "text-rose-700")}>{formatCurrency(phase.cumulativeCash, form.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ReportSection>

      <ReportSection
        title="Timing Risks"
        description="Where timing assumptions weaken liquidity, delay payback, or create a larger funding requirement."
      >
        <div className="space-y-3">
          {results.phasing.timingWarnings.length === 0 ? (
            <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm leading-6 text-emerald-900">
              No extra timing risk warnings are active in the phased forecast.
            </div>
          ) : (
            results.phasing.timingWarnings.map((warning) => (
              <WarningCard key={`report-timing-${warning}`} tone="caution" message={warning} />
            ))
          )}
        </div>
      </ReportSection>

      <ReportSection
        title="Recommendations"
        description="Prioritized management guidance derived from pricing cushion, land efficiency, liquidity pressure, timing, and downside resilience."
      >
        <RecommendationsPanel
          title="What to do next"
          description="Use these to focus the next modelling or commercial decisions."
          bundle={recommendationBundle}
          reportMode
        />
      </ReportSection>

      <ReportSection
        title="Scenario Analysis"
        description="Range view for cost pressure, pricing strength, and execution timing."
      >
        <div className="grid gap-4 lg:grid-cols-3">
          {results.scenarios.map((scenario) => (
            <ScenarioCard key={`report-${scenario.key}`} scenario={scenario} currency={form.currency} />
          ))}
        </div>
      </ReportSection>

      <ReportSection
        title="Key Risks / Warnings"
        description="Decision-oriented flags that can materially affect pricing credibility, investor confidence, or delivery performance."
      >
        <div className="space-y-3">
          {activeWarnings.length === 0 && cautionWarnings.length === 0 ? (
            <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm leading-6 text-emerald-900">
              No critical feasibility warnings are currently active in this report view.
            </div>
          ) : null}
          {activeWarnings.map((warning) => (
            <WarningCard key={`report-danger-${warning}`} tone="danger" message={warning} />
          ))}
          {cautionWarnings.map((warning) => (
            <WarningCard key={`report-caution-${warning}`} tone="caution" message={warning} />
          ))}
          {form.saleMode !== "PER_SQM" ? (
            <NarrativeCard
              title="Commercial coverage note"
              body={
                salesMixUnallocatedSqm > 0
                  ? `The current sales mix still leaves ${formatNumber(salesMixUnallocatedSqm)} sqm unallocated, so the revenue model should be treated as conservative until that inventory is mapped.`
                  : "The current sales mix covers the sellable estate cleanly."
              }
            />
          ) : null}
        </div>
      </ReportSection>
    </div>
  );
}

function ComparisonWorkspace({
  calculations,
  activeCalculationId,
  comparisonCandidates,
  comparisonSelection,
  comparisonLoading,
  onToggleSaved,
  presetComparisonKeys,
  onTogglePreset,
  currentPresetKey,
  currency,
  comparisonRecommendationBundle,
}: {
  calculations: DevelopmentCalculationListItem[];
  activeCalculationId: string | null;
  comparisonCandidates: ComparisonCandidate[];
  comparisonSelection: string[];
  comparisonLoading: string | null;
  onToggleSaved: (id: string) => void;
  presetComparisonKeys: DevelopmentPresetKey[];
  onTogglePreset: (key: DevelopmentPresetKey) => void;
  currentPresetKey: DevelopmentPresetKey | null;
  currency: string;
  comparisonRecommendationBundle: { recommendations: ComparisonRecommendation[] };
}) {
  const readyCandidates = comparisonCandidates.filter(Boolean);
  const hasEnoughCandidates = readyCandidates.length >= 2;
  const comparisonSummary = useMemo(
    () => buildComparisonSummary(readyCandidates),
    [readyCandidates],
  );

  return (
    <div className="space-y-6">
      <SectionContainer
        eyebrow="Comparison"
        title="Compare development options side by side"
        description="Move from modelling to decision-making. Compare saved cases, preset variants, and the current working model on profitability, liquidity, timing, and delivery efficiency."
        badge={`${Math.max(readyCandidates.length, 1)} options`}
      >
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="rounded-[26px] border border-[var(--line)] bg-[var(--sand-50)] p-5">
            <div className="text-sm font-semibold text-[var(--ink-950)]">Choose saved calculations</div>
            <p className="mt-1 text-sm leading-6 text-[var(--ink-600)]">
              Pick up to three saved calculations to compare against the current model.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {calculations
                .filter((item) => item.id !== activeCalculationId)
                .map((item) => (
                  <button
                    key={`compare-${item.id}`}
                    type="button"
                    onClick={() => onToggleSaved(item.id)}
                    className={cn(
                      "rounded-[22px] border px-4 py-4 text-left transition",
                      comparisonSelection.includes(item.id)
                        ? "border-[var(--brand-500)]/35 bg-white shadow-[0_10px_24px_rgba(15,23,42,0.05)]"
                        : "border-[var(--line)] bg-white",
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-[var(--ink-950)]">{item.projectName}</div>
                      <StatusChip
                        label={comparisonSelection.includes(item.id) ? "Selected" : "Available"}
                        tone={comparisonSelection.includes(item.id) ? "success" : "default"}
                      />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <StatusChip
                        label={item.versionLabel ? `${item.versionLabel} - V${item.versionNumber}` : `Version ${item.versionNumber}`}
                      />
                      {item.sourcePresetKey ? (
                        <StatusChip label={item.sourcePresetKey.replaceAll("_", " ")} />
                      ) : null}
                    </div>
                    <div className="mt-2 text-xs text-[var(--ink-500)]">
                      {item.location || "No location"} - ROI {formatPercent(item.roiPercent)}
                    </div>
                    {comparisonLoading === item.id ? (
                      <div className="mt-2 text-xs text-[var(--ink-500)]">Loading comparison...</div>
                    ) : null}
                  </button>
                ))}
            </div>
          </div>

          <div className="rounded-[26px] border border-[var(--line)] bg-white p-5">
            <div className="text-sm font-semibold text-[var(--ink-950)]">Preset variants</div>
            <p className="mt-1 text-sm leading-6 text-[var(--ink-600)]">
              Add preset-driven variants of the current project to compare alternate modeling approaches without saving duplicate records.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {DEVELOPMENT_PRESETS.map((preset) => (
                <PresetTile
                  key={`preset-compare-${preset.key}`}
                  preset={preset}
                  active={presetComparisonKeys.includes(preset.key)}
                  statusLabel={
                    presetComparisonKeys.includes(preset.key)
                      ? "Included"
                      : currentPresetKey === preset.key
                        ? "Current"
                        : "Variant"
                  }
                  onSelect={() => onTogglePreset(preset.key)}
                />
              ))}
            </div>
          </div>
        </div>

        {!hasEnoughCandidates ? (
          <div className="rounded-[24px] border border-dashed border-[var(--line)] bg-white px-5 py-5 text-sm leading-6 text-[var(--ink-600)]">
            Select at least one saved calculation or preset variant so Estate OS can compare options against the current model.
          </div>
        ) : (
          <>
            <div className="grid gap-4 lg:grid-cols-3">
              {comparisonSummary.highlights.map((highlight) => (
                <NarrativeCard key={highlight.title} title={highlight.title} body={highlight.body} />
              ))}
            </div>

            <ComparisonRecommendationsPanel
              recommendations={comparisonRecommendationBundle.recommendations}
            />

            <ComparisonSection
              title="Project Overview"
              description="High-level feasibility and timing view."
              candidates={readyCandidates}
              rows={[
                { label: "Gross land sqm", getter: (candidate) => formatNumber(candidate.result.area.grossSqm), sortValue: (candidate) => candidate.result.area.grossSqm, preferred: "higher" },
                { label: "Sellable sqm", getter: (candidate) => formatNumber(candidate.result.area.sellableSqm), sortValue: (candidate) => candidate.result.area.sellableSqm, preferred: "higher" },
                { label: "Peak funding gap", getter: (candidate) => formatCurrency(candidate.result.phasing.peakFundingGap, currency), sortValue: (candidate) => candidate.result.phasing.peakFundingGap, preferred: "lower" },
                { label: "Payback", getter: (candidate) => candidate.result.phasing.paybackMonth != null ? `M${candidate.result.phasing.paybackMonth}${candidate.result.phasing.paybackPhase ? ` - ${candidate.result.phasing.paybackPhase}` : ""}` : "Not recovered", sortValue: (candidate) => candidate.result.phasing.paybackMonth ?? Number.POSITIVE_INFINITY, preferred: "lower" },
              ]}
            />

            <ComparisonSection
              title="Land Utilization"
              description="How efficiently each option converts gross land into saleable inventory."
              candidates={readyCandidates}
              rows={[
                { label: "Reserved land %", getter: (candidate) => formatPercent(candidate.result.area.reservedPercentage), sortValue: (candidate) => candidate.result.area.reservedPercentage, preferred: "lower" },
                { label: "Reserved land sqm", getter: (candidate) => formatNumber(candidate.result.area.reservedSqm), sortValue: (candidate) => candidate.result.area.reservedSqm, preferred: "lower" },
                { label: "Sellable efficiency", getter: (candidate) => formatPercent((candidate.result.area.sellableSqm / Math.max(candidate.result.area.grossSqm, 1)) * 100), sortValue: (candidate) => candidate.result.area.sellableSqm / Math.max(candidate.result.area.grossSqm, 1), preferred: "higher" },
              ]}
            />

            <ComparisonSection
              title="Cost Stack"
              description="Which option is cheaper to deliver and which one carries the heavier adjusted burden."
              candidates={readyCandidates}
              rows={[
                { label: "Adjusted total cost", getter: (candidate) => formatCurrency(candidate.result.costs.adjustedTotalCost, currency), sortValue: (candidate) => candidate.result.costs.adjustedTotalCost, preferred: "lower" },
                { label: "Cost / sellable sqm", getter: (candidate) => formatCurrency(candidate.result.costs.costPerSellableSqm, currency), sortValue: (candidate) => candidate.result.costs.costPerSellableSqm, preferred: "lower" },
                { label: "Risk provision", getter: (candidate) => formatCurrency(candidate.result.costs.riskProvisionCost, currency), sortValue: (candidate) => candidate.result.costs.riskProvisionCost, preferred: "lower" },
                { label: "Financing cost", getter: (candidate) => formatCurrency(candidate.result.costs.financingCost, currency), sortValue: (candidate) => candidate.result.costs.financingCost, preferred: "lower" },
              ]}
            />

            <ComparisonSection
              title="Pricing Recommendation"
              description="Where each option lands on break-even and minimum defendable pricing."
              candidates={readyCandidates}
              rows={[
                { label: "Break-even / sqm", getter: (candidate) => formatCurrency(candidate.result.revenue.breakevenPricePerSqm, currency), sortValue: (candidate) => candidate.result.revenue.breakevenPricePerSqm, preferred: "lower" },
                { label: "Recommended minimum / sqm", getter: (candidate) => formatCurrency(candidate.result.revenue.minimumSellingPricePerSqm, currency), sortValue: (candidate) => candidate.result.revenue.minimumSellingPricePerSqm, preferred: "lower" },
                { label: "Outright recommendation", getter: (candidate) => formatCurrency(candidate.result.pricing.outrightRecommendedPricePerSqm, currency), sortValue: (candidate) => candidate.result.pricing.outrightRecommendedPricePerSqm, preferred: "lower" },
                { label: "Installment recommendation", getter: (candidate) => formatCurrency(candidate.result.pricing.installmentRecommendedPricePerSqm, currency), sortValue: (candidate) => candidate.result.pricing.installmentRecommendedPricePerSqm, preferred: "lower" },
              ]}
            />

            <ComparisonSection
              title="Revenue and Profitability"
              description="Commercial upside versus return quality."
              candidates={readyCandidates}
              rows={[
                { label: "Expected revenue", getter: (candidate) => formatCurrency(candidate.result.revenue.estimatedRevenue, currency), sortValue: (candidate) => candidate.result.revenue.estimatedRevenue, preferred: "higher" },
                { label: "Expected profit", getter: (candidate) => formatCurrency(candidate.result.revenue.estimatedGrossProfit, currency), sortValue: (candidate) => candidate.result.revenue.estimatedGrossProfit, preferred: "higher" },
                { label: "ROI", getter: (candidate) => formatPercent(candidate.result.revenue.roiPercent), sortValue: (candidate) => candidate.result.revenue.roiPercent, preferred: "higher" },
                { label: "Margin", getter: (candidate) => formatPercent(candidate.result.revenue.marginPercent), sortValue: (candidate) => candidate.result.revenue.marginPercent, preferred: "higher" },
              ]}
            />

            <ComparisonSection
              title="Phasing and Cashflow"
              description="Liquidity quality and timing pressure."
              candidates={readyCandidates}
              rows={[
                { label: "Peak funding gap", getter: (candidate) => formatCurrency(candidate.result.phasing.peakFundingGap, currency), sortValue: (candidate) => candidate.result.phasing.peakFundingGap, preferred: "lower" },
                { label: "Cash low point", getter: (candidate) => formatCurrency(candidate.result.phasing.cumulativeCashLowPoint, currency), sortValue: (candidate) => candidate.result.phasing.cumulativeCashLowPoint, preferred: "higher" },
                { label: "Realized margin", getter: (candidate) => formatPercent(candidate.result.phasing.realizedMarginPercent), sortValue: (candidate) => candidate.result.phasing.realizedMarginPercent, preferred: "higher" },
                { label: "Payback month", getter: (candidate) => candidate.result.phasing.paybackMonth != null ? `M${candidate.result.phasing.paybackMonth}` : "Not recovered", sortValue: (candidate) => candidate.result.phasing.paybackMonth ?? Number.POSITIVE_INFINITY, preferred: "lower" },
              ]}
            />

            <ComparisonSection
              title="Scenario Summary"
              description="Base, best, and worst-case resilience."
              candidates={readyCandidates}
              rows={[
                { label: "Best-case ROI", getter: (candidate) => formatPercent(candidate.result.scenarios.find((item) => item.key === "BEST")?.roiPercent ?? 0), sortValue: (candidate) => candidate.result.scenarios.find((item) => item.key === "BEST")?.roiPercent ?? 0, preferred: "higher" },
                { label: "Base-case ROI", getter: (candidate) => formatPercent(candidate.result.scenarios.find((item) => item.key === "BASE")?.roiPercent ?? 0), sortValue: (candidate) => candidate.result.scenarios.find((item) => item.key === "BASE")?.roiPercent ?? 0, preferred: "higher" },
                { label: "Worst-case ROI", getter: (candidate) => formatPercent(candidate.result.scenarios.find((item) => item.key === "WORST")?.roiPercent ?? 0), sortValue: (candidate) => candidate.result.scenarios.find((item) => item.key === "WORST")?.roiPercent ?? 0, preferred: "higher" },
              ]}
            />

            <ComparisonRisksSection candidates={readyCandidates} />
          </>
        )}
      </SectionContainer>
    </div>
  );
}
type ComparisonRow = {
  label: string;
  getter: (candidate: ComparisonCandidate) => string;
  sortValue: (candidate: ComparisonCandidate) => number;
  preferred: "higher" | "lower";
};

function ComparisonSection({
  title,
  description,
  candidates,
  rows,
}: {
  title: string;
  description: string;
  candidates: ComparisonCandidate[];
  rows: ComparisonRow[];
}) {
  return (
    <div className="rounded-[24px] border border-[var(--line)] bg-white overflow-hidden">
      <div className="border-b border-[var(--line)] bg-[var(--sand-50)] px-5 py-4">
        <div className="text-lg font-semibold text-[var(--ink-950)]">{title}</div>
        <div className="mt-1 text-sm leading-6 text-[var(--ink-600)]">{description}</div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="border-b border-[var(--line)] bg-white">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-[var(--ink-500)]">Metric</th>
              {candidates.map((candidate) => (
                <th key={`compare-head-${candidate.id}`} className="px-4 py-3 text-left font-medium text-[var(--ink-500)]">
                  <div className="text-sm font-semibold text-[var(--ink-900)]">{candidate.label}</div>
                  <div className="mt-1 text-xs text-[var(--ink-500)]">{candidate.meta}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)]">
            {rows.map((row) => {
              const winningValue =
                row.preferred === "higher"
                  ? Math.max(...candidates.map((candidate) => row.sortValue(candidate)))
                  : Math.min(...candidates.map((candidate) => row.sortValue(candidate)));

              return (
                <tr key={`${title}-${row.label}`}>
                  <td className="px-4 py-4 font-medium text-[var(--ink-900)]">{row.label}</td>
                  {candidates.map((candidate) => {
                    const value = row.sortValue(candidate);
                    const winner = value === winningValue;

                    return (
                      <td key={`${title}-${row.label}-${candidate.id}`} className="px-4 py-4">
                        <div
                          className={cn(
                            "rounded-[18px] border px-3 py-3",
                            winner
                              ? "border-emerald-200 bg-emerald-50"
                              : "border-[var(--line)] bg-white",
                          )}
                        >
                          <div className="text-sm font-semibold text-[var(--ink-950)]">{row.getter(candidate)}</div>
                          {winner ? (
                            <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
                              Best on this metric
                            </div>
                          ) : null}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ComparisonRisksSection({ candidates }: { candidates: ComparisonCandidate[] }) {
  return (
    <div className="rounded-[24px] border border-[var(--line)] bg-white p-5">
      <div className="text-lg font-semibold text-[var(--ink-950)]">Risks and warnings</div>
      <div className="mt-1 text-sm leading-6 text-[var(--ink-600)]">
        Side-by-side risk view so you can see which option is cleaner and which one is carrying execution or pricing strain.
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {candidates.map((candidate) => (
          <div key={`risk-${candidate.id}`} className="rounded-[22px] border border-[var(--line)] bg-[var(--sand-50)] p-4">
            <div className="text-base font-semibold text-[var(--ink-950)]">{candidate.label}</div>
            <div className="mt-1 text-xs text-[var(--ink-500)]">{candidate.meta}</div>
            <div className="mt-4 space-y-2">
              {candidate.result.warnings.length > 0 ? (
                candidate.result.warnings.slice(0, 4).map((warning) => (
                  <WarningCard key={`${candidate.id}-${warning}`} tone={getWarningTone(warning)} message={warning} />
                ))
              ) : (
                <div className="rounded-[18px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                  No material warnings in the current model.
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecommendationsPanel({
  title,
  description,
  bundle,
  reportMode = false,
  onSelectLever,
}: {
  title: string;
  description: string;
  bundle: CalculatorRecommendationBundle;
  reportMode?: boolean;
  onSelectLever?: (label: string) => void;
}) {
  const [showAllLevers, setShowAllLevers] = useState(false);
  const critical = bundle.recommendations.filter((item) => item.severity === "CRITICAL");
  const watch = bundle.recommendations.filter((item) => item.severity === "WATCH");
  const opportunity = bundle.recommendations.filter((item) => item.severity === "OPPORTUNITY");
  const visibleLevers = showAllLevers ? bundle.biggestLevers : bundle.biggestLevers.slice(0, 3);

  return (
    <Card className={cn("rounded-[24px] border-[var(--line)] p-5 shadow-none", reportMode && "print:shadow-none")}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-400)]">
        {title}
      </div>
      <p className="mt-2 text-sm leading-6 text-[var(--ink-500)]">{description}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {visibleLevers.map((lever) => (
          <button
            key={lever.label}
            type="button"
            onClick={() => onSelectLever?.(lever.label)}
            className="rounded-full border border-[var(--line)] bg-[var(--sand-50)] px-3 py-1.5 text-[11px] font-semibold text-[var(--ink-600)] transition hover:border-[var(--brand-500)]/20 hover:bg-white"
          >
            {lever.label}
          </button>
        ))}
        {bundle.biggestLevers.length > 3 ? (
          <button
            type="button"
            onClick={() => setShowAllLevers((current) => !current)}
            className="rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-[11px] font-semibold text-[var(--ink-500)]"
          >
            {showAllLevers ? "Show fewer" : `Show all (${bundle.biggestLevers.length})`}
          </button>
        ) : null}
      </div>

      {visibleLevers.length > 0 ? (
        <div className="mt-4 space-y-3">
          {visibleLevers.map((lever) => (
            <InlineNarrative key={`lever-${lever.label}`} label={lever.label} body={lever.reason} />
          ))}
        </div>
      ) : null}

      <div className="mt-5 space-y-4">
        <RecommendationGroup title="Critical" tone="critical" items={critical} />
        <RecommendationGroup title="Watch" tone="watch" items={watch} />
        <RecommendationGroup title="Opportunity" tone="opportunity" items={opportunity} />
        {bundle.recommendations.length === 0 ? (
          <div className="rounded-[22px] border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm leading-6 text-emerald-900">
            No urgent recommendations are active. The current model is internally consistent enough for review, though normal commercial judgment still applies.
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function RecommendationGroup({
  title,
  tone,
  items,
}: {
  title: string;
  tone: "critical" | "watch" | "opportunity";
  items: CalculatorRecommendation[];
}) {
  const [open, setOpen] = useState(false);

  if (items.length === 0) {
    return null;
  }

  const previewItems = open ? items : items.slice(0, 2);

  return (
    <div className="rounded-[18px] border border-[var(--line)] bg-[var(--sand-50)]/45 px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <RecommendationSeverityChip tone={tone} label={title} />
          <span className="text-xs font-medium text-[var(--ink-500)]">{items.length}</span>
        </div>
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="rounded-full border border-[var(--line)] bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-600)]"
        >
          {open ? "Hide" : "Show"}
        </button>
      </div>
      <div className="mt-3 space-y-3">
        {previewItems.map((item) => (
          <SharedRecommendationCard
            key={item.id}
            title={item.title}
            category={item.category}
            message={item.message}
            tone={
              item.severity === "CRITICAL"
                ? "critical"
                : item.severity === "WATCH"
                  ? "watch"
                  : "opportunity"
            }
          />
        ))}
        {!open && items.length > previewItems.length ? (
          <div className="text-xs font-medium text-[var(--ink-500)]">
            {items.length - previewItems.length} more in this group.
          </div>
        ) : null}
      </div>
    </div>
  );
}

function RecommendationSeverityChip({
  tone,
  label,
}: {
  tone: "critical" | "watch" | "opportunity";
  label: string;
}) {
  return (
    <span
      className={cn(
        "rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em]",
        tone === "critical" && "border-rose-200 bg-rose-50 text-rose-700",
        tone === "watch" && "border-amber-200 bg-amber-50 text-amber-800",
        tone === "opportunity" && "border-emerald-200 bg-emerald-50 text-emerald-700",
      )}
    >
      {label}
    </span>
  );
}

function ComparisonRecommendationsPanel({
  recommendations,
}: {
  recommendations: ComparisonRecommendation[];
}) {
  if (recommendations.length === 0) {
    return null;
  }

  return (
    <div className="rounded-[24px] border border-[var(--line)] bg-white p-5">
      <div className="text-lg font-semibold text-[var(--ink-950)]">Comparison recommendations</div>
      <p className="mt-1 text-sm leading-6 text-[var(--ink-600)]">
        Use these as the high-level readout on safety, profitability, and timing tradeoffs across the compared options.
      </p>
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {recommendations.map((item) => (
          <div
            key={item.title}
            className={cn(
              "rounded-[22px] border px-4 py-4",
              item.severity === "CRITICAL" && "border-rose-200 bg-rose-50",
              item.severity === "WATCH" && "border-amber-200 bg-amber-50",
              item.severity === "OPPORTUNITY" && "border-emerald-200 bg-emerald-50",
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-[var(--ink-950)]">{item.title}</div>
              <RecommendationSeverityChip
                tone={
                  item.severity === "CRITICAL"
                    ? "critical"
                    : item.severity === "WATCH"
                      ? "watch"
                      : "opportunity"
                }
                label={item.severity}
              />
            </div>
            <p className="mt-2 text-sm leading-6 text-[var(--ink-700)]">{item.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function QuickAdjustPanel({
  currency,
  currentInput,
  currentResult,
  baselineResult,
  snapshots,
  mostSensitiveVariable,
  leastSensitiveVariable,
  focusedQuickAdjust,
  showAllControls,
  onToggleAllControls,
  onAdjust,
  onReset,
  biggestLevers,
}: {
  currency: string;
  currentInput: DevelopmentCalculationInput;
  currentResult: ReturnType<typeof calculateDevelopmentFeasibility>;
  baselineResult: ReturnType<typeof calculateDevelopmentFeasibility> | null;
  snapshots: ReturnType<typeof buildSensitivitySnapshots>;
  mostSensitiveVariable: string | null;
  leastSensitiveVariable: string | null;
  focusedQuickAdjust: QuickAdjustKey | null;
  showAllControls: boolean;
  onToggleAllControls: () => void;
  onAdjust: (key: QuickAdjustKey, delta: number) => void;
  onReset: () => void;
  biggestLevers: Array<{ label: string; reason: string; quickAdjustKey: QuickAdjustKey }>;
}) {
  const adjustmentDelta = baselineResult
    ? {
        profit: currentResult.revenue.estimatedGrossProfit - baselineResult.revenue.estimatedGrossProfit,
        roi: currentResult.revenue.roiPercent - baselineResult.revenue.roiPercent,
        fundingGap: currentResult.phasing.peakFundingGap - baselineResult.phasing.peakFundingGap,
        payback:
          (currentResult.phasing.paybackMonth ?? Number.POSITIVE_INFINITY) -
          (baselineResult.phasing.paybackMonth ?? Number.POSITIVE_INFINITY),
      }
    : null;

  const controls: Array<{
    key: QuickAdjustKey;
    label: string;
    summary: string;
    currentValue: string;
    priority: number;
  }> = [
    {
      key: "SELLING_PRICE" as const,
      label: "Selling price / sqm",
      summary: "Quickly test headline pricing discipline.",
      currentValue:
        currentInput.saleMode === "PER_SQM"
          ? formatCurrency(currentInput.currentSellingPricePerSqm ?? 0, currency)
          : formatCurrency(currentResult.revenue.effectiveSellingPricePerSqm, currency),
      priority: biggestLevers.some((lever) => lever.quickAdjustKey === "SELLING_PRICE") ? 0 : 2,
    },
    {
      key: "DEVELOPMENT_COST" as const,
      label: "Development cost load",
      summary: "Stress or relieve infrastructure-heavy delivery assumptions.",
      currentValue: formatCurrency(currentResult.costs.totalDevelopmentCost, currency),
      priority: biggestLevers.some((lever) => lever.quickAdjustKey === "DEVELOPMENT_COST") ? 0 : 2,
    },
    {
      key: "SALES_VELOCITY" as const,
      label: "Sell-through / velocity",
      summary: "Shift how quickly released inventory converts into inflow.",
      currentValue: formatPercent(currentResult.phasing.realizedSellThroughShare),
      priority: biggestLevers.some((lever) => lever.quickAdjustKey === "SALES_VELOCITY") ? 0 : 1,
    },
    {
      key: "RESERVED_LAND" as const,
      label: "Reserved land %",
      summary: "Test the effect of land efficiency on pricing and profit.",
      currentValue: formatPercent(currentResult.area.reservedPercentage),
      priority: biggestLevers.some((lever) => lever.quickAdjustKey === "RESERVED_LAND") ? 0 : 1,
    },
    {
      key: "PHASE_TIMING" as const,
      label: "Phasing timing",
      summary: "Accelerate or stretch timing to test liquidity pressure.",
      currentValue: `${currentInput.projectDurationMonths + currentInput.salesDurationMonths} months`,
      priority: biggestLevers.some((lever) => lever.quickAdjustKey === "PHASE_TIMING") ? 0 : 2,
    },
    {
      key: "TARGET_MARGIN" as const,
      label: "Target margin",
      summary: "See how much commercial headroom the plan really supports.",
      currentValue: formatPercent(currentInput.requiredTargetProfitMarginRate),
      priority: biggestLevers.some((lever) => lever.quickAdjustKey === "TARGET_MARGIN") ? 0 : 2,
    },
  ].sort((left, right) => left.priority - right.priority);

  const visibleControls = showAllControls ? controls : controls.slice(0, 4);

  return (
    <Card className="rounded-[24px] border-[var(--line)] p-5 shadow-none">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-400)]">
            Sensitivity
          </div>
          <h2 className="mt-2 text-lg font-semibold text-[var(--ink-950)]">
            Quick Adjust and sensitivity analysis
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--ink-500)]">
            Test the biggest commercial levers without reworking the whole model. Each adjustment updates the current result instantly and shows the immediate impact on profit, ROI, liquidity, and timing.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onToggleAllControls}>
            {showAllControls ? "Show fewer controls" : "Show all controls"}
          </Button>
          <Button variant="outline" onClick={onReset}>
            Reset adjustments
          </Button>
        </div>
      </div>

      {adjustmentDelta ? (
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <DeltaMetric label="Profit" value={adjustmentDelta.profit} currency={currency} />
          <DeltaMetric label="ROI" value={adjustmentDelta.roi} suffix=" pts" />
          <DeltaMetric label="Funding gap" value={-adjustmentDelta.fundingGap} currency={currency} invert />
          <DeltaMetric
            label="Payback"
            value={Number.isFinite(adjustmentDelta.payback) ? -adjustmentDelta.payback : 0}
            suffix=" months"
            invert
          />
        </div>
      ) : null}

      <div className="mt-5 space-y-2.5">
        {visibleControls.map((control) => (
          <QuickAdjustControlCard
            key={control.key}
            focused={focusedQuickAdjust === control.key}
            label={control.label}
            summary={control.summary}
            currentValue={control.currentValue}
            onAdjust={(delta) => onAdjust(control.key, delta)}
          />
        ))}
      </div>

      <div className="mt-6 rounded-[20px] border border-[var(--line)] bg-[var(--sand-50)]/65 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-[var(--ink-950)]">Sensitivity panel</div>
            <div className="mt-1 text-sm leading-6 text-[var(--ink-500)]">
              Compares downside and upside impact across the three variables that most often change project quality.
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {mostSensitiveVariable ? (
              <span className="rounded-full border border-rose-200 bg-rose-50/70 px-3 py-1.5 font-semibold text-rose-700">
                Most sensitive: {mostSensitiveVariable}
              </span>
            ) : null}
            {leastSensitiveVariable ? (
              <span className="rounded-full border border-emerald-200 bg-emerald-50/70 px-3 py-1.5 font-semibold text-emerald-700">
                Lowest impact: {leastSensitiveVariable}
              </span>
            ) : null}
          </div>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {snapshots.map((snapshot) => (
            <SensitivitySnapshotCard key={snapshot.key} snapshot={snapshot} currency={currency} />
          ))}
        </div>
      </div>
    </Card>
  );
}

function QuickAdjustControlCard({
  focused,
  label,
  summary,
  currentValue,
  onAdjust,
}: {
  focused: boolean;
  label: string;
  summary: string;
  currentValue: string;
  onAdjust: (delta: number) => void;
}) {
  return (
    <div
      className={cn(
        "rounded-[16px] border px-4 py-3.5 transition",
        focused
          ? "border-[var(--brand-500)]/24 bg-[var(--sand-50)]"
          : "border-[var(--line)] bg-white",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-[var(--ink-950)]">{label}</div>
          <div className="mt-1 text-sm leading-5 text-[var(--ink-500)]">{summary}</div>
        </div>
        <div className="rounded-full border border-[var(--line)] bg-[var(--sand-50)] px-3 py-1.5 text-[11px] font-semibold text-[var(--ink-600)]">
          {currentValue}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {[-0.1, -0.05, 0.05, 0.1].map((delta) => (
          <button
            key={`${label}-${delta}`}
            type="button"
            onClick={() => onAdjust(delta)}
            className={cn(
              "rounded-full border px-3.5 py-2 text-[11px] font-semibold transition",
              delta > 0
                ? "border-emerald-200 bg-emerald-50/80 text-emerald-700 hover:bg-emerald-100"
                : "border-rose-200 bg-rose-50/80 text-rose-700 hover:bg-rose-100",
            )}
          >
            {delta > 0 ? "+" : ""}
            {Math.abs(delta * 100)}%
          </button>
        ))}
      </div>
    </div>
  );
}

function DeltaMetric({
  label,
  value,
  currency,
  suffix = "",
  invert = false,
}: {
  label: string;
  value: number;
  currency?: string;
  suffix?: string;
  invert?: boolean;
}) {
  const positive = invert ? value >= 0 : value >= 0;
  const display = currency
    ? `${value >= 0 ? "+" : "-"}${formatCurrency(Math.abs(value), currency)}`
    : `${value >= 0 ? "+" : "-"}${Math.abs(value).toFixed(1)}${suffix}`;

  return (
    <SummaryMetric
      label={label}
      value={display}
      tone={positive ? "success" : "danger"}
    />
  );
}

function SensitivitySnapshotCard({
  snapshot,
  currency,
}: {
  snapshot: ReturnType<typeof buildSensitivitySnapshots>[number];
  currency: string;
}) {
  return (
    <div className="rounded-[22px] border border-[var(--line)] bg-white p-4">
      <div className="text-sm font-semibold text-[var(--ink-950)]">{snapshot.label}</div>
      <div className="mt-3 grid gap-2 text-sm">
        <SensitivityLine
          label="Downside profit"
          value={snapshot.down.revenue.estimatedGrossProfit}
          currency={currency}
        />
        <SensitivityLine
          label="Upside profit"
          value={snapshot.up.revenue.estimatedGrossProfit}
          currency={currency}
        />
        <SensitivityLine
          label="ROI spread"
          value={snapshot.roiSpread}
          suffix=" pts"
        />
        <SensitivityLine
          label="Funding gap swing"
          value={
            snapshot.up.phasing.peakFundingGap - snapshot.down.phasing.peakFundingGap
          }
          currency={currency}
        />
      </div>
    </div>
  );
}

function SensitivityLine({
  label,
  value,
  currency,
  suffix = "",
}: {
  label: string;
  value: number;
  currency?: string;
  suffix?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[var(--ink-600)]">{label}</span>
      <span className="font-medium text-[var(--ink-900)]">
        {currency ? formatCurrency(value, currency) : `${value.toFixed(1)}${suffix}`}
      </span>
    </div>
  );
}

function buildComparisonSummary(candidates: ComparisonCandidate[]) {
  const bestRoi = [...candidates].sort(
    (left, right) => right.result.revenue.roiPercent - left.result.revenue.roiPercent,
  )[0];
  const safest = [...candidates].sort(
    (left, right) => left.result.phasing.peakFundingGap - right.result.phasing.peakFundingGap,
  )[0];
  const fastestPayback = [...candidates].sort(
    (left, right) =>
      (left.result.phasing.paybackMonth ?? Number.POSITIVE_INFINITY) -
      (right.result.phasing.paybackMonth ?? Number.POSITIVE_INFINITY),
  )[0];

  return {
    highlights: [
      {
        title: "Most profitable option",
        body: bestRoi
          ? `${bestRoi.label} leads on ROI at ${formatPercent(bestRoi.result.revenue.roiPercent)}, which makes it the strongest return case in this comparison set.`
          : "No comparison result available yet.",
      },
      {
        title: "Safest liquidity profile",
        body: safest
          ? `${safest.label} carries the lightest funding pressure with a peak gap of ${formatCurrency(safest.result.phasing.peakFundingGap, safest.form.currency)}.`
          : "No comparison result available yet.",
      },
      {
        title: "Timing tradeoff",
        body:
          fastestPayback && fastestPayback.result.phasing.paybackMonth != null
            ? `${fastestPayback.label} pays back fastest by month ${fastestPayback.result.phasing.paybackMonth}, but that may still trade off against margin or headline pricing in the other options.`
            : "None of the compared options recovers cumulative cash inside the current timing window, so payback risk is still open.",
      },
    ],
  };
}

function mapLeverToQuickAdjust(label: string): QuickAdjustKey {
  const normalized = label.toLowerCase();

  if (normalized.includes("selling price")) {
    return "SELLING_PRICE";
  }

  if (normalized.includes("reserved land")) {
    return "RESERVED_LAND";
  }

  if (normalized.includes("development cost")) {
    return "DEVELOPMENT_COST";
  }

  if (normalized.includes("phasing")) {
    return "PHASE_TIMING";
  }

  if (normalized.includes("sell-through")) {
    return "SALES_VELOCITY";
  }

  return "TARGET_MARGIN";
}

function PhasingVisualAnalytics({
  results,
  currency,
  compact = false,
  reportMode = false,
  viewMode: controlledViewMode,
  onViewModeChange,
}: {
  results: ReturnType<typeof calculateDevelopmentFeasibility>;
  currency: string;
  compact?: boolean;
  reportMode?: boolean;
  viewMode?: "monthly" | "phase";
  onViewModeChange?: (value: "monthly" | "phase") => void;
}) {
  const [internalViewMode, setInternalViewMode] = useState<"monthly" | "phase">("monthly");
  const viewMode = controlledViewMode ?? internalViewMode;
  const setViewMode = onViewModeChange ?? setInternalViewMode;
  const weakestPhase = [...results.phasing.phases].sort((left, right) => {
    if (left.salesVelocityRate !== right.salesVelocityRate) {
      return left.salesVelocityRate - right.salesVelocityRate;
    }

    return right.phaseOutflow - left.phaseOutflow;
  })[0] ?? null;

  return (
    <div className={cn("grid gap-4", compact ? "xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]" : "xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]", "print:grid-cols-1")}>
      <ChartCard
        title="Cumulative cash position"
        description="Shows the liquidity curve over time, including the lowest cash point and payback marker when the plan recovers."
        action={
          !reportMode ? (
            <ChartModeToggle value={viewMode} onChange={setViewMode} />
          ) : undefined
        }
      >
        <CumulativeCashChart
          points={results.phasing.monthlyForecast}
          paybackMonth={results.phasing.paybackMonth}
          currency={currency}
        />
      </ChartCard>

      <ChartCard
        title="Funding and phase signals"
        description="Quick read on the hardest part of the timing plan."
      >
        <div className="grid gap-3">
          <SummaryMetric
            label="Peak funding gap"
            value={formatCurrency(results.phasing.peakFundingGap, currency)}
            tone={results.phasing.peakFundingGap > 0 ? "danger" : "success"}
          />
          <SummaryMetric
            label="Lowest cumulative cash"
            value={formatCurrency(results.phasing.cumulativeCashLowPoint, currency)}
            tone={results.phasing.cumulativeCashLowPoint < 0 ? "danger" : "success"}
          />
          <SummaryMetric
            label="Payback marker"
            value={
              results.phasing.paybackMonth != null
                ? `${results.phasing.paybackPhase ?? "Recovered"} - M${results.phasing.paybackMonth}`
                : "Not recovered inside plan"
            }
            tone={results.phasing.paybackMonth != null ? "success" : "danger"}
          />
          {weakestPhase ? (
            <div className="rounded-[22px] border border-[var(--line)] bg-[var(--sand-50)] px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-500)]">
                Phase watch
              </div>
              <div className="mt-2 text-base font-semibold text-[var(--ink-950)]">{weakestPhase.name}</div>
              <p className="mt-1 text-sm leading-6 text-[var(--ink-600)]">
                {formatPercent(weakestPhase.salesVelocityRate)} sell-through against {formatCurrency(weakestPhase.phaseOutflow, currency)} of outflow.
              </p>
            </div>
          ) : null}
        </div>
      </ChartCard>

      <ChartCard
        title={viewMode === "monthly" ? "Inflows vs outflows by month" : "Inflows vs outflows by phase"}
        description="Compares when money goes out against when it comes back in."
      >
        <CashMovementChart
          mode={viewMode}
          monthlyPoints={results.phasing.monthlyForecast}
          phases={results.phasing.phases}
          currency={currency}
        />
      </ChartCard>

      <ChartCard
        title="Revenue and cost by phase"
        description="Phase-level split for commercial value versus delivery pressure."
      >
        <PhaseRevenueCostChart phases={results.phasing.phases} currency={currency} />
      </ChartCard>
    </div>
  );
}

function ChartCard({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-[20px] border border-[var(--line)] bg-white p-5 print:break-inside-avoid">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-[var(--ink-950)]">{title}</div>
          <div className="mt-1 text-xs leading-5 text-[var(--ink-500)]">{description}</div>
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function ChartModeToggle({
  value,
  onChange,
}: {
  value: "monthly" | "phase";
  onChange: (value: "monthly" | "phase") => void;
}) {
  return (
    <div className="inline-flex rounded-full border border-[var(--line)] bg-[var(--sand-50)] p-1 text-xs">
      {[
        ["monthly", "Monthly"],
        ["phase", "Phase"],
      ].map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key as "monthly" | "phase")}
          className={cn(
            "rounded-full px-3 py-1.5 font-semibold transition",
            value === key
              ? "bg-white text-[var(--ink-950)] shadow-sm"
              : "text-[var(--ink-500)]",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function CumulativeCashChart({
  points,
  paybackMonth,
  currency,
}: {
  points: ReturnType<typeof calculateDevelopmentFeasibility>["phasing"]["monthlyForecast"];
  paybackMonth: number | null;
  currency: string;
}) {
  if (points.length === 0) {
    return <EmptyChartState message="No timing data available yet." />;
  }

  const width = 720;
  const height = 250;
  const padding = { top: 24, right: 18, bottom: 34, left: 22 };
  const values = points.map((point) => point.cumulativeCash);
  const minValue = Math.min(...values, 0);
  const maxValue = Math.max(...values, 0);
  const range = maxValue - minValue || 1;
  const zeroY = padding.top + ((maxValue - 0) / range) * (height - padding.top - padding.bottom);
  const lowestPoint = points.reduce((lowest, point) =>
    point.cumulativeCash < lowest.cumulativeCash ? point : lowest,
  );
  const pointPath = points
    .map((point, index) => {
      const x =
        padding.left +
        (index / Math.max(points.length - 1, 1)) * (width - padding.left - padding.right);
      const y =
        padding.top +
        ((maxValue - point.cumulativeCash) / range) * (height - padding.top - padding.bottom);
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
  const areaPath = `${pointPath} L ${width - padding.right} ${zeroY} L ${padding.left} ${zeroY} Z`;
  const lowestIndex = points.findIndex((point) => point.month === lowestPoint.month);
  const lowestX =
    padding.left +
    (lowestIndex / Math.max(points.length - 1, 1)) * (width - padding.left - padding.right);
  const lowestY =
    padding.top +
    ((maxValue - lowestPoint.cumulativeCash) / range) * (height - padding.top - padding.bottom);
  const paybackIndex =
    paybackMonth != null ? points.findIndex((point) => point.month + 1 === paybackMonth) : -1;
  const paybackX =
    paybackIndex >= 0
      ? padding.left +
        (paybackIndex / Math.max(points.length - 1, 1)) * (width - padding.left - padding.right)
      : null;

  return (
    <div className="space-y-3">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full overflow-visible">
        <line
          x1={padding.left}
          y1={zeroY}
          x2={width - padding.right}
          y2={zeroY}
          stroke="rgba(15,23,42,0.12)"
          strokeDasharray="4 4"
        />
        <path d={areaPath} fill="rgba(28,123,97,0.1)" />
        <path d={pointPath} fill="none" stroke="var(--brand-500)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={lowestX} cy={lowestY} r="5" fill="#e11d48" />
        <text x={lowestX + 10} y={lowestY - 8} fontSize="11" fill="#881337">
          Low point
        </text>
        {paybackX != null ? (
          <>
            <line x1={paybackX} y1={padding.top} x2={paybackX} y2={height - padding.bottom} stroke="#0f766e" strokeDasharray="4 4" />
            <text x={paybackX + 8} y={padding.top + 12} fontSize="11" fill="#0f766e">
              Payback
            </text>
          </>
        ) : null}
      </svg>
      <div className="flex flex-wrap gap-3 text-xs text-[var(--ink-600)]">
        <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5">
          Lowest cumulative cash: {formatCurrency(lowestPoint.cumulativeCash, currency)}
        </span>
        {paybackMonth != null ? (
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5">
            Payback by month {paybackMonth}
          </span>
        ) : (
          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5">
            Payback not reached in current plan
          </span>
        )}
      </div>
    </div>
  );
}

function CashMovementChart({
  mode,
  monthlyPoints,
  phases,
  currency,
}: {
  mode: "monthly" | "phase";
  monthlyPoints: ReturnType<typeof calculateDevelopmentFeasibility>["phasing"]["monthlyForecast"];
  phases: ReturnType<typeof calculateDevelopmentFeasibility>["phasing"]["phases"];
  currency: string;
}) {
  const data =
    mode === "monthly"
      ? monthlyPoints.map((point) => ({
          label: point.label,
          inflow: point.inflow,
          outflow: point.outflow,
        }))
      : phases.map((phase) => ({
          label: phase.name,
          inflow: phase.phaseInflow,
          outflow: phase.phaseOutflow,
        }));

  if (data.length === 0) {
    return <EmptyChartState message="No movement data available yet." />;
  }

  const maxValue = Math.max(...data.flatMap((item) => [item.inflow, item.outflow]), 1);

  return (
    <div className="space-y-3">
      <div className="space-y-3">
        {data.map((item) => {
          const inflowWidth = `${(item.inflow / maxValue) * 100}%`;
          const outflowWidth = `${(item.outflow / maxValue) * 100}%`;

          return (
            <div key={`${mode}-${item.label}`} className="space-y-1.5">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="font-semibold text-[var(--ink-700)]">{item.label}</span>
                <span className="text-[var(--ink-500)]">
                  In {formatCurrency(item.inflow, currency)} - Out {formatCurrency(item.outflow, currency)}
                </span>
              </div>
              <div className="space-y-1">
                <div className="h-2.5 rounded-full bg-[var(--sand-100)]">
                  <div className="h-2.5 rounded-full bg-emerald-500" style={{ width: inflowWidth }} />
                </div>
                <div className="h-2.5 rounded-full bg-[var(--sand-100)]">
                  <div className="h-2.5 rounded-full bg-rose-400" style={{ width: outflowWidth }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-[var(--ink-600)]">
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5">Green = inflow</span>
        <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5">Red = outflow</span>
      </div>
    </div>
  );
}

function PhaseRevenueCostChart({
  phases,
  currency,
}: {
  phases: ReturnType<typeof calculateDevelopmentFeasibility>["phasing"]["phases"];
  currency: string;
}) {
  if (phases.length === 0) {
    return <EmptyChartState message="No phase data available yet." />;
  }

  const maxValue = Math.max(
    ...phases.flatMap((phase) => [phase.phaseRevenue, phase.phaseOutflow]),
    1,
  );

  return (
    <div className="space-y-3">
      {phases.map((phase) => {
        const revenueWidth = `${(phase.phaseRevenue / maxValue) * 100}%`;
        const costWidth = `${(phase.phaseOutflow / maxValue) * 100}%`;
        const weakSellThrough = phase.salesVelocityRate < 60;
        const heavyCostLoading = phase.developmentCostShare >= 45;

        return (
          <div key={`phase-bars-${phase.name}-${phase.startMonthOffset}`} className="rounded-[20px] border border-[var(--line)] bg-[var(--sand-50)] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold text-[var(--ink-950)]">{phase.name}</div>
                <div className="mt-1 text-xs text-[var(--ink-500)]">
                  {formatPercent(phase.sellableInventoryShare)} inventory - {formatPercent(phase.salesVelocityRate)} sell-through
                </div>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                {weakSellThrough ? <StatusChip label="Weak sell-through" tone="danger" /> : null}
                {heavyCostLoading ? <StatusChip label="Heavy cost load" tone="default" /> : null}
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <div>
                <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                  <span className="text-[var(--ink-600)]">Revenue</span>
                  <span className="font-medium text-[var(--ink-700)]">{formatCurrency(phase.phaseRevenue, currency)}</span>
                </div>
                <div className="h-2.5 rounded-full bg-white">
                  <div className="h-2.5 rounded-full bg-emerald-500" style={{ width: revenueWidth }} />
                </div>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                  <span className="text-[var(--ink-600)]">Cost</span>
                  <span className="font-medium text-[var(--ink-700)]">{formatCurrency(phase.phaseOutflow, currency)}</span>
                </div>
                <div className="h-2.5 rounded-full bg-white">
                  <div className="h-2.5 rounded-full bg-[var(--brand-700)]" style={{ width: costWidth }} />
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EmptyChartState({ message }: { message: string }) {
  return (
    <div className="rounded-[20px] border border-dashed border-[var(--line)] bg-[var(--sand-50)] px-4 py-6 text-sm text-[var(--ink-600)]">
      {message}
    </div>
  );
}

function Field({
  label,
  helper,
  children,
}: {
  label: string;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-[var(--ink-700)]">{label}</span>
      {children}
      {helper ? <div className="text-xs leading-5 text-[var(--ink-500)]">{helper}</div> : null}
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  helper,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
  helper?: string;
}) {
  return (
    <Field label={label} helper={helper}>
      <select
        className="h-11 w-full rounded-2xl border border-[var(--line)] bg-white px-4 text-sm text-[var(--ink-900)]"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </Field>
  );
}

function PercentField({
  label,
  helper,
  value,
  onChange,
}: {
  label: string;
  helper?: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <Field label={label} helper={helper ?? "Enter a percentage between 0 and 100."}>
      <Input type="number" value={value} onChange={(event) => onChange(Number(event.target.value || 0))} />
    </Field>
  );
}

function ToggleField({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-[22px] border border-[var(--line)] px-4 py-3">
      <div>
        <div className="text-sm font-medium text-[var(--ink-700)]">{label}</div>
        <div className="mt-1 text-xs leading-5 text-[var(--ink-500)]">{description}</div>
      </div>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

function CostColumn({
  title,
  helper,
  fields,
}: {
  title: string;
  helper?: string;
  fields: Array<[string, number, (value: number) => void]>;
}) {
  return (
    <div className="rounded-[26px] border border-[var(--line)] bg-[var(--sand-50)] p-5">
      <div className="text-sm font-semibold text-[var(--ink-950)]">{title}</div>
      {helper ? <div className="mt-1 text-xs leading-5 text-[var(--ink-500)]">{helper}</div> : null}
      <div className="mt-4 space-y-4">
        {fields.map(([label, value, onChange]) => (
          <Field key={label} label={label}>
            <Input type="number" value={value} onChange={(event) => onChange(Number(event.target.value || 0))} />
          </Field>
        ))}
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "success";
}) {
  return (
    <div
      className={cn(
        "rounded-[22px] border border-[var(--line)] bg-white px-5 py-4",
        tone === "success" && "border-emerald-200 bg-emerald-50",
      )}
    >
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ink-500)]">
        {label}
      </div>
      <div className="mt-2 text-lg font-semibold text-[var(--ink-950)]">{value}</div>
    </div>
  );
}

function SummaryMetric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "success" | "danger" | "accent";
}) {
  return (
    <div
      className={cn(
        "rounded-[18px] border border-[var(--line)] bg-white px-4 py-3.5",
        tone === "success" && "border-emerald-200 bg-emerald-50/60",
        tone === "danger" && "border-rose-200 bg-rose-50/60",
        tone === "accent" && "border-[var(--brand-200)] bg-[var(--sand-50)]/85",
      )}
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-400)]">
        {label}
      </div>
      <div className="mt-2 text-base font-semibold text-[var(--ink-950)]">{value}</div>
    </div>
  );
}

function WorkflowStep({
  step,
  title,
  description,
  children,
}: {
  step: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[22px] border border-[var(--line)] bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ink-500)]">
            {step}
          </div>
          <h3 className="mt-2 text-lg font-semibold text-[var(--ink-950)]">{title}</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--ink-500)]">{description}</p>
        </div>
      </div>
      <div className="mt-5 space-y-4">{children}</div>
    </div>
  );
}

function ModeCard({
  active,
  title,
  description,
}: {
  active: boolean;
  title: string;
  description: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[18px] border px-4 py-4",
        active
          ? "border-[var(--brand-500)]/30 bg-[var(--sand-50)]"
          : "border-[var(--line)] bg-white",
      )}
    >
      <div className="flex items-center gap-2">
        <StatusChip label={active ? "Active" : "Available"} tone={active ? "success" : "default"} />
      </div>
      <div className="mt-3 text-base font-semibold text-[var(--ink-950)]">{title}</div>
      <p className="mt-2 text-sm leading-6 text-[var(--ink-500)]">{description}</p>
    </div>
  );
}

function CommercialDecisionCard({
  title,
  emphasis,
  value,
  detail,
  footer,
  tone,
}: {
  title: string;
  emphasis: string;
  value: string;
  detail: string;
  footer: string;
  tone: "accent" | "success";
}) {
  return (
    <div
      className={cn(
        "rounded-[20px] border p-5",
        tone === "accent" && "border-[var(--brand-500)]/25 bg-[var(--sand-50)]/80",
        tone === "success" && "border-emerald-200 bg-emerald-50/50",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ink-500)]">
            {title}
          </div>
          <div className="mt-1 text-sm font-semibold text-[var(--ink-950)]">{emphasis}</div>
        </div>
        <StatusChip label={tone === "accent" ? "Cash-first" : "Time-value adjusted"} tone={tone === "accent" ? "default" : "success"} />
      </div>
      <div className="mt-4 text-2xl font-semibold text-[var(--ink-950)]">{value}</div>
      <p className="mt-2 text-sm leading-6 text-[var(--ink-500)]">{detail}</p>
      <div className="mt-4 text-sm font-medium text-[var(--ink-700)]">{footer}</div>
    </div>
  );
}

function ReportSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="rounded-[30px] p-8 print:shadow-none">
      <div className="mb-5">
        <h3 className="text-2xl font-semibold text-[var(--ink-950)]">{title}</h3>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--ink-600)]">{description}</p>
      </div>
      <div className="space-y-4">{children}</div>
    </Card>
  );
}

function ReportMetric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "success" | "danger" | "accent";
}) {
  return (
    <div
      className={cn(
        "rounded-[24px] border px-5 py-4",
        tone === "default" && "border-[var(--line)] bg-white",
        tone === "success" && "border-emerald-200 bg-emerald-50",
        tone === "danger" && "border-rose-200 bg-rose-50",
        tone === "accent" && "border-[var(--brand-500)]/25 bg-[var(--sand-50)]",
      )}
    >
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-500)]">
        {label}
      </div>
      <div className="mt-2 text-xl font-semibold text-[var(--ink-950)]">{value}</div>
    </div>
  );
}

function NarrativeCard({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-[18px] border border-[var(--line)] bg-[var(--sand-50)]/65 p-4">
      <div className="text-sm font-semibold text-[var(--ink-950)]">{title}</div>
      <p className="mt-2 text-sm leading-6 text-[var(--ink-500)]">{body}</p>
    </div>
  );
}

function InlineNarrative({
  label,
  body,
}: {
  label: string;
  body: string;
}) {
  return (
    <div className="border-b border-[var(--line)]/80 pb-4 last:border-b-0 last:pb-0">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-400)]">
        {label}
      </div>
      <p className="mt-2 text-sm leading-6 text-[var(--ink-600)]">{body}</p>
    </div>
  );
}

function ReportLine({
  label,
  value,
  currency,
  emphasis = false,
}: {
  label: string;
  value: number;
  currency: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={cn("text-[var(--ink-600)]", emphasis && "font-semibold text-[var(--ink-950)]")}>
        {label}
      </span>
      <span className={cn("font-semibold text-[var(--ink-950)]", emphasis && "text-lg")}>
        {formatCurrency(value, currency)}
      </span>
    </div>
  );
}

function StatusChip({
  label,
  tone = "default",
}: {
  label: string;
  tone?: "default" | "success" | "danger";
}) {
  return (
    <span
      className={cn(
        "rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]",
        tone === "default" && "border-[var(--line)] bg-white text-[var(--ink-600)]",
        tone === "success" && "border-emerald-200 bg-emerald-50 text-emerald-800",
        tone === "danger" && "border-rose-200 bg-rose-50 text-rose-800",
      )}
    >
      {label}
    </span>
  );
}

function MetricChip({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-[var(--line)] bg-[var(--sand-50)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-500)]">
      {label}
    </span>
  );
}

function PresetTile({
  preset,
  active,
  onSelect,
  statusLabel,
}: {
  preset: (typeof DEVELOPMENT_PRESETS)[number];
  active: boolean;
  onSelect: () => void;
  statusLabel?: string;
}) {
  const reservePercentage =
    preset.assumptions.roadsPercentage +
    preset.assumptions.drainagePercentage +
    preset.assumptions.greenAreaPercentage +
    preset.assumptions.utilitiesPercentage;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "rounded-[18px] border px-4 py-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-300)]",
        active
          ? "border-[var(--brand-300)] bg-[var(--sand-50)]"
          : "border-[var(--line)] bg-white hover:border-[var(--brand-200)]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-[var(--ink-950)]">{preset.label}</div>
          <p className="mt-1 text-sm leading-6 text-[var(--ink-500)]">{preset.summary}</p>
        </div>
        {statusLabel ? <StatusChip label={statusLabel} tone={active ? "success" : "default"} /> : null}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <MetricChip label={`Reserve ${formatPercent(reservePercentage)}`} />
        <MetricChip label={`Margin ${formatPercent(preset.assumptions.requiredTargetProfitMarginRate)}`} />
        <MetricChip label={`${preset.quickStartPhases} phase${preset.quickStartPhases > 1 ? "s" : ""}`} />
      </div>
    </button>
  );
}

function ScenarioMatrix({
  scenarios,
  currency,
}: {
  scenarios: ScenarioItem[];
  currency: string;
}) {
  const rows = [
    {
      label: "Adjusted cost",
      getValue: (scenario: ScenarioItem) => formatCurrency(scenario.totalCost, currency),
    },
    {
      label: "Revenue",
      getValue: (scenario: ScenarioItem) => formatCurrency(scenario.estimatedRevenue, currency),
    },
    {
      label: "Profit",
      getValue: (scenario: ScenarioItem) => formatCurrency(scenario.estimatedProfit, currency),
    },
    {
      label: "ROI",
      getValue: (scenario: ScenarioItem) => formatPercent(scenario.roiPercent),
    },
    {
      label: "Margin",
      getValue: (scenario: ScenarioItem) => formatPercent(scenario.marginPercent),
    },
    {
      label: "Min price / sqm",
      getValue: (scenario: ScenarioItem) => formatCurrency(scenario.minimumSellingPricePerSqm, currency),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-[22px] border border-[var(--line)] bg-white">
        <table className="min-w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="text-left">
              <th className="border-b border-[var(--line)] px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-400)]">
                Metric
              </th>
              {scenarios.map((scenario) => (
                <th
                  key={scenario.key}
                  className="border-b border-[var(--line)] px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-400)]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span>{scenario.label}</span>
                    <StatusChip label={scenario.key === "BASE" ? "Current" : "Scenario"} tone={getScenarioTone(scenario.key)} />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={row.label}>
                <td
                  className={cn(
                    "px-4 py-3 font-medium text-[var(--ink-600)]",
                    rowIndex !== rows.length - 1 && "border-b border-[var(--line)]",
                  )}
                >
                  {row.label}
                </td>
                {scenarios.map((scenario) => (
                  <td
                    key={`${row.label}-${scenario.key}`}
                    className={cn(
                      "px-4 py-3 font-semibold text-[var(--ink-950)]",
                      rowIndex !== rows.length - 1 && "border-b border-[var(--line)]",
                    )}
                  >
                    {row.getValue(scenario)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        {scenarios.map((scenario) => (
          <div
            key={`scenario-summary-${scenario.key}`}
            className="rounded-[18px] border border-[var(--line)] bg-[var(--sand-50)]/65 px-4 py-3"
          >
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "h-2.5 w-2.5 rounded-full",
                  getScenarioTone(scenario.key) === "success" && "bg-emerald-500",
                  getScenarioTone(scenario.key) === "danger" && "bg-rose-500",
                  getScenarioTone(scenario.key) === "default" && "bg-[var(--ink-400)]",
                )}
              />
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-500)]">
                {scenario.label}
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-[var(--ink-600)]">{scenario.summary}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScenarioCard({
  scenario,
  currency,
}: {
  scenario: ScenarioItem;
  currency: string;
}) {
  const tone = getScenarioTone(scenario.key);

  return (
    <div
      className={cn(
        "rounded-[24px] border p-5",
        tone === "default" && "border-[var(--line)] bg-white",
        tone === "success" && "border-emerald-200 bg-emerald-50/70",
        tone === "danger" && "border-rose-200 bg-rose-50/70",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <StatusChip label={scenario.label} tone={tone} />
        <div className="text-sm font-semibold text-[var(--ink-950)]">{formatPercent(scenario.roiPercent)}</div>
      </div>
      <p className="mt-3 text-sm leading-6 text-[var(--ink-600)]">{scenario.summary}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <MiniStat label="Adjusted cost" value={formatCurrency(scenario.totalCost, currency)} />
        <MiniStat label="Revenue" value={formatCurrency(scenario.estimatedRevenue, currency)} />
        <MiniStat
          label="Profit"
          value={formatCurrency(scenario.estimatedProfit, currency)}
          tone={scenario.estimatedProfit >= 0 ? "success" : "default"}
        />
        <MiniStat
          label="Min price / sqm"
          value={formatCurrency(scenario.minimumSellingPricePerSqm, currency)}
        />
      </div>
    </div>
  );
}

function WarningCard({
  tone,
  message,
}: {
  tone: "danger" | "caution";
  message: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[18px] border px-4 py-3 text-sm leading-6",
        tone === "danger" && "border-rose-200 bg-rose-50 text-rose-900",
        tone === "caution" && "border-amber-200 bg-amber-50 text-amber-900",
      )}
    >
      {message}
    </div>
  );
}





