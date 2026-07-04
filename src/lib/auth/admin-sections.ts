import type { AppRole } from "@prisma/client";
import type { QuickAction } from "@/components/dashboard/quick-actions";

/**
 * Single source of truth for the operator (admin) workspace navigation and the
 * role rules that gate each section. Both the sidebar (what a user SEES) and the
 * server-side route guards (what a user can ACCESS) read from this map so the two
 * can never drift apart.
 *
 * Role model (reusing the existing AppRole enum):
 *   - ADMIN / SUPER_ADMIN -> the company owner / CEO: full access to every section.
 *   - FINANCE             -> the accountant: finance surfaces only.
 *   - STAFF               -> the front desk / receptionist: client-facing ops.
 *   - LEGAL               -> contracts & documents.
 *
 * `roles` lists the NON-owner roles allowed into a section. ADMIN and SUPER_ADMIN
 * are always allowed and never need to be listed.
 */
export type AdminNavItem = {
  label: string;
  href: string;
  /** Non-owner roles permitted to access this section. ADMIN/SUPER_ADMIN always allowed. */
  roles: AppRole[];
  /**
   * Front-desk / hands-on operational tools (data entry, check-ins). These are
   * hidden from the owner/CEO's oversight nav — the owner monitors this activity
   * through the Executive Overview and Analytics rather than doing the entry work
   * themselves. Owners retain direct route access (see rolesForAdminPath); this
   * flag only curates the sidebar so the CEO gets an oversight-first cockpit,
   * mirroring how mature SaaS separates "see everything" from "do everything".
   */
  operational?: boolean;
};

export const ADMIN_NAV: AdminNavItem[] = [
  { label: "Overview", href: "/admin/overview", roles: [] },
  { label: "Deal Board", href: "/admin", roles: [] },
  { label: "Front Desk", href: "/admin/front-desk", roles: ["STAFF"], operational: true },
  { label: "Schedule", href: "/admin/schedule", roles: ["STAFF"], operational: true },
  { label: "Visitor Log", href: "/admin/visitors", roles: ["STAFF"], operational: true },
  { label: "Finance", href: "/admin/finance", roles: ["FINANCE"] },
  { label: "Payments", href: "/admin/payments", roles: ["FINANCE"] },
  { label: "Clients", href: "/admin/clients", roles: ["STAFF", "FINANCE"] },
  { label: "Messages", href: "/admin/messages", roles: ["STAFF", "FINANCE", "LEGAL"] },
  { label: "Leads", href: "/admin/leads", roles: ["STAFF"] },
  { label: "Transactions", href: "/admin/transactions", roles: ["FINANCE"] },
  { label: "Pipeline", href: "/admin/pipeline", roles: [] },
  { label: "Analytics", href: "/admin/analytics", roles: ["FINANCE"] },
  { label: "Benchmarks", href: "/admin/benchmarks", roles: [] },
  { label: "Feasibility", href: "/admin/feasibility", roles: [] },
  { label: "Contracts", href: "/admin/contracts", roles: ["LEGAL"] },
  { label: "Listings", href: "/admin/listings", roles: [] },
  { label: "Team", href: "/admin/team", roles: [] },
  { label: "Marketers", href: "/admin/marketers", roles: [] },
  { label: "Bookings", href: "/admin/bookings", roles: ["STAFF"] },
  { label: "Assets", href: "/admin/assets", roles: [] },
  { label: "Billing", href: "/admin/billing", roles: ["FINANCE"] },
  { label: "Invoices", href: "/admin/invoices", roles: ["FINANCE"] },
  { label: "Settings", href: "/admin/settings", roles: [] },
  { label: "Documents", href: "/admin/documents", roles: ["LEGAL"] },
  { label: "Testimonials", href: "/admin/testimonials", roles: [] },
  { label: "Announcements", href: "/admin/announcements", roles: [] },
  { label: "Notifications", href: "/admin/notifications", roles: ["STAFF", "FINANCE", "LEGAL"] },
  { label: "Audit Logs", href: "/admin/audit-logs", roles: [] },
];

