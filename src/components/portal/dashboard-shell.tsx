import Link from "next/link";

import { Container } from "@/components/shared/container";
import { Logo } from "@/components/shared/logo";
import { cn } from "@/lib/utils";

const portalLinks = [
  ["Overview", "/portal"],
  ["Profile", "/portal/profile"],
  ["KYC", "/portal/kyc"],
  ["Saved", "/portal/saved"],
  ["Reservations", "/portal/reservations"],
  ["Payments", "/portal/payments"],
  ["Timeline", "/portal/timeline"],
  ["Notifications", "/portal/notifications"],
  ["Documents", "/portal/documents"],
  ["Support", "/portal/support"],
] as const;

const adminLinks = [
  ["Overview", "/admin"],
  ["Listings", "/admin/listings"],
  ["Team", "/admin/team"],
  ["Leads", "/admin/leads"],
  ["Bookings", "/admin/bookings"],
  ["Clients", "/admin/clients"],
  ["Transactions", "/admin/transactions"],
  ["Payments", "/admin/payments"],
  ["Billing", "/admin/billing"],
  ["Documents", "/admin/documents"],
  ["Notifications", "/admin/notifications"],
  ["Analytics", "/admin/analytics"],
  ["Audit Logs", "/admin/audit-logs"],
] as const;

export function DashboardShell({
  area,
  title,
  subtitle,
  children,
}: {
  area: "portal" | "admin";
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const links = area === "portal" ? portalLinks : adminLinks;

  return (
    <Container className="grid gap-6 py-8 lg:grid-cols-[260px_1fr]">
      <aside className="rounded-[28px] border border-[var(--line)] bg-white p-5">
        <Logo href={`/${area}`} />
        <div className="mt-8 space-y-2">
          {links.map(([label, href]) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "block rounded-2xl px-4 py-3 text-sm font-medium text-[var(--ink-700)] transition hover:bg-[var(--sand-100)]",
                href === `/${area}` && "bg-[var(--sand-100)] text-[var(--ink-950)]",
              )}
            >
              {label}
            </Link>
          ))}
        </div>
      </aside>
      <div className="space-y-6">
        <div>
          <h1 className="font-serif text-4xl text-[var(--ink-950)]">{title}</h1>
          <p className="mt-2 text-sm leading-7 text-[var(--ink-600)]">{subtitle}</p>
        </div>
        {children}
      </div>
    </Container>
  );
}
