export function parseFlexibleNumber(value: unknown) {
  if (value == null) {
    return undefined;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value
    .trim()
    .replace(/,/g, "")
    .replace(/[^\d.-]/g, "");

  if (!normalized || normalized === "." || normalized === "-" || normalized === "-.") {
    return undefined;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