/** Roles with unrestricted access to the entire operator workspace. */
export const FULL_ADMIN_ACCESS_ROLES: AppRole[] = ["ADMIN", "SUPER_ADMIN"];

export function hasFullAdminAccess(roles: AppRole[]): boolean {
  return roles.some((role) => FULL_ADMIN_ACCESS_ROLES.includes(role));
}

export function canAccessAdminItem(roles: AppRole[], item: AdminNavItem): boolean {
  if (hasFullAdminAccess(roles)) return true;
  return item.roles.some((role) => roles.includes(role));
}

/**
 * The nav items a given set of roles SEES in the sidebar, in canonical order.
 * Operational (front-desk) tools are shown only to the roles that actually do
 * that work — never to the owner purely by virtue of full-admin — so the CEO
 * gets an oversight-first cockpit. Access itself is unaffected: rolesForAdminPath
 * still lets the owner open any section directly.
 */
export function filterAdminNav(roles: AppRole[]): AdminNavItem[] {
  return ADMIN_NAV.filter((item) => {
    if (item.operational) {
      return item.roles.some((role) => roles.includes(role));
    }
    return canAccessAdminItem(roles, item);
  });
}

/**
 * The set of roles allowed to access a given admin path, for server-side guards.
 * ADMIN and SUPER_ADMIN are always included. Unknown paths fall back to
 * owner-only access (safe default).
 */
export function rolesForAdminPath(href: string): AppRole[] {
  const item = ADMIN_NAV.find((entry) => entry.href === href);
  const extra = item?.roles ?? [];
  return Array.from(new Set<AppRole>([...FULL_ADMIN_ACCESS_ROLES, ...extra]));
}

/**
 * Where an operator should land. The owner gets the Deal Board; specialized roles
 * land on the first section they own. Every target is a path the role can access,
 * which guarantees no redirect loop with the route guards.
 */
export function adminLandingPath(roles: AppRole[]): string {
  if (hasFullAdminAccess(roles)) return "/admin/overview";
  if (roles.includes("FINANCE")) return "/admin/finance";
  if (roles.includes("STAFF")) return "/admin/front-desk";
  if (roles.includes("LEGAL")) return "/admin/contracts";
  return "/admin/notifications";
}


/**
 * Role-aware quick-action shortcuts shown in the dashboard header. Every target
 * is a section the role can access, so the shortcuts never lead to a redirect.
 */
export function adminQuickActions(roles: AppRole[]): QuickAction[] {
  if (hasFullAdminAccess(roles)) {
    return [
      { label: "Overview", href: "/admin/overview", icon: "LayoutDashboard" },
      { label: "Listings", href: "/admin/listings", icon: "Building2" },
      { label: "Team", href: "/admin/team", icon: "UsersRound" },
      { label: "Analytics", href: "/admin/analytics", icon: "BarChart3" },
      { label: "Notifications", href: "/admin/notifications", icon: "Bell" },
    ];
  }

  const actions: QuickAction[] = [];
  if (roles.includes("STAFF")) {
    actions.push(
      { label: "Log visitor", href: "/admin/visitors", icon: "UserCheck", modal: "visitor" },
      { label: "New lead", href: "/admin/leads", icon: "UserPlus", modal: "lead" },
      { label: "Book viewing", href: "/admin/bookings", icon: "CalendarPlus" },
      { label: "Clients", href: "/admin/clients", icon: "Users" },
    );
  }
  if (roles.includes("FINANCE")) {
    actions.push(
      { label: "Payments", href: "/admin/payments", icon: "Wallet" },
      { label: "Billing", href: "/admin/billing", icon: "ReceiptText" },
      { label: "Transactions", href: "/admin/transactions", icon: "ArrowLeftRight" },
    );
  }
  if (roles.includes("LEGAL")) {
    actions.push({ label: "Contracts", href: "/admin/contracts", icon: "ReceiptText" });
  }
  actions.push({ label: "Notifications", href: "/admin/notifications", icon: "Bell" });
  return actions;
}
