import Link from "next/link";
import { unstable_cache } from "next/cache";

import { Container } from "@/components/shared/container";
import { Logo } from "@/components/shared/logo";
import { DashboardMobileNav } from "@/components/portal/dashboard-mobile-nav";
import { LiveSurfaceSync } from "@/components/realtime/live-surface-sync";
import { Avatar } from "@/components/ui/avatar";
import { requireAdminSession, requirePortalSession } from "@/lib/auth/guards";
import { getAppSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";
import { buildSafeErrorLogContext, logError } from "@/lib/ops/logger";
import { getTenantPresentation } from "@/modules/branding/service";
import { resolveBuyerTenantContextForKyc } from "@/modules/kyc/buyer-user";
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
  ["Contracts", "/portal/contracts"],
  ["Testimonials", "/portal/testimonials"],
  ["Notifications", "/portal/notifications"],
  ["Documents", "/portal/documents"],
  ["Support", "/portal/support"],
] as const;

const adminLinks = [
  ["Deal Board", "/admin"],
  ["Payments", "/admin/payments"],
  ["Clients", "/admin/clients"],
  ["Leads", "/admin/leads"],
  ["Transactions", "/admin/transactions"],
  ["Pipeline", "/admin/pipeline"],
  ["Analytics", "/admin/analytics"],
  ["Benchmarks", "/admin/benchmarks"],
  ["Feasibility", "/admin/feasibility"],
  ["Contracts", "/admin/contracts"],
  ["Listings", "/admin/listings"],
  ["Team", "/admin/team"],
  ["Marketers", "/admin/marketers"],
  ["Bookings", "/admin/bookings"],
  ["Assets", "/admin/assets"],
  ["Billing", "/admin/billing"],
  ["Settings", "/admin/settings"],
  ["Documents", "/admin/documents"],
  ["Testimonials", "/admin/testimonials"],
  ["Notifications", "/admin/notifications"],
  ["Audit Logs", "/admin/audit-logs"],
] as const;

