"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";

import { toggleTheme } from "@/components/shared/theme-toggle";

const THEME_COMMAND_ID = "__toggle-theme";

export type CommandItem = {
  id: string;
  label: string;
  href: string;
  group?: string;
  keywords?: string;
};

const OPEN_EVENT = "estateos:command-open";

/** Dispatch this to open the palette from anywhere (e.g. a trigger button). */
export function openCommandPalette() {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT));
}

/**
 * Keyboard-first command palette for the operator dashboards. Opens on
 * Cmd/Ctrl+K (or the `estateos:command-open` event), filters pages and quick
 * actions, and navigates on select.
 *
 * Accessibility: role="dialog" + aria-modal, a combobox input wired to a
 * listbox via aria-activedescendant, full arrow/Enter/Escape keyboard support,
 * body-scroll lock, focus moved to the input on open and restored to the
 * trigger on close. Entrance motion reuses the shared overlay/panel classes,
 * which the global reduced-motion reset neutralizes.
 *
 * State that resets per-open (query, selection) is reset in the open/change
 * handlers rather than in effects, to avoid synchronous setState-in-effect.
 */
export function CommandPalette({
  commands,
  label = "Command menu",
}: {
  commands: CommandItem[];
  label?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const openRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const allCommands = useMemo<CommandItem[]>(
    () => [
      ...commands,
      {
        id: THEME_COMMAND_ID,
        label: "Toggle theme (light / dark)",
        href: "",
        group: "Theme",
        keywords: "dark light appearance mode",
      },
    ],
    [commands],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return allCommands;
    }
    return allCommands.filter((command) =>
      `${command.label} ${command.group ?? ""} ${command.keywords ?? ""}`.toLowerCase().includes(q),
    );
  }, [allCommands, query]);

  const openPalette = useCallback(() => {
    setQuery("");
    setActiveIndex(0);
    openRef.current = true;
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    openRef.current = false;
    setOpen(false);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (openRef.current) {
          close();
        } else {
          openPalette();
        }
      }
    }
    function onOpen() {
      openPalette();
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, [openPalette, close]);

  // Open side-effects only (focus, scroll lock, focus restore) — no setState.
  useEffect(() => {
    if (!open) {
      return;
    }
    returnFocusRef.current = (document.activeElement as HTMLElement) ?? null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      returnFocusRef.current?.focus?.();
    };
  }, [open]);

  // Keep the active option scrolled into view (DOM sync, no setState).
  useEffect(() => {
    if (!open) {
      return;
    }
    const active = filtered[activeIndex];
    if (active) {
      document.getElementById(`cmd-${active.id}`)?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex, filtered, open]);

  const run = useCallback(
    (item: CommandItem | undefined) => {
      if (!item) {
        return;
      }
      close();
      if (item.id === THEME_COMMAND_ID) {
        toggleTheme();
        return;
      }
      router.push(item.href);
    },
    [router, close],
  );

  function onInputKeyDown(event: ReactKeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, filtered.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      run(filtered[activeIndex]);
    }
  }

  if (!open) {
    return null;
  }

  const activeId = filtered[activeIndex] ? `cmd-${filtered[activeIndex].id}` : undefined;

  return (
    <div
      className="fixed inset-0 z-[1500] flex items-start justify-center px-4 pt-[12vh]"
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      <div className="motion-overlay absolute inset-0 bg-[rgba(15,23,42,0.45)]" onClick={close} aria-hidden="true" />
      <div className="motion-panel relative w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-[var(--shadow-md)]">
        <div className="flex items-center gap-3 border-b border-[var(--line)] px-4">
          <SearchIcon />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={onInputKeyDown}
            placeholder="Search pages and actions…"
            className="h-12 w-full bg-transparent text-sm text-[var(--ink-900)] outline-none placeholder:text-[var(--ink-400)]"
            role="combobox"
            aria-expanded="true"
            aria-controls="command-list"
            aria-activedescendant={activeId}
            aria-label="Search commands"
          />
          <kbd className="hidden rounded border border-[var(--line)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--ink-500)] sm:inline">
            Esc
          </kbd>
        </div>
        <div id="command-list" role="listbox" aria-label={label} className="max-h-[52vh] overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <div className="px-3 py-10 text-center text-sm text-[var(--ink-500)]">
              No matches for “{query}”.
            </div>
          ) : (
            filtered.map((item, index) => (
              <button
                key={item.id}
                id={`cmd-${item.id}`}
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                onMouseMove={() => setActiveIndex(index)}
                onClick={() => run(item)}
                className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                  index === activeIndex
                    ? "bg-[var(--sand-100)] text-[var(--ink-950)]"
                    : "text-[var(--ink-700)]"
                }`}
              >
                <span className="truncate font-medium">{item.label}</span>
                {item.group ? (
                  <span className="shrink-0 text-xs text-[var(--ink-400)]">{item.group}</span>
                ) : null}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Discoverable trigger for the palette. Opens it via the shared event so it can
 * be dropped into any shell without prop-drilling open state.
 */
export function CommandPaletteTrigger({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => openCommandPalette()}
      className={`admin-interactive admin-focus inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--line)] bg-white/70 px-3 py-2 text-sm text-[var(--ink-500)] hover:text-[var(--ink-800)] ${className ?? ""}`}
    >
      <SearchIcon />
      <span className="flex-1 text-left">Search…</span>
      <kbd className="rounded border border-[var(--line)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--ink-500)]">
        ⌘K
      </kbd>
    </button>
  );
}

function SearchIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 text-[var(--ink-400)]"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
