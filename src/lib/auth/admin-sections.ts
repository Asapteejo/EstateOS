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
/**
 * Sidebar clusters, in canonical display order. Grouping ~30 flat links into
 * labeled sections keeps the operator sidebar scannable as the surface grows;
 * every item belongs to exactly one group. Grouping is presentation-only —
 * route guards (rolesForAdminPath) are unaffected.
 */
export const ADMIN_NAV_GROUPS = [
  "Workspace",
  "Front desk",
  "Sales",
  "Finance",
  "Legal",
  "Insights",
  "Listings & content",
  "Organization",
] as const;

export type AdminNavGroup = (typeof ADMIN_NAV_GROUPS)[number];

export type AdminNavItem = {
  label: string;
  href: string;
  /** Sidebar cluster this section is displayed under (presentation only). */
  group: AdminNavGroup;
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
  { label: "Overview", href: "/admin/overview", group: "Workspace", roles: [] },
  { label: "Deal Board", href: "/admin", group: "Workspace", roles: [] },
  { label: "My Dashboard", href: "/admin/marketer", group: "Workspace", roles: ["MARKETER"] },
  { label: "Messages", href: "/admin/messages", group: "Workspace", roles: ["STAFF", "FINANCE", "LEGAL", "MARKETER"] },
  { label: "Notifications", href: "/admin/notifications", group: "Workspace", roles: ["STAFF", "FINANCE", "LEGAL"] },
  { label: "Front Desk", href: "/admin/front-desk", group: "Front desk", roles: ["STAFF"], operational: true },
  { label: "Schedule", href: "/admin/schedule", group: "Front desk", roles: ["STAFF"], operational: true },
  { label: "Visitor Log", href: "/admin/visitors", group: "Front desk", roles: ["STAFF"], operational: true },
  { label: "Bookings", href: "/admin/bookings", group: "Front desk", roles: ["STAFF"] },
  { label: "Leads", href: "/admin/leads", group: "Sales", roles: ["STAFF", "MARKETER"] },
  { label: "Clients", href: "/admin/clients", group: "Sales", roles: ["STAFF", "FINANCE", "MARKETER"] },
  { label: "Pipeline", href: "/admin/pipeline", group: "Sales", roles: [] },
  { label: "Finance", href: "/admin/finance", group: "Finance", roles: ["FINANCE"] },
  { label: "Payments", href: "/admin/payments", group: "Finance", roles: ["FINANCE"] },
  { label: "Transactions", href: "/admin/transactions", group: "Finance", roles: ["FINANCE"] },
  { label: "Invoices", href: "/admin/invoices", group: "Finance", roles: ["FINANCE"] },
  { label: "Billing", href: "/admin/billing", group: "Finance", roles: ["FINANCE"] },
  { label: "Contracts", href: "/admin/contracts", group: "Legal", roles: ["LEGAL"] },
  { label: "Documents", href: "/admin/documents", group: "Legal", roles: ["LEGAL"] },
  { label: "Analytics", href: "/admin/analytics", group: "Insights", roles: ["FINANCE"] },
  { label: "Benchmarks", href: "/admin/benchmarks", group: "Insights", roles: [] },
  { label: "Feasibility", href: "/admin/feasibility", group: "Insights", roles: [] },
  { label: "Listings", href: "/admin/listings", group: "Listings & content", roles: [] },
  { label: "Assets", href: "/admin/assets", group: "Listings & content", roles: [] },
  { label: "Testimonials", href: "/admin/testimonials", group: "Listings & content", roles: [] },
  { label: "Announcements", href: "/admin/announcements", group: "Listings & content", roles: [] },
  { label: "Team", href: "/admin/team", group: "Organization", roles: [] },
  { label: "Users", href: "/admin/users", group: "Organization", roles: [] },
  { label: "Marketers", href: "/admin/marketers", group: "Organization", roles: ["MARKETER"] },
  { label: "Settings", href: "/admin/settings", group: "Organization", roles: [] },
  { label: "Audit Logs", href: "/admin/audit-logs", group: "Organization", roles: [] },
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

export type NavGroup = {
  label: string;
  items: ReadonlyArray<readonly [string, string]>;
};

/**
 * Groups the visible nav items into ordered sidebar clusters, dropping empty
 * groups (a FINANCE-only user sees only Workspace + Finance + …). Items are
 * [label, href] tuples — the shape the sidebar/drawer components consume.
 */
export function groupedAdminNav(roles: AppRole[]): NavGroup[] {
  const visible = filterAdminNav(roles);
  return ADMIN_NAV_GROUPS.map((group) => ({
    label: group,
    items: visible
      .filter((item) => item.group === group)
      .map((item) => [item.label, item.href] as const),
  })).filter((group) => group.items.length > 0);
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
  if (roles.includes("MARKETER")) return "/admin/marketer";
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
