import { cn } from "@/lib/utils";

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        // text-base (16px) below `sm`: iOS Safari zooms the whole page when a
        // focused field is under 16px, which is why every form felt like it
        // "jumped" on a phone. Desktop keeps the denser 14px.
        "admin-interactive admin-focus h-11 w-full rounded-[var(--radius-md)] border border-[var(--line)] bg-white px-4 text-base text-[var(--ink-900)] placeholder:text-[var(--ink-500)] focus:border-[var(--brand-500)] disabled:cursor-not-allowed disabled:bg-[var(--sand-50)] disabled:text-[var(--ink-500)] sm:text-sm",
        className,
      )}
      {...props}
    />
  );
}
