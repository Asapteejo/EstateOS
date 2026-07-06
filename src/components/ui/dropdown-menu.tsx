"use client";

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import { cn } from "@/lib/utils";

/**
 * Accessible dropdown menu primitive (WAI-ARIA menu-button pattern): outside
 * click + Escape to dismiss, ArrowUp/ArrowDown/Home/End to move, focus
 * returns to the trigger on close. Replaces per-screen "row actions" menus.
 *
 * Usage:
 *   <DropdownMenu>
 *     <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
 *     <DropdownMenuContent align="end">
 *       <DropdownMenuItem onSelect={...}>Edit</DropdownMenuItem>
 *       <DropdownMenuItem destructive onSelect={...}>Archive</DropdownMenuItem>
 *     </DropdownMenuContent>
 *   </DropdownMenu>
 */

type DropdownContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  contentRef: React.RefObject<HTMLDivElement | null>;
  menuId: string;
};

const DropdownContext = createContext<DropdownContextValue | null>(null);

function useDropdownContext(component: string): DropdownContextValue {
  const context = useContext(DropdownContext);
  if (!context) {
    throw new Error(`${component} must be used inside <DropdownMenu>.`);
  }
  return context;
}

export function DropdownMenu({ children, className }: { children: React.ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();

  // Outside click + Escape dismissal while open.
  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!contentRef.current?.contains(target) && !triggerRef.current?.contains(target)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }

      if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Home" || event.key === "End") {
        const items = contentRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])');
        if (!items || items.length === 0) {
          return;
        }
        event.preventDefault();
        const list = Array.from(items);
        const currentIndex = list.findIndex((item) => item === document.activeElement);
        const nextIndex =
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? list.length - 1
              : event.key === "ArrowDown"
                ? currentIndex < 0
                  ? 0
                  : (currentIndex + 1) % list.length
                : currentIndex < 0
                  ? list.length - 1
                  : (currentIndex - 1 + list.length) % list.length;
        list[nextIndex].focus();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    // Move focus to the first item on open, per the menu-button pattern.
    const firstItem = contentRef.current?.querySelector<HTMLElement>('[role="menuitem"]');
    firstItem?.focus();

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <DropdownContext.Provider value={{ open, setOpen, triggerRef, contentRef, menuId }}>
      <div className={cn("relative inline-flex", className)}>{children}</div>
    </DropdownContext.Provider>
  );
}

export function DropdownMenuTrigger({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { open, setOpen, triggerRef, menuId } = useDropdownContext("DropdownMenuTrigger");

  return (
    <button
      ref={triggerRef}
      type="button"
      aria-haspopup="menu"
      aria-expanded={open}
      aria-controls={open ? menuId : undefined}
      onClick={() => setOpen(!open)}
      className={cn(
        "admin-interactive admin-focus inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--line)] bg-white px-3 text-sm font-medium text-[var(--ink-700)] hover:bg-[var(--sand-100)] hover:text-[var(--ink-950)]",
        className,
      )}
    >
      {children}
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className={cn("transition-transform duration-150", open && "rotate-180")}
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>
  );
}

export function DropdownMenuContent({
  children,
  align = "start",
  className,
}: {
  children: React.ReactNode;
  align?: "start" | "end";
  className?: string;
}) {
  const { open, contentRef, menuId } = useDropdownContext("DropdownMenuContent");
  if (!open) {
    return null;
  }

  return (
    <div
      ref={contentRef}
      id={menuId}
      role="menu"
      className={cn(
        "motion-dropdown absolute top-full z-40 mt-2 min-w-44 overflow-hidden rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface)] p-1.5 shadow-[var(--shadow-lg)]",
        align === "end" ? "right-0" : "left-0",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function DropdownMenuItem({
  children,
  onSelect,
  disabled,
  destructive,
  className,
}: {
  children: React.ReactNode;
  onSelect?: () => void;
  disabled?: boolean;
  destructive?: boolean;
  className?: string;
}) {
  const { setOpen, triggerRef } = useDropdownContext("DropdownMenuItem");

  return (
    <button
      type="button"
      role="menuitem"
      aria-disabled={disabled || undefined}
      disabled={disabled}
      onClick={() => {
        if (disabled) {
          return;
        }
        setOpen(false);
        triggerRef.current?.focus();
        onSelect?.();
      }}
      className={cn(
        "admin-focus flex w-full items-center gap-2 rounded-[calc(var(--radius-md)-6px)] px-3 py-2 text-left text-sm font-medium",
        destructive
          ? "text-[var(--danger-700)] hover:bg-[var(--danger-50)]"
          : "text-[var(--ink-700)] hover:bg-[var(--sand-100)] hover:text-[var(--ink-950)]",
        disabled && "cursor-not-allowed opacity-50 hover:bg-transparent",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function DropdownMenuSeparator({ className }: { className?: string }) {
  return <div role="separator" className={cn("my-1.5 h-px bg-[var(--line)]", className)} />;
}
