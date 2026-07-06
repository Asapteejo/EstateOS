"use client";

import { createContext, useContext, useId, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Accessible tabs primitive (WAI-ARIA tabs pattern): roving tabindex,
 * Arrow/Home/End keyboard navigation, automatic activation, and correct
 * role/aria wiring. Shared so per-screen tab implementations stop drifting.
 *
 * Usage:
 *   <Tabs defaultValue="details">
 *     <TabList>
 *       <Tab value="details">Details</Tab>
 *       <Tab value="history">History</Tab>
 *     </TabList>
 *     <TabPanel value="details">…</TabPanel>
 *     <TabPanel value="history">…</TabPanel>
 *   </Tabs>
 */

type TabsContextValue = {
  value: string;
  setValue: (value: string) => void;
  baseId: string;
};

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext(component: string): TabsContextValue {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error(`${component} must be used inside <Tabs>.`);
  }
  return context;
}

export function Tabs({
  defaultValue,
  value: controlledValue,
  onValueChange,
  children,
  className,
}: {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}) {
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue ?? "");
  const baseId = useId();
  const value = controlledValue ?? uncontrolledValue;
  const setValue = (next: string) => {
    if (controlledValue === undefined) {
      setUncontrolledValue(next);
    }
    onValueChange?.(next);
  };

  return (
    <TabsContext.Provider value={{ value, setValue, baseId }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabList({
  children,
  className,
  "aria-label": ariaLabel,
}: {
  children: React.ReactNode;
  className?: string;
  "aria-label"?: string;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    const tabs = listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]:not([disabled])');
    if (!tabs || tabs.length === 0) {
      return;
    }
    const list = Array.from(tabs);
    const currentIndex = list.findIndex((tab) => tab === document.activeElement);
    let nextIndex: number | null = null;

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % list.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = currentIndex < 0 ? list.length - 1 : (currentIndex - 1 + list.length) % list.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = list.length - 1;
    }

    if (nextIndex !== null) {
      event.preventDefault();
      list[nextIndex].focus();
      list[nextIndex].click();
    }
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
      className={cn(
        "inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--sand-50)] p-1",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Tab({
  value,
  children,
  disabled,
  className,
}: {
  value: string;
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  const { value: activeValue, setValue, baseId } = useTabsContext("Tab");
  const isActive = activeValue === value;

  return (
    <button
      type="button"
      role="tab"
      id={`${baseId}-tab-${value}`}
      aria-selected={isActive}
      aria-controls={`${baseId}-panel-${value}`}
      tabIndex={isActive ? 0 : -1}
      disabled={disabled}
      onClick={() => setValue(value)}
      className={cn(
        "admin-focus whitespace-nowrap rounded-[calc(var(--radius-md)-4px)] px-4 py-2 text-sm font-medium transition-[background,color,box-shadow] duration-[var(--duration-fast)] ease-[var(--ease-standard)]",
        isActive
          ? "bg-white text-[var(--ink-950)] shadow-[var(--shadow-sm)]"
          : "text-[var(--ink-500)] hover:text-[var(--ink-900)]",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function TabPanel({
  value,
  children,
  className,
}: {
  value: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { value: activeValue, baseId } = useTabsContext("TabPanel");
  if (activeValue !== value) {
    return null;
  }

  return (
    <div
      role="tabpanel"
      id={`${baseId}-panel-${value}`}
      aria-labelledby={`${baseId}-tab-${value}`}
      tabIndex={0}
      className={cn("admin-focus mt-4", className)}
    >
      {children}
    </div>
  );
}
