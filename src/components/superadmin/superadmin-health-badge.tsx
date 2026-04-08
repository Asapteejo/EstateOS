import { Badge } from "@/components/ui/badge";

export function SuperadminHealthBadge({
  health,
}: {
  health: "healthy" | "collections_risk" | "inactive" | "onboarding_incomplete" | "high_value";
}) {
  const styles = {
    healthy: "bg-emerald-100 text-emerald-800",
    collections_risk: "bg-rose-100 text-rose-800",
    inactive: "bg-slate-200 text-slate-700",
    onboarding_incomplete: "bg-amber-100 text-amber-800",
    high_value: "bg-[var(--brand-100)] text-[var(--brand-800)]",
  } as const;

  const labels = {
    healthy: "Healthy",
    collections_risk: "Collections risk",
    inactive: "Inactive",
    onboarding_incomplete: "Onboarding incomplete",
    high_value: "High value",
  } as const;

  return <Badge className={styles[health]}>{labels[health]}</Badge>;
}
