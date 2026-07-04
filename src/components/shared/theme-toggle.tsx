"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "estateos-theme";
const CHANGE_EVENT = "estateos:theme-change";

export function isDarkTheme() {
  return typeof document !== "undefined" && document.documentElement.classList.contains("theme-dark");
}

export function setDarkTheme(dark: boolean) {
  document.documentElement.classList.toggle("theme-dark", dark);
  try {
    localStorage.setItem(STORAGE_KEY, dark ? "dark" : "light");
  } catch {
    // localStorage unavailable (private mode / blocked) — theme still applies for the session.
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: dark }));
}

export function toggleTheme() {
  setDarkTheme(!isDarkTheme());
}

/**
 * Light/dark theme toggle for the operator dashboards. Flips `theme-dark` on
 * <html> (the visual change is gated behind `.app-dark-scope`, so only the
 * dashboards respond) and persists the choice. A FOUC-prevention script in the
 * root layout applies the stored value before first paint.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    // Deferred so it is not a synchronous setState in the effect body.
    const frame = requestAnimationFrame(() => setDark(isDarkTheme()));
    function onChange(event: Event) {
      setDark((event as CustomEvent<boolean>).detail);
    }
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener(CHANGE_EVENT, onChange);
    };
  }, []);

  return (
    <button
      type="button"
      onClick={() => toggleTheme()}
      aria-pressed={dark}
      className={`admin-interactive admin-focus inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--line)] text-[var(--ink-600)] hover:text-[var(--ink-900)] ${className ?? ""}`}
    >
      <span className="sr-only">{dark ? "Switch to light theme" : "Switch to dark theme"}</span>
      {dark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

function MoonIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}
