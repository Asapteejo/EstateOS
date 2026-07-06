import { unstable_cache } from "next/cache";

import { CommandPalette, CommandPaletteTrigger } from "@/components/shared/command-palette";
import { Container } from "@/components/shared/container";
import { Logo } from "@/components/shared/logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { DashboardMobileNav } from "@/components/portal/dashboard-mobile-nav";
import { AnnouncementBanner } from "@/components/portal/announcement-banner";
import { getBuyerUnreadCount, getTeamUnreadCount } from "@/modules/messaging/service";
import { getActiveBuyerAnnouncements, getActiveOperatorAnnouncements } from "@/modules/announcements/service";
import { LiveSurfaceSync } from "@/components/realtime/live-surface-sync";
import { Avatar } from "@/components/ui/avatar";
import { PortalBottomNav } from "@/components/portal/portal-bottom-nav";
import { SidebarNavGroups, type SidebarNavGroup } from "@/components/portal/sidebar-nav-groups";
import { requireAdminSession, requirePortalSession } from "@/lib/auth/guards";
import { adminQuickActions, groupedAdminNav } from "@/lib/auth/admin-sections";
import { DashboardGreeting } from "@/components/dashboard/dashboard-greeting";
import { LiveClock } from "@/components/dashboard/live-clock";
import { QuickActions, type QuickAction } from "@/components/dashboard/quick-actions";
import { getAppSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";
import { buildSafeErrorLogContext, logError } from "@/lib/ops/logger";
import { getTenantPresentation } from "@/modules/branding/service";
import { resolveBuyerTenantContextForKyc } from "@/modules/kyc/buyer-user";
import { cn } from "@/lib/utils";

/**
 * Buyer portal navigation, grouped the same way the operator sidebar is: a
 * few scannable clusters instead of a flat 15-link list. Grouping here is
 * presentation-only — every buyer sees every section.
 */
const portalNavGroups: SidebarNavGroup[] = [
  {
    label: "My journey",
    items: [
      ["Overview", "/portal"],
      ["Timeline", "/portal/timeline"],
      ["Profile", "/portal/profile"],
      ["KYC", "/portal/kyc"],
    ],
  },
  {
    label: "Properties",
    items: [
      ["Saved", "/portal/saved"],
      ["Inspections", "/portal/inspections"],
      ["Reservations", "/portal/reservations"],
    ],
  },
  {
    label: "Money & documents",
    items: [
      ["Payments", "/portal/payments"],
      ["Invoices", "/portal/invoices"],
      ["Contracts", "/portal/contracts"],
      ["Documents", "/portal/documents"],
    ],
  },
  {
    label: "Help & updates",
    items: [
      ["Messages", "/portal/messages"],
      ["Notifications", "/portal/notifications"],
      ["Testimonials", "/portal/testimonials"],
      ["Support", "/portal/support"],
    ],
  },
];

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
  const tenant = area === "portal"
    ? await requirePortalSession({ redirectOnMissingAuth: false })
    : await requireAdminSession(undefined, { redirectOnMissingAuth: false });
  // The operator sidebar is role-scoped: each role only sees the sections it is
  // allowed to access (ADMIN/SUPER_ADMIN see everything). The buyer portal nav is
  // the same for every buyer. Both surfaces group their links into labeled
  // clusters; `links` is the flat view for the command palette and counters.
  const navGroups: SidebarNavGroup[] =
    area === "portal" ? portalNavGroups : groupedAdminNav(tenant.roles);
  const links: ReadonlyArray<readonly [string, string]> = navGroups.flatMap(
    (group) => group.items,
  );
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

  // getAppSession reads request cookies (dynamic) and is never cached.
  // Presentation, session, and announcements are mutually independent (all
  // derive from `tenant`), so resolve all three concurrently — one round trip
  // instead of three sequential ones on every authenticated page load.
  const [presentation, appSession, announcements] = await Promise.all([
    loadPresentation(),
    getAppSession(area),
    area === "portal"
      ? getActiveBuyerAnnouncements(tenant)
      : getActiveOperatorAnnouncements(tenant),
  ]);
  const branding = presentation.branding;

  const profileTenant =
    area === "portal" && tenant.roles.includes("BUYER")
      ? await resolveBuyerTenantContextForKyc(tenant, { email: appSession?.email }).catch(() => tenant)
      : tenant;

  const notificationCompanyId = tenant.companyId;
  const notificationUserId = area === "portal" ? profileTenant.userId : tenant.userId;

  // The buyer identity row, the unread-notification count, and the unread
  // message count all depend only on profileTenant/notification ids, so fetch
  // the three concurrently rather than sequentially. The notification count is
  // per-user and changes frequently, so it is cached only very briefly (15s)
  // and keyed by companyId + userId (tenant- and user-scoped) — enough to
  // absorb rapid re-navigation without showing a materially stale badge.
  const [portalUserRows, unreadNotificationCount, messagesUnreadCount] = await Promise.all([
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
    // Unread message count for the Messages nav badge. Buyers see unread
    // replies from the team; operators see unread buyer messages across the
    // workspace. The service degrades to 0 on any error, so this never blocks
    // the shell.
    featureFlags.hasDatabase && notificationCompanyId
      ? area === "portal"
        ? getBuyerUnreadCount({ companyId: notificationCompanyId, userId: notificationUserId })
        : getTeamUnreadCount({ companyId: notificationCompanyId })
      : Promise.resolve(0),
  ]);

  const portalUser = portalUserRows[0] ?? null;
  const portalUserName =
    [portalUser?.firstName, portalUser?.lastName].filter(Boolean).join(" ") ||
    portalUser?.email ||
    "Buyer";

  const greetingName =
    appSession?.firstName?.trim() ||
    (area === "portal" ? portalUserName.split(" ")[0] : null) ||
    "there";
  const greetingSubtitle =
    area === "portal"
      ? "Here's your buying journey at a glance."
      : "Here's what's happening in your workspace today.";
  const quickActions: QuickAction[] =
    area === "portal"
      ? [
          { label: "Saved homes", href: "/portal/saved", icon: "Heart" },
          { label: "Inspections", href: "/portal/inspections", icon: "CalendarCheck" },
          { label: "Payments", href: "/portal/payments", icon: "CreditCard" },
          { label: "Support", href: "/portal/support", icon: "LifeBuoy" },
        ]
      : adminQuickActions(tenant.roles);

  const commandItems = links.map(([label, href]) => ({
    id: href,
    label,
    href,
    group: area === "portal" ? "Buyer" : "Operator",
  }));

  return (
    <Container className="app-dark-scope grid min-w-0 gap-6 py-5 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-8 lg:py-0">
      {tenant.companyId ? <LiveSurfaceSync channel="company" surface={area} /> : null}
      <CommandPalette commands={commandItems} label={area === "portal" ? "Buyer menu" : "Operator menu"} />
      {/* Mobile/tablet (below lg): sticky top bar + slide-in drawer. Hidden on desktop. */}
      <DashboardMobileNav
        area={area}
        groups={navGroups}
        linkCount={links.length}
        companyName={presentation.companyName}
        logoUrl={branding.logoUrl}
        unreadNotificationCount={unreadNotificationCount}
        messagesUnreadCount={messagesUnreadCount}
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
          <div className="mt-4 flex items-center gap-2">
            <CommandPaletteTrigger className="flex-1" />
            <ThemeToggle />
          </div>
        </div>
        <div className="mt-5 lg:mt-6">
          <SidebarNavGroups
            area={area}
            groups={navGroups}
            unreadNotificationCount={unreadNotificationCount}
            messagesUnreadCount={messagesUnreadCount}
          />
        </div>
      </aside>
      {/* Mobile bottom tab bar — buyers only; the drawer covers the long tail. */}
      {area === "portal" ? (
        <PortalBottomNav
          unreadNotificationCount={unreadNotificationCount}
          messagesUnreadCount={messagesUnreadCount}
        />
      ) : null}
      <main
        id="main-content"
        tabIndex={-1}
        className={cn(
          "min-w-0 space-y-6 overflow-x-hidden py-0 lg:py-8",
          // Keep content clear of the fixed bottom tab bar on small screens.
          area === "portal" && "pb-24 lg:pb-8",
        )}
      >
        <div className="flex flex-col gap-4 pt-1 sm:flex-row sm:items-start sm:justify-between">
          <DashboardGreeting name={greetingName} subtitle={greetingSubtitle} />
          <div className="flex shrink-0 flex-col items-start gap-3 sm:items-end">
            <LiveClock />
            <QuickActions actions={quickActions} />
          </div>
        </div>
        <div className="border-b border-[var(--line)] pb-5 sm:pb-6">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-400)]">
            {area === "portal" ? "Buyer workspace" : "Company workspace"}
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-[var(--ink-950)] sm:text-4xl">
            {title}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--ink-500)]">{subtitle}</p>
        </div>
        <AnnouncementBanner items={announcements} />
        <div className="tenant-content-reveal">{children}</div>
      </main>
    </Container>
  );
}