type PortalUserRow = {
  firstName: string | null;
  lastName: string | null;
  email: string;
  profileImageUrl: string | null;
};

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
  // Tenant branding/presentation is company-level data (identical for every user
  // of the company) and changes only when an admin publishes branding. Cache it
  // briefly per company so it is not re-queried on every page navigation. The
  // cache is keyed by companyId to preserve tenant isolation; it is invalidated
  // immediately via the `tenant-presentation:<companyId>` tag when branding is
  // published (see publishDraftBrandingForAdmin) and is otherwise bounded by the
  // 60s TTL. No user-specific data is stored here.
  const loadPresentation = tenant.companyId
    ? unstable_cache(
        () => getTenantPresentation(tenant),
        ["dashboard-tenant-presentation", tenant.companyId, tenant.companySlug ?? "none"],
        { revalidate: 60, tags: [`tenant-presentation:${tenant.companyId}`] },
      )
    : () => getTenantPresentation(tenant);

  // getAppSession reads request cookies (dynamic) and is never cached. It is
  // independent of presentation, so resolve the two concurrently.
  const [presentation, appSession] = await Promise.all([
    loadPresentation(),
    area === "portal" ? getAppSession("portal") : Promise.resolve(null),
  ]);
  const branding = presentation.branding;

  const profileTenant =
    area === "portal" && tenant.roles.includes("BUYER")
      ? await resolveBuyerTenantContextForKyc(tenant, { email: appSession?.email }).catch(() => tenant)
      : tenant;

  const notificationCompanyId = tenant.companyId;
  const notificationUserId = area === "portal" ? profileTenant.userId : tenant.userId;

  // The buyer identity row and the unread-notification count both depend only on
  // profileTenant, so fetch them concurrently rather than sequentially. The
  // notification count is per-user and changes frequently, so it is cached only
  // very briefly (15s) and keyed by companyId + userId (tenant- and user-scoped)
  // — enough to absorb rapid re-navigation without showing a materially stale
  // badge. See the invalidation caveat in the change notes.
  const [portalUserRows, unreadNotificationCount] = await Promise.all([
    area === "portal" && featureFlags.hasDatabase && profileTenant.userId && profileTenant.companyId
      ? prisma.$queryRaw<PortalUserRow[]>`
            SELECT "firstName", "lastName", "email", "profileImageUrl"
            FROM "User"
            WHERE "id" = ${profileTenant.userId}
              AND "companyId" = ${profileTenant.companyId}
            LIMIT 1
          `.catch((error) => {
            logError("Dashboard shell buyer identity lookup failed; using empty state.", {
              route: `/${area}`,
              component: "DashboardShell",
              queryName: "portal-user",
              ...buildSafeErrorLogContext(error),
            });
            return [] as PortalUserRow[];
          })
      : Promise.resolve([] as PortalUserRow[]),
    featureFlags.hasDatabase && notificationCompanyId && notificationUserId
      ? unstable_cache(
          () =>
            prisma.notification.count({
              where: { companyId: notificationCompanyId, userId: notificationUserId, readAt: null },
            }),
          ["dashboard-unread-notifications", notificationCompanyId, notificationUserId],
          { revalidate: 15, tags: [`notifications:${notificationCompanyId}:${notificationUserId}`] },
        )().catch((error) => {
          logError("Dashboard shell notification count failed; using empty state.", {
            route: `/${area}`,
            component: "DashboardShell",
            queryName: "unread-notification-count",
            ...buildSafeErrorLogContext(error),
          });
          return 0;
        })
      : Promise.resolve(0),
  ]);

  const portalUser = portalUserRows[0] ?? null;
  const portalUserName =
    [portalUser?.firstName, portalUser?.lastName].filter(Boolean).join(" ") ||
    portalUser?.email ||
    "Buyer";

  return (
    <Container className="tenant-page-enter grid min-w-0 gap-6 py-5 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-8 lg:py-0">
      {tenant.companyId ? <LiveSurfaceSync channel="company" surface={area} /> : null}
      {/* Mobile/tablet (below lg): sticky top bar + slide-in drawer. Hidden on desktop. */}
      <DashboardMobileNav
        area={area}
        links={links}
        companyName={presentation.companyName}
        logoUrl={branding.logoUrl}
        unreadNotificationCount={unreadNotificationCount}
        portalUser={
          area === "portal"
            ? { name: portalUserName, imageUrl: portalUser?.profileImageUrl ?? null }
            : null
        }
      />
      {/* Desktop sidebar: unchanged behavior, now hidden below lg (drawer replaces it). */}
      <aside className="tenant-panel tenant-sidebar-scroll hidden min-w-0 rounded-[var(--radius-xl)] border border-[var(--tenant-nav-border)] bg-[var(--tenant-nav-surface)] p-4 shadow-[var(--tenant-nav-shadow)] lg:block lg:sticky lg:top-0 lg:max-h-screen lg:self-start lg:overflow-y-auto lg:p-5">
        <div className="min-w-0 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--tenant-nav-border)]/60 bg-white/40 p-4">
          <Logo
            href={`/${area}`}
            name={presentation.companyName}
            tagline={area === "portal" ? "Buyer workspace" : "Company workspace"}
            logoUrl={branding.logoUrl}
            showTagline={false}
          />
          {area === "portal" ? (
            <div className="mt-4 flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--tenant-nav-border)]/60 bg-white/60 px-3 py-3">
              <Avatar name={portalUserName} imageUrl={portalUser?.profileImageUrl} size="md" />
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-[var(--ink-900)]">{portalUserName}</div>
                <div className="text-xs text-[var(--ink-500)]">Buyer profile</div>
              </div>
            </div>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="admin-chip border-[var(--tenant-nav-border)] bg-white/60 text-[var(--ink-600)]">
              {area === "portal" ? "Buyer surface" : "Operator surface"}
            </span>
            <span className="admin-chip border-[var(--tenant-nav-border)] bg-white/60 text-[var(--ink-600)]">
              {links.length} views
            </span>
          </div>
        </div>
        <div className="mt-5 grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3 lg:mt-6 lg:block lg:space-y-2">
          {links.map(([label, href]) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "tenant-nav-link admin-interactive admin-focus flex items-center justify-between gap-2 rounded-[var(--radius-md)] px-4 py-3 text-sm font-medium text-[var(--ink-700)] hover:bg-[var(--sand-100)] hover:text-[var(--ink-950)]",
                href === `/${area}` && "tenant-nav-link-active bg-[var(--sand-100)] text-[var(--ink-950)] shadow-[inset_0_0_0_1px_rgba(15,23,42,0.06)]",
              )}
            >
              <span className="truncate">{label}</span>
              {label === "Notifications" && unreadNotificationCount > 0 ? (
                <span className="min-w-5 rounded-full bg-[var(--brand-700)] px-1.5 py-0.5 text-center text-[11px] font-semibold leading-4 text-white">
                  {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
                </span>
              ) : null}
            </Link>
          ))}
        </div>
      </aside>
      <main className="min-w-0 space-y-6 overflow-x-hidden py-0 lg:py-8">
        <div className="border-b border-[var(--line)] pb-5 sm:pb-6">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-400)]">
            {area === "portal" ? "Buyer workspace" : "Company workspace"}
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-[var(--ink-950)] sm:text-4xl">
            {title}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--ink-500)]">{subtitle}</p>
        </div>
        <div className="tenant-content-reveal">{children}</div>
      </main>
    </Container>
  );
}
