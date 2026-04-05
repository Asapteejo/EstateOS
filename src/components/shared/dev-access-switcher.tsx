import Link from "next/link";
import { cookies } from "next/headers";

import { DEV_SESSION_COOKIE } from "@/lib/auth/session";
import { featureFlags } from "@/lib/env";
import { DEV_ACCESS_PRESETS } from "@/components/shared/dev-access";

export async function DevAccessSwitcher() {
  if (!featureFlags.allowDevBypass) {
    return null;
  }

  const cookieStore = await cookies();
  const activeRole = cookieStore.get(DEV_SESSION_COOKIE)?.value ?? "route-default";

  return (
    <div className="fixed bottom-4 left-4 z-[60] max-w-[calc(100vw-2rem)] rounded-3xl border border-[var(--line)] bg-white/96 p-4 shadow-2xl backdrop-blur">
      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-500)]">
        Dev access
      </div>
      <div className="mt-2 text-sm text-[var(--ink-600)]">
        Current demo role: <span className="font-semibold text-[var(--ink-950)]">{activeRole}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {DEV_ACCESS_PRESETS.map((preset) => (
          <Link
            key={preset.label}
            href={`/api/dev/session?role=${preset.role}&redirectTo=${encodeURIComponent(preset.href)}`}
            className="rounded-full border border-[var(--line)] px-3 py-1.5 text-xs font-medium text-[var(--ink-700)] transition hover:border-[var(--brand-500)] hover:text-[var(--ink-950)]"
          >
            {preset.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
