"use client";

import { useState } from "react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type RecommendationTone = "critical" | "watch" | "opportunity";

export function SectionContainer({
  eyebrow,
  title,
  description,
  children,
  collapsible = false,
  defaultOpen = true,
  open: controlledOpen,
  onToggle,
  badge,
  className,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  open?: boolean;
  onToggle?: (next: boolean) => void;
  badge?: string;
  className?: string;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const open = controlledOpen ?? uncontrolledOpen;

  return (
    <Card
      className={cn(
        "admin-surface px-5 py-5 sm:px-6 sm:py-6",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          {eyebrow ? (
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-400)]">
              {eyebrow}
            </div>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h2 className="text-[1.35rem] font-semibold leading-tight text-[var(--ink-950)] sm:text-[1.55rem]">
              {title}
            </h2>
            {badge ? (
              <span className="admin-chip">
                {badge}
              </span>
            ) : null}
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--ink-500)]">{description}</p>
        </div>
        {collapsible ? (
          <button
            type="button"
            onClick={() => {
              const next = !open;
              onToggle?.(next);
              if (controlledOpen === undefined) {
                setUncontrolledOpen(next);
              }
            }}
            className="admin-chip admin-interactive admin-focus hover:bg-white"
          >
            {open ? "Collapse" : "Expand"}
          </button>
        ) : null}
      </div>
      {open ? <div className="mt-6 space-y-6">{children}</div> : null}
    </Card>
  );
}

export function SegmentedTabs<T extends string>({
  value,
  onChange,
  items,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  items: Array<{ value: T; label: string; badge?: string }>;
  className?: string;
}) {
  return (
    <div className={cn("overflow-x-auto pb-1", className)}>
      <div className="inline-flex min-w-full gap-1 rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--sand-50)] p-1 sm:min-w-0">
        {items.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange(item.value)}
            className={cn(
              "admin-interactive admin-focus flex min-w-[104px] items-center justify-center gap-2 rounded-[var(--radius-sm)] px-3 py-2 text-sm font-medium",
              value === item.value
                ? "bg-white text-[var(--ink-950)] shadow-[0_1px_2px_rgba(15,23,42,0.06)]"
                : "bg-transparent text-[var(--ink-500)] hover:text-[var(--ink-900)]",
            )}
          >
            <span>{item.label}</span>
            {item.badge ? (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]",
                  value === item.value ? "bg-[var(--sand-100)] text-[var(--ink-700)]" : "bg-white text-[var(--ink-400)]",
                )}
              >
                {item.badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}

export function CollapsiblePanel({
  title,
  description,
  children,
  defaultOpen = true,
  tone = "default",
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  tone?: "default" | "subtle";
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      className={cn(
        "px-4 py-4 sm:px-5 sm:py-5",
        tone === "default" && "admin-surface",
        tone === "subtle" && "admin-surface-muted",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[15px] font-semibold text-[var(--ink-950)]">{title}</div>
          {description ? (
            <div className="mt-1 text-sm leading-6 text-[var(--ink-500)]">{description}</div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="admin-chip admin-interactive admin-focus bg-white hover:bg-[var(--sand-50)]"
        >
          {open ? "Hide" : "Show"}
        </button>
      </div>
      {open ? <div className="mt-5 space-y-4">{children}</div> : null}
    </div>
  );
}

export function KPIStatCard({
  label,
  value,
  detail,
  tone = "default",
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: "default" | "success" | "danger" | "accent";
}) {
  return (
    <div
      className={cn(
        "admin-surface px-4 py-3.5",
        tone === "default" && "",
        tone === "success" && "border-[color:var(--success-200)] bg-[color:var(--success-50)]",
        tone === "danger" && "border-[color:var(--danger-200)] bg-[color:var(--danger-50)]",
        tone === "accent" && "border-[color:var(--brand-100)] bg-[color:var(--sand-50)]",
      )}
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-400)]">
        {label}
      </div>
      <div className="mt-2 text-[1.05rem] font-semibold tracking-[-0.01em] text-[var(--ink-950)]">
        {value}
      </div>
      {detail ? <div className="mt-1 text-sm leading-5 text-[var(--ink-500)]">{detail}</div> : null}
    </div>
  );
}

export function StickySummaryPanel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4 xl:sticky xl:top-6 xl:self-start print:hidden">
      <Card className="admin-surface p-4 sm:p-5">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-400)]">
          {title}
        </div>
        {description ? (
          <p className="mt-2 text-sm leading-6 text-[var(--ink-500)]">{description}</p>
        ) : null}
        <div className="mt-4 space-y-4">{children}</div>
      </Card>
    </div>
  );
}

export function RecommendationCard({
  title,
  category,
  message,
  tone,
}: {
  title: string;
  category: string;
  message: string;
  tone: RecommendationTone;
}) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-md)] border px-4 py-3.5",
        tone === "critical" && "border-[color:var(--danger-200)] bg-[color:var(--danger-50)]",
        tone === "watch" && "border-[color:var(--warning-200)] bg-[color:var(--warning-50)]",
        tone === "opportunity" && "border-[color:var(--success-200)] bg-[color:var(--success-50)]",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm font-semibold text-[var(--ink-950)]">{title}</div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-400)]">
          {category}
        </div>
      </div>
      <p className="mt-2 text-sm leading-6 text-[var(--ink-600)]">{message}</p>
    </div>
  );
}
