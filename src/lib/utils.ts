import { clsx, type ClassValue } from "clsx";
import { format } from "date-fns";
import { twMerge } from "tailwind-merge";

export const SUPPORTED_CURRENCIES = ["NGN", "USD", "GBP", "EUR", "GHS", "KES", "ZAR", "XOF", "XAF"] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number, currency: string = "NGN") {
  const safeCurrency = SUPPORTED_CURRENCIES.includes(currency as SupportedCurrency) ? currency : "NGN";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: safeCurrency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(value: Date | string, pattern = "PPP") {
  return format(typeof value === "string" ? new Date(value) : value, pattern);
}

export function formatStableDate(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function initials(first?: string | null, last?: string | null) {
  return `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase() || "RE";
}
