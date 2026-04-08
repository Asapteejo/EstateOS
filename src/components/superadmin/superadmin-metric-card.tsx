import { Card } from "@/components/ui/card";

export function SuperadminMetricCard({
  label,
  value,
  detail,
  tone = "default",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "default" | "revenue" | "risk";
}) {
  const toneStyles = {
    default: "text-[var(--brand-700)]",
    revenue: "text-emerald-700",
    risk: "text-rose-700",
  } as const;

  return (
    <Card className="p-6">
      <div className="text-sm text-[var(--ink-500)]">{label}</div>
      <div className="mt-3 text-3xl font-semibold tracking-tight text-[var(--ink-950)]">{value}</div>
      <div className={`mt-3 text-sm ${toneStyles[tone]}`}>{detail}</div>
    </Card>
  );
}
