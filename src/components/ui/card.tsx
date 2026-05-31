import { cn } from "@/lib/utils";

export function Card({
  className,
  children,
  style,
}: {
  className?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={cn(
        "tenant-card rounded-[28px] border border-[var(--line)] bg-[var(--tenant-card,#fff)] shadow-[0_18px_60px_rgba(15,23,42,0.06)]",
        className,
      )}
      style={{
        borderRadius: "var(--tenant-card-radius, 28px)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
