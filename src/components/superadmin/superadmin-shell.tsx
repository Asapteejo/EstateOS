import Link from "next/link";

import { Container } from "@/components/shared/container";
import { cn } from "@/lib/utils";

const links = [
  ["Overview", "/superadmin"],
  ["Companies", "/superadmin/companies"],
] as const;

export function SuperadminShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <Container className="grid gap-6 py-8 lg:grid-cols-[260px_1fr]">
      <aside className="rounded-[28px] border border-[var(--line)] bg-white p-5">
        <div className="rounded-3xl border border-[var(--line)] bg-[linear-gradient(135deg,#0d5f4a,#d7b98f)] p-5 text-white">
          <div className="text-xs uppercase tracking-[0.22em] text-white/75">Platform owner</div>
          <div className="mt-2 font-serif text-2xl">EstateOS</div>
          <div className="mt-2 text-sm text-white/85">
            Cross-company visibility, monetization oversight, and operational control.
          </div>
        </div>
        <div className="mt-8 space-y-2">
          {links.map(([label, href]) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "block rounded-2xl px-4 py-3 text-sm font-medium text-[var(--ink-700)] transition hover:bg-[var(--sand-100)]",
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
