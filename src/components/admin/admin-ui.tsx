import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function AdminToolbar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "admin-surface flex flex-col gap-3 px-4 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function AdminMetricGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("grid gap-4 md:grid-cols-2 xl:grid-cols-4 max-md:grid-cols-1", className)}>{children}</div>;
}

export function AdminMetricCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: "default" | "accent" | "danger" | "success";
}) {
  return (
    <Card
      className={cn(
        "admin-surface px-4 py-4",
        tone === "default" && "",
        tone === "accent" && "border-[color:var(--brand-100)] bg-[color:var(--sand-50)]",
        tone === "danger" && "border-[color:var(--danger-200)] bg-[color:var(--danger-50)]",
        tone === "success" && "border-[color:var(--success-200)] bg-[color:var(--success-50)]",
      )}
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-400)]">{label}</div>
      <div className="mt-2 text-[1.75rem] font-semibold tracking-[-0.03em] text-[var(--ink-950)]">{value}</div>
      {hint ? <p className="mt-2 text-sm leading-6 text-[var(--ink-500)]">{hint}</p> : null}
    </Card>
  );
}

export function AdminPanel({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("admin-surface overflow-hidden", className)}>
      {title || description || actions ? (
        <div className="flex flex-col gap-3 border-b border-[var(--line)] px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            {title ? <h2 className="text-base font-semibold text-[var(--ink-950)] sm:text-lg">{title}</h2> : null}
            {description ? <p className="mt-1 text-sm leading-6 text-[var(--ink-500)]">{description}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className="px-5 py-5">{children}</div>
    </Card>
  );
}

export function AdminEmptyState({
  title,
  description,
  action,
  secondaryAction,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  secondaryAction?: React.ReactNode;
}) {
  return (
    <Card className="admin-empty-surface px-6 py-14 text-center">
      <h2 className="text-lg font-semibold text-[var(--ink-950)]">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[var(--ink-500)]">{description}</p>
      {action || secondaryAction ? (
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          {action}
          {secondaryAction}
        </div>
      ) : null}
    </Card>
  );
}

export function AdminSkeletonBlock({
  className,
}: {
  className?: string;
}) {
  return <div className={cn("admin-skeleton h-4 w-full", className)} aria-hidden="true" />;
}

export function AdminPanelSkeleton({
  lines = 3,
}: {
  lines?: number;
}) {
  return (
    <Card className="admin-surface px-5 py-5">
      <AdminSkeletonBlock className="h-4 w-32" />
      <AdminSkeletonBlock className="mt-3 h-8 w-48" />
      <div className="mt-5 space-y-3">
        {Array.from({ length: lines }, (_, index) => (
          <AdminSkeletonBlock key={index} className="h-10 w-full" />
        ))}
      </div>
    </Card>
  );
}

export function AdminStateBanner({
  tone = "info",
  title,
  message,
  action,
}: {
  tone?: "info" | "success" | "warning" | "danger";
  title: string;
  message?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-md)] border px-4 py-3.5",
        tone === "info" && "border-[var(--line)] bg-[var(--sand-50)] text-[var(--ink-700)]",
        tone === "success" && "border-[color:var(--success-200)] bg-[color:var(--success-50)] text-[var(--ink-900)]",
        tone === "warning" && "border-[color:var(--warning-200)] bg-[color:var(--warning-50)] text-[var(--ink-900)]",
        tone === "danger" && "border-[color:var(--danger-200)] bg-[color:var(--danger-50)] text-[var(--ink-900)]",
      )}
      role={tone === "danger" ? "alert" : "status"}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-sm font-semibold">{title}</div>
          {message ? <div className="mt-1 text-sm leading-6 text-[var(--ink-600)]">{message}</div> : null}
        </div>
        {action ? <div className="flex items-center">{action}</div> : null}
      </div>
    </div>
  );
}

export function AdminFormSection({
  title,
  description,
  children,
  density = "standard",
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  density?: "standard" | "dense";
}) {
  return (
    <Card className="admin-surface px-5 py-5 sm:px-6 sm:py-6">
      <h2 className="text-lg font-semibold tracking-[-0.02em] text-[var(--ink-950)]">{title}</h2>
      {description ? <p className="mt-2 text-sm leading-6 text-[var(--ink-500)]">{description}</p> : null}
      <div className={cn(density === "standard" ? "mt-5 space-y-4" : "mt-4 space-y-3")}>{children}</div>
    </Card>
  );
}

