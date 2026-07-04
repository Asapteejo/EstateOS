"use client";

import { cloneElement, isValidElement, useId } from "react";
import type { ReactElement, ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Accessible form field wrapper.
 *
 * Wires a visible `<label>` to its control, generates a stable id, and ties
 * optional helper text and a field-level error to the control via
 * `aria-describedby`. The error is announced to screen readers (`role="alert"`)
 * and sets `aria-invalid` on the control.
 *
 * Pass a single control element as the child (e.g. <Input/>, <Textarea/>, or a
 * native input/select). The id and aria-* attributes are injected automatically,
 * so consumers should NOT set their own `id` on the control.
 *
 * Usage:
 *   <Field label="Email address" required error={errors.email}>
 *     <Input name="email" type="email" autoComplete="email" />
 *   </Field>
 */
export function Field({
  label,
  required = false,
  hint,
  error,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
  children: ReactElement;
}) {
  const baseId = useId();
  const controlId = `${baseId}-control`;
  const hintId = hint ? `${baseId}-hint` : undefined;
  const errorId = error ? `${baseId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, {
        id: controlId,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
        "aria-required": required || undefined,
      })
    : children;

  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={controlId} className="block text-sm font-medium text-[var(--ink-700)]">
        {label}
        {required ? (
          <span className="ml-0.5 text-[#b91c1c]" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      {control}
      {hint ? (
        <p id={hintId} className="text-xs leading-5 text-[var(--ink-500)]">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-xs font-medium text-[#b91c1c]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
