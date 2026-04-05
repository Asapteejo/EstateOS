import Link from "next/link";

import { Container } from "@/components/shared/container";
import { Logo } from "@/components/shared/logo";
import { requireAdminSession, requirePortalSession } from "@/lib/auth/guards";
import { getTenantPresentation } from "@/modules/branding/service";
import { cn } from "@/lib/utils";

const portalLinks = [
  ["Overview", "/portal"],
  ["Profile", "/portal/profile"],
  ["KYC", "/portal/kyc"],
  ["Saved", "/portal/saved"],
  ["Inspections", "/portal/inspections"],
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
  ["Marketers", "/admin/marketers"],
  ["Leads", "/admin/leads"],
  ["Pipeline", "/admin/pipeline"],
  ["Bookings", "/admin/bookings"],
  ["Clients", "/admin/clients"],
  ["Transactions", "/admin/transactions"],
  ["Payments", "/admin/payments"],
  ["Assets", "/admin/assets"],
  ["Billing", "/admin/billing"],
  ["Settings", "/admin/settings"],
  ["Documents", "/admin/documents"],
  ["Notifications", "/admin/notifications"],
  ["Analytics", "/admin/analytics"],
  ["Audit Logs", "/admin/audit-logs"],
] as const;

export async function DashboardShell({
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
  const tenant = area === "portal"
    ? await requirePortalSession({ redirectOnMissingAuth: false })
    : await requireAdminSession(["ADMIN"], { redirectOnMissingAuth: false });
  const presentation = await getTenantPresentation(tenant);
  const branding = presentation.branding;

  return (
    <Container className="grid gap-6 py-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:py-8">
      <aside className="rounded-[var(--tenant-card-radius,28px)] border border-[var(--tenant-nav-border)] bg-[var(--tenant-nav-surface)] p-5 shadow-[var(--tenant-nav-shadow)] lg:sticky lg:top-6 lg:self-start">
        <Logo href={`/${area}`} name={presentation.companyName} tagline={area === "portal" ? "Buyer workspace" : "Company workspace"} logoUrl={branding.logoUrl} />
        <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:mt-8 lg:block lg:space-y-2">
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
      <div className="min-w-0 space-y-6">
        <div>
          <h1 className="font-serif text-3xl text-[var(--ink-950)] sm:text-4xl">{title}</h1>
          <p className="mt-2 text-sm leading-7 text-[var(--ink-600)]">{subtitle}</p>
        </div>
        {children}
      </div>
    </Container>
  );
}
