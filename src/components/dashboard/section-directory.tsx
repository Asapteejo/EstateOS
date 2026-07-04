import Link from "next/link";
import {
  ArrowLeftRight,
  BadgeCheck,
  BarChart3,
  Bell,
  Boxes,
  Building2,
  CalendarCheck,
  ClipboardList,
  ConciergeBell,
  CreditCard,
  FileText,
  Gauge,
  Heart,
  KanbanSquare,
  LayoutDashboard,
  LifeBuoy,
  Megaphone,
  MessagesSquare,
  Receipt,
  ReceiptText,
  ScrollText,
  Settings,
  ShieldCheck,
  Sparkles,
  Store,
  Timer,
  TrendingUp,
  UserCircle,
  UserPlus,
  Users,
  UsersRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";

/** Maps a destination to an icon so the directory reads at a glance. Falls back
 *  to a neutral glyph for anything not explicitly mapped. */
const ICON_BY_HREF: Record<string, LucideIcon> = {
  // Operator (admin) surfaces
  "/admin/overview": LayoutDashboard,
  "/admin": KanbanSquare,
  "/admin/front-desk": ConciergeBell,
  "/admin/schedule": CalendarCheck,
  "/admin/visitors": ClipboardList,
  "/admin/finance": Wallet,
  "/admin/payments": CreditCard,
  "/admin/clients": Users,
  "/admin/messages": MessagesSquare,
  "/admin/leads": UserPlus,
  "/admin/transactions": ArrowLeftRight,
  "/admin/pipeline": Gauge,
  "/admin/analytics": BarChart3,
  "/admin/benchmarks": TrendingUp,
  "/admin/feasibility": Sparkles,
  "/admin/contracts": ScrollText,
  "/admin/listings": Building2,
  "/admin/team": UsersRound,
  "/admin/marketers": Store,
  "/admin/bookings": CalendarCheck,
  "/admin/assets": Boxes,
  "/admin/billing": ReceiptText,
  "/admin/invoices": Receipt,
  "/admin/settings": Settings,
  "/admin/documents": FileText,
  "/admin/testimonials": MessagesSquare,
  "/admin/announcements": Megaphone,
  "/admin/notifications": Bell,
  "/admin/audit-logs": ShieldCheck,
  // Buyer portal surfaces
  "/portal": LayoutDashboard,
  "/portal/profile": UserCircle,
  "/portal/kyc": BadgeCheck,
  "/portal/saved": Heart,
  "/portal/inspections": CalendarCheck,
  "/portal/reservations": ClipboardList,
  "/portal/messages": MessagesSquare,
  "/portal/payments": CreditCard,
  "/portal/documents": FileText,
  "/portal/invoices": Receipt,
  "/portal/timeline": Timer,
  "/portal/contracts": ScrollText,
  "/portal/testimonials": MessagesSquare,
  "/portal/notifications": Bell,
  "/portal/support": LifeBuoy,
};

export type DirectoryItem = { label: string; href: string };

/**
 * A premium, at-a-glance directory of every section the current role can reach.
 * Doubles as quick-access: one tap jumps straight into any area of their
 * dashboard. Cards rise in with a subtle stagger and lift on hover.
 */
export function SectionDirectory({
  items,
  title = "Everything on your dashboard",
  description = "Jump straight to any section you have access to.",
}: {
  items: DirectoryItem[];
  title?: string;
  description?: string;
}) {
  if (items.length === 0) return null;

  return (
    <section
      aria-label={title}
      className="rounded-[var(--radius-xl)] border border-[var(--line)] bg-[var(--surface-1,#fff)] p-5 shadow-[var(--shadow-sm)] sm:p-6"
    >
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-[var(--ink-950)]">{title}</h2>
          <p className="mt-0.5 text-sm text-[var(--ink-500)]">{description}</p>
        </div>
        <span className="admin-chip">{items.length} sections</span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item, index) => {
          const Icon = ICON_BY_HREF[item.href] ?? LayoutDashboard;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="card-rise premium-card admin-focus group flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface-1,#fff)] px-4 py-3.5 shadow-[var(--shadow-xs)]"
              style={{ animationDelay: `${Math.min(index * 40, 400)}ms` }}
            >
              <span
                className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--radius-md)] bg-[var(--sand-100)] text-[var(--ink-700)] transition-colors group-hover:bg-[var(--brand-50)] group-hover:text-[var(--brand-ink)]"
                aria-hidden
              >
                <Icon className="h-[18px] w-[18px]" />
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--ink-900)] group-hover:text-[var(--brand-ink)]">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
