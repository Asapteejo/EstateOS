import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-full text-sm font-semibold transition disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-[var(--brand-700)] text-white hover:bg-[var(--brand-800)]",
        secondary:
          "bg-white/80 text-[var(--ink-900)] ring-1 ring-black/10 hover:bg-white",
        ghost: "text-[var(--ink-900)] hover:bg-black/5",
        outline:
          "border border-[var(--line)] bg-transparent text-[var(--ink-900)] hover:bg-[var(--sand-100)]",
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
    VariantProps<typeof buttonVariants> {}

export function Button({
  className,
  variant,
  size,
  style,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      style={{
        borderRadius: "var(--tenant-button-radius, 999px)",
        ...style,
      }}
      {...props}
    />
  );
}
