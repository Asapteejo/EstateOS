import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "admin-focus inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold transition-[background,box-shadow,transform] duration-[var(--duration-fast)] ease-[var(--ease-standard)] hover:-translate-y-px active:translate-y-0 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 disabled:saturate-50 disabled:hover:translate-y-0",
  {
    variants: {
      variant: {
        default: "bg-[var(--brand-700)] text-white shadow-[var(--shadow-xs)] hover:bg-[var(--brand-800)] hover:shadow-[var(--shadow-md)]",
        secondary:
          "border border-[var(--border-subtle)] bg-white/85 text-[var(--ink-900)] shadow-[var(--shadow-xs)] hover:bg-white hover:shadow-[var(--shadow-sm)]",
        ghost: "text-[var(--ink-900)] hover:bg-black/5",
        outline:
          "border border-[var(--border-subtle)] bg-transparent text-[var(--ink-900)] shadow-[var(--shadow-xs)] hover:bg-[var(--sand-100)] hover:shadow-[var(--shadow-sm)]",
      },
      size: {
        default: "h-11 px-5",
        lg: "h-12 px-6",
        sm: "h-9 px-4",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /**
   * When true, shows an inline spinner, marks the button busy, and prevents
   * activation — the standard pattern for an action that is in flight.
   */
  loading?: boolean;
}

export function Button({
  className,
  variant,
  size,
  style,
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      style={{
        borderRadius: "var(--tenant-button-radius, 999px)",
        ...style,
      }}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
}
