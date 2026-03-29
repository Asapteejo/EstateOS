import { cn } from "@/lib/utils";

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-[28px] border border-[var(--line)] bg-white shadow-[0_18px_60px_rgba(15,23,42,0.06)]",
        className,
      )}
    >
      {children}
    </div>
  );
}
