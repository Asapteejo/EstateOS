import { cn } from "@/lib/utils";

type TimelineItem = {
  title: string;
  description: string;
  status: "completed" | "active" | "pending";
  date: string;
};

/** Text labels so milestone status is never conveyed by dot color alone. */
const STATUS_LABEL: Record<TimelineItem["status"], string> = {
  completed: "Completed",
  active: "In progress",
  pending: "Upcoming",
};

const STATUS_CHIP: Record<TimelineItem["status"], string> = {
  completed: "bg-[var(--brand-50)] text-[var(--brand-ink)]",
  active: "bg-[var(--amber-50)] text-[var(--amber-700)]",
  pending: "bg-[var(--sand-100)] text-[var(--ink-600)]",
};

export function Timeline({ items }: { items: readonly TimelineItem[] }) {
  return (
    <div className="space-y-6">
      {items.map((item) => (
        <div key={item.title} className="grid grid-cols-[auto_1fr] gap-4">
          <div className="flex flex-col items-center">
            <div
              className={cn(
                "h-4 w-4 rounded-full border-4",
                item.status === "completed" &&
                  "border-[var(--brand-700)] bg-[var(--brand-700)]",
                item.status === "active" && "border-[var(--brand-700)] bg-white",
                item.status === "pending" && "border-[var(--line)] bg-white",
              )}
            />
            <div className="mt-2 h-full w-px bg-[var(--line)]" />
          </div>
          <div className="-mx-3 mb-6 rounded-[var(--radius-md)] px-3 py-2 transition-colors duration-[var(--duration)] hover:bg-[var(--brand-50)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-[var(--ink-950)]">{item.title}</h3>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
                    STATUS_CHIP[item.status],
                  )}
                >
                  {STATUS_LABEL[item.status]}
                </span>
                <span className="text-sm text-[var(--ink-500)]">{item.date}</span>
              </div>
            </div>
            <p className="mt-2 text-sm leading-6 text-[var(--ink-600)]">{item.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
