import { cn } from "@/lib/utils";

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "admin-interactive admin-focus min-h-28 w-full rounded-[var(--radius-md)] border border-[var(--line)] bg-white px-4 py-3 text-sm text-[var(--ink-900)] placeholder:text-[var(--ink-500)] focus:border-[var(--brand-500)] disabled:cursor-not-allowed disabled:bg-[var(--sand-50)] disabled:text-[var(--ink-500)]",
        className,
      )}
      {...props}
    />
  );
}
