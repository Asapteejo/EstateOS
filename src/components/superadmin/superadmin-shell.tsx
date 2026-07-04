"use client";

import { usePathname } from "next/navigation";

import { CommandPalette, CommandPaletteTrigger } from "@/components/shared/command-palette";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { LiveSurfaceSync } from "@/components/realtime/live-surface-sync";
import { Container } from "@/components/shared/container";
import { SuperadminMobileNav } from "@/components/superadmin/superadmin-mobile-nav";
import { SuperadminNavLink } from "@/components/superadmin/superadmin-nav-link";
import { cn } from "@/lib/utils";

const links = [
  ["Overview", "/superadmin"],
  ["Revenue", "/superadmin/revenue"],
  ["Companies", "/superadmin/companies"],
  ["Wallets", "/superadmin/communication-wallets"],
  ["Activity", "/superadmin/activity"],
  ["Controls", "/superadmin/settings"],
] as const;

export function SuperadminShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const commandItems = links.map(([label, href]) => ({ id: href, label, href, group: "Platform" }));

  return (
    <Container className="app-dark-scope grid gap-6 py-8 lg:grid-cols-[280px_1fr]">
      <LiveSurfaceSync channel="superadmin" />
      <CommandPalette commands={commandItems} label="Platform menu" />
      <SuperadminMobileNav links={links} />
      <aside className="hidden rounded-[32px] border border-[var(--line)] bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.06)] lg:block">
        <div className="rounded-[28px] bg-[linear-gradient(140deg,#052e2b,#0d5f4a_55%,#d7b98f)] p-6 text-white">
          <div className="text-xs uppercase tracking-[0.24em] text-white/70">Platform owner</div>
          <div className="mt-3 font-serif text-3xl">EstateOS</div>
          <div className="mt-3 text-sm leading-7 text-white/82">
            Run EstateOS like a business: track platform inflow, revenue, company health, and risk from one control tower.
          </div>
        </div>
        <div className="mt-6 flex items-center gap-2">
          <CommandPaletteTrigger className="flex-1" />
          <ThemeToggle />
        </div>
        <div className="mt-8 space-y-2">
          {links.map(([label, href]) => {
            const active = pathname === href || (href !== "/superadmin" && pathname.startsWith(href));
            return (
              <SuperadminNavLink
                key={href}
                href={href}
                className={cn(
                  "block rounded-2xl px-4 py-3 text-sm font-semibold text-[var(--ink-700)] transition hover:bg-[var(--sand-100)]",
                  active && "bg-[var(--ink-950)] text-white hover:bg-[var(--ink-950)]",
                )}
              >
                {label}
              </SuperadminNavLink>
            );
          })}
        </div>
      </aside>
      <main id="main-content" tabIndex={-1} className="space-y-6 tenant-content-reveal">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h1 className="font-serif text-4xl tracking-tight text-[var(--ink-950)]">{title}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--ink-600)]">{subtitle}</p>
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
        {children}
      </main>
    </Container>
  );
}
