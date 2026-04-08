import Link from "next/link";

import { Card } from "@/components/ui/card";

function resolveCopy(status: string | undefined, reason: string | undefined) {
  if (status === "suspended") {
    return {
      eyebrow: "Workspace suspended",
      title: "This company workspace is temporarily unavailable.",
      body:
        "EstateOS has blocked admin and buyer access for this company until the platform owner reactivates it.",
      reason,
    };
  }

  return {
    eyebrow: "Workspace unavailable",
    title: "This company workspace is not currently active.",
    body:
      "Admin and buyer actions are paused for this company right now. Contact the EstateOS platform owner if you need access restored.",
    reason,
  };
}

export default async function AppAccessPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolved = ((await searchParams) ?? {}) as Record<string, string | undefined>;
  const status = resolved.status;
  const reason = resolved.reason;
  const copy = resolveCopy(status, reason);

  return (
    <main className="min-h-screen bg-[var(--sand-50)] px-4 py-16">
      <div className="mx-auto max-w-3xl">
        <Card className="overflow-hidden rounded-[32px] border-[var(--line)] bg-white shadow-[0_20px_70px_rgba(15,23,42,0.08)]">
          <div className="border-b border-[var(--line)] bg-[linear-gradient(135deg,rgba(166,28,28,0.08),rgba(15,23,42,0.02))] px-8 py-8">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--danger-700)]">
              {copy.eyebrow}
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.02em] text-[var(--ink-950)]">
              {copy.title}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--ink-600)]">{copy.body}</p>
          </div>

          <div className="grid gap-6 px-8 py-8 md:grid-cols-[1.3fr_0.7fr]">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--ink-500)]">
                What this means
              </h2>
              <ul className="mt-4 space-y-3 text-sm leading-7 text-[var(--ink-600)]">
                <li>Admin dashboards, portal access, and payment actions are currently blocked.</li>
                <li>Super admins can still inspect the company safely from the platform command center.</li>
                <li>Once the company is reactivated, normal access resumes automatically.</li>
              </ul>
            </div>

            <div className="rounded-[24px] border border-[var(--line)] bg-[var(--sand-50)] p-5">
              <div className="text-sm font-semibold text-[var(--ink-950)]">Operator context</div>
              <p className="mt-3 text-sm leading-7 text-[var(--ink-600)]">
                {copy.reason ?? "No suspension reason was provided by the platform owner."}
              </p>
              <div className="mt-5">
                <Link
                  href="/"
                  className="inline-flex items-center justify-center rounded-full bg-[var(--ink-950)] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--ink-800)]"
                >
                  Return to EstateOS
                </Link>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </main>
  );
}
