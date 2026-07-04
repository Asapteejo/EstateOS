"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import {
  ArrowLeftRight,
  BarChart3,
  Bell,
  Building2,
  CalendarCheck,
  CalendarPlus,
  CreditCard,
  Heart,
  LayoutDashboard,
  LifeBuoy,
  ReceiptText,
  UserCheck,
  UserPlus,
  Users,
  UsersRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { QuickCreateModal } from "@/components/dashboard/quick-create-modal";
import { LeadQuickForm, VisitorQuickForm } from "@/components/dashboard/quick-create-forms";

/** Icon names allowed in quick-action configs (kept as strings so the action
 *  list can be assembled on the server and passed to this client component). */
export type QuickActionIcon =
  | "UserCheck"
  | "UserPlus"
  | "CalendarPlus"
  | "Users"
  | "Bell"
  | "Wallet"
  | "CreditCard"
  | "ReceiptText"
  | "ArrowLeftRight"
  | "LayoutDashboard"
  | "Building2"
  | "UsersRound"
  | "BarChart3"
  | "Heart"
  | "CalendarCheck"
  | "LifeBuoy";

/** Quick actions can either navigate (href) or open a quick-create modal. */
export type QuickModalKind = "visitor" | "lead";

export type QuickAction = {
  label: string;
  href: string;
  icon: QuickActionIcon;
  /** When set, the shortcut opens this quick-create modal instead of navigating. */
  modal?: QuickModalKind;
};

const ICONS: Record<QuickActionIcon, LucideIcon> = {
  UserCheck,
  UserPlus,
  CalendarPlus,
  Users,
  Bell,
  Wallet,
  CreditCard,
  ReceiptText,
  ArrowLeftRight,
  LayoutDashboard,
  Building2,
  UsersRound,
  BarChart3,
  Heart,
  CalendarCheck,
  LifeBuoy,
};

const triggerClass =
  "group relative grid h-10 w-10 cursor-pointer place-items-center rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface-1,#fff)] text-[var(--ink-600)] shadow-[var(--shadow-sm)] transition-[colors,transform] duration-200 hover:-translate-y-0.5 hover:border-[var(--brand-300)] hover:text-[var(--brand-700)] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-500)] focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:hover:translate-y-0";

const tooltipClass =
  "pointer-events-none absolute -bottom-9 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-[var(--radius-sm,6px)] bg-slate-900 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none";

/**
 * A compact row of icon shortcuts with on-hover / on-focus tooltips. Most open a
 * section; those flagged with `modal` open an inline quick-create form instead of
 * navigating. Each control is labelled, has a >=40px hit area, a pointer cursor,
 * and a reduced-motion-aware transition.
 */
export function QuickActions({ actions }: { actions: QuickAction[] }) {
  const [openModal, setOpenModal] = useState<QuickModalKind | null>(null);
  const close = useCallback(() => setOpenModal(null), []);

  if (actions.length === 0) return null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        {actions.map((action) => {
          const Icon = ICONS[action.icon];
          const inner = (
            <>
              <Icon className="h-[18px] w-[18px]" aria-hidden />
              <span role="tooltip" className={tooltipClass}>
                {action.label}
              </span>
            </>
          );

          if (action.modal) {
            const kind = action.modal;
            return (
              <button
                key={`${action.label}-${action.href}`}
                type="button"
                aria-label={action.label}
                onClick={() => setOpenModal(kind)}
                className={triggerClass}
              >
                {inner}
              </button>
            );
          }

          return (
            <Link
              key={`${action.label}-${action.href}`}
              href={action.href}
              aria-label={action.label}
              className={triggerClass}
            >
              {inner}
            </Link>
          );
        })}
      </div>

      <QuickCreateModal
        open={openModal === "visitor"}
        onClose={close}
        title="Log a visitor"
        description="Check a walk-in visitor in at the front desk."
      >
        <VisitorQuickForm onSuccess={close} />
      </QuickCreateModal>

      <QuickCreateModal
        open={openModal === "lead"}
        onClose={close}
        title="New lead"
        description="Capture a walk-in or phone enquiry as a lead."
      >
        <LeadQuickForm onSuccess={close} />
      </QuickCreateModal>
    </>
  );
}
