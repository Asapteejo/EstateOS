import { buildWhatsAppHref } from "@/modules/team/contact";

/**
 * Site-wide floating "Chat with us on WhatsApp" bubble for tenant public pages.
 * Opens wa.me for the company's WhatsApp number with a prefilled buyer message.
 * Renders nothing when the number is missing/invalid. Server-safe (no client JS).
 */
export function FloatingWhatsApp({
  phone,
  message = "Hi, I'd like to know more about your properties.",
}: {
  phone: string | null | undefined;
  message?: string;
}) {
  const base = buildWhatsAppHref(phone);
  if (!base) return null;
  const href = `${base}?text=${encodeURIComponent(message)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      className="admin-focus fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_8px_24px_rgba(0,0,0,0.22)] transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#25D366]"
    >
      <svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor" aria-hidden="true">
        <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 2.1.55 4.15 1.6 5.96L2 22l4.25-1.68a9.86 9.86 0 0 0 5.79 1.85h.01c5.46 0 9.9-4.45 9.9-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 1.8c2.16 0 4.19.84 5.72 2.37a8.06 8.06 0 0 1 2.37 5.74c0 4.46-3.63 8.09-8.1 8.09a8.1 8.1 0 0 1-4.12-1.13l-.3-.18-2.52 1 .67-2.46-.19-.31a8.03 8.03 0 0 1-1.24-4.3c0-4.46 3.63-8.09 8.1-8.09Zm-4.53 4.4c-.21 0-.55.08-.84.39-.29.31-1.1 1.08-1.1 2.63s1.13 3.05 1.29 3.26c.16.21 2.22 3.39 5.38 4.75.75.32 1.34.51 1.8.66.75.24 1.44.21 1.98.13.6-.09 1.86-.76 2.12-1.49.26-.73.26-1.36.18-1.49-.08-.13-.29-.21-.6-.37-.31-.16-1.86-.92-2.15-1.02-.29-.11-.5-.16-.71.16-.21.31-.81 1.02-1 1.23-.18.21-.37.24-.68.08-.31-.16-1.32-.49-2.51-1.55-.93-.83-1.56-1.85-1.74-2.16-.18-.31-.02-.48.14-.63.14-.14.31-.37.47-.55.16-.18.21-.31.31-.52.11-.21.05-.39-.03-.55-.08-.16-.71-1.72-.98-2.35-.26-.62-.52-.53-.71-.54-.18-.01-.39-.01-.6-.01Z" />
      </svg>
    </a>
  );
}
