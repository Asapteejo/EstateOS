export function sanitizeWhatsAppNumber(value?: string | null) {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/[^\d+]/g, "");
  if (!normalized) {
    return null;
  }

  return normalized.startsWith("+") ? normalized.slice(1) : normalized;
}

export function buildWhatsAppHref(value?: string | null) {
  const number = sanitizeWhatsAppNumber(value);
  if (!number) {
    return null;
  }

  return `https://wa.me/${number}`;
}

export function buildMailtoHref(value?: string | null) {
  if (!value || !value.includes("@")) {
    return null;
  }

  return `mailto:${value}`;
}
