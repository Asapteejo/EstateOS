import { cn } from "@/lib/utils";

type TimelineItem = {
  title: string;
  description: string;
  status: "completed" | "active" | "pending";
  date: string;
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
          <div className="pb-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-[var(--ink-950)]">{item.title}</h3>
              <span className="text-sm text-[var(--ink-500)]">{item.date}</span>
            </div>
            <p className="mt-2 text-sm leading-6 text-[var(--ink-600)]">{item.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
