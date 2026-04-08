import { Badge } from "@/components/ui/badge";

export function SuperadminCompanyStatusBadge({
  status,
}: {
  status: "ACTIVE" | "SUSPENDED" | "DISABLED";
}) {
  const styles = {
    ACTIVE: "bg-emerald-100 text-emerald-800",
    SUSPENDED: "bg-rose-100 text-rose-800",
    DISABLED: "bg-slate-200 text-slate-700",
  } as const;

  return <Badge className={styles[status]}>{status.toLowerCase()}</Badge>;
}
