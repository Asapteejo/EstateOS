import { cn } from "@/lib/utils";

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-28 w-full rounded-3xl border border-[var(--line)] bg-white px-4 py-3 text-sm text-[var(--ink-900)] outline-none placeholder:text-[var(--ink-500)] focus:border-[var(--brand-500)]",
        className,
      )}
      {...props}
    />
  );
}
