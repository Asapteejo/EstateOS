import { MessageCircle } from "lucide-react";

import { buildWhatsAppHref } from "@/modules/team/contact";

/**
 * Click-to-chat WhatsApp button. Opens wa.me for the given phone with an
 * optional prefilled message so an operator can message a buyer from their own
 * WhatsApp — no credentials or wallet required. Renders nothing if the phone is
 * missing/invalid.
 */
export function WhatsAppButton({
  phone,
  message,
  label = "WhatsApp",
  className,
}: {
  phone: string | null | undefined;
  message?: string;
  label?: string;
  className?: string;
}) {
  const base = buildWhatsAppHref(phone);
  if (!base) return null;
  const href = message ? `${base}?text=${encodeURIComponent(message)}` : base;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Message on WhatsApp`}
      className={
        className ??
        "admin-focus inline-flex shrink-0 items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--success-200)] bg-[var(--success-50)] px-2.5 py-1.5 text-xs font-medium text-[var(--success-700)] transition-colors hover:bg-[var(--success-100,#dcfce7)]"
      }
    >
      <MessageCircle className="h-3.5 w-3.5" aria-hidden />
      {label}
    </a>
  );
}