export function AdminField({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-[var(--ink-700)]">{label}</span>
      {children}
      {error ? (
        <span className="block text-xs font-medium text-rose-700">{error}</span>
      ) : hint ? (
        <span className="block text-xs leading-5 text-[var(--ink-500)]">{hint}</span>
      ) : null}
    </label>
  );
}

export function AdminModalFrame({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <Card className="admin-surface px-4 py-4 sm:px-5 sm:py-5">
      <div className="border-b border-[var(--line)] pb-4">
        <h2 className="text-base font-semibold text-[var(--ink-950)]">{title}</h2>
        {description ? <p className="mt-1 text-sm leading-6 text-[var(--ink-500)]">{description}</p> : null}
      </div>
      <div className="py-4">{children}</div>
      {footer ? <div className="border-t border-[var(--line)] pt-4">{footer}</div> : null}
    </Card>
  );
}

export function AdminLifecycleSteps({
  steps,
  currentIndex,
  compact = false,
}: {
  steps: readonly string[];
  currentIndex: number;
  compact?: boolean;
}) {
  return (
    <div className={cn("grid gap-2", compact ? "grid-cols-2 sm:grid-cols-4" : "sm:grid-cols-2 xl:grid-cols-4")}>
      {steps.map((step, index) => {
        const state =
          index < currentIndex ? "complete" : index === currentIndex ? "current" : "upcoming";
        return (
          <div
            key={step}
            className={cn(
              "rounded-[var(--radius-md)] border px-3 py-2.5",
              state === "complete" && "border-[color:var(--success-200)] bg-[color:var(--success-50)]",
              state === "current" && "border-[color:var(--brand-100)] bg-[color:var(--sand-50)]",
              state === "upcoming" && "border-[var(--line)] bg-white",
            )}
          >
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-400)]">
              {state === "complete" ? "Done" : state === "current" ? "Current" : "Next"}
            </div>
            <div className="mt-1 text-sm font-medium text-[var(--ink-900)]">{step}</div>
          </div>
        );
      })}
    </div>
  );
}

export function AdminQuickActions({
  title = "Quick actions",
  actions,
}: {
  title?: string;
  actions: Array<{
    label: string;
    onClick: () => void;
    disabled?: boolean;
    tone?: "default" | "primary" | "danger";
  }>;
}) {
  return (
    <div className="space-y-2">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-400)]">{title}</div>
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={action.onClick}
            disabled={action.disabled}
            className={cn(
              "admin-interactive admin-focus rounded-full border px-3 py-1.5 text-xs font-semibold",
              action.tone === "default" && "border-[var(--line)] bg-white text-[var(--ink-700)] hover:bg-[var(--sand-50)]",
              action.tone === "primary" && "border-[color:var(--brand-100)] bg-[color:var(--sand-50)] text-[var(--ink-900)] hover:bg-white",
              action.tone === "danger" && "border-[color:var(--danger-200)] bg-[color:var(--danger-50)] text-rose-800 hover:bg-white",
              action.disabled && "cursor-not-allowed opacity-50",
            )}
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function AdminBulkActionBar({
  selectedCount,
  description,
  actions,
}: {
  selectedCount: number;
  description?: string;
  actions: React.ReactNode;
}) {
  if (selectedCount <= 0) {
    return null;
  }

  return (
    <div className="admin-surface-muted flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="text-sm font-semibold text-[var(--ink-900)]">
          {selectedCount} item{selectedCount === 1 ? "" : "s"} selected
        </div>
        {description ? <div className="mt-1 text-sm text-[var(--ink-500)]">{description}</div> : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">{actions}</div>
    </div>
  );
}

export function AdminAttentionBadge({
  label,
  tone = "info",
}: {
  label: string;
  tone?: "info" | "warning" | "danger" | "success";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]",
        tone === "info" && "border-[var(--line)] bg-white text-[var(--ink-500)]",
        tone === "success" && "border-[color:var(--success-200)] bg-[color:var(--success-50)] text-[var(--success-900)]",
        tone === "warning" && "border-[color:var(--warning-200)] bg-[color:var(--warning-50)] text-[var(--warning-900)]",
        tone === "danger" && "border-[color:var(--danger-200)] bg-[color:var(--danger-50)] text-[var(--danger-900)]",
      )}
    >
      {label}
    </span>
  );
}
