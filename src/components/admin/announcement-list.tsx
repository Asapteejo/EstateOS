import { Megaphone } from "lucide-react";

import { toggleAnnouncementAction } from "@/modules/announcements/actions";
import type { AnnouncementRow } from "@/modules/announcements/service";

function StatusBadge({ row }: { row: AnnouncementRow }) {
  if (row.isExpired) {
    return <span className="rounded-full bg-[var(--sand-100)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-600)]">Expired</span>;
  }
  if (row.isPublished) {
    return <span className="rounded-full bg-[var(--success-50)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--success-700)]">Published</span>;
  }
  return <span className="rounded-full bg-[var(--amber-50)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--amber-700)]">Draft</span>;
}

export function AnnouncementList({ rows }: { rows: AnnouncementRow[] }) {
  if (rows.length === 0) {
    return (
      <section className="rounded-[var(--radius-xl)] border border-[var(--line)] bg-[var(--surface-1,#fff)] p-5 shadow-[var(--shadow-sm)] sm:p-6">
        <div className="flex flex-col items-center justify-center gap-1 py-12 text-center">
          <span className="mb-2 grid h-11 w-11 place-items-center rounded-full bg-[var(--sand-100)] text-[var(--ink-500)]" aria-hidden>
            <Megaphone className="h-5 w-5" />
          </span>
          <p className="text-sm font-medium text-[var(--ink-700)]">No announcements yet.</p>
          <p className="text-sm text-[var(--ink-500)]">Posted broadcasts will appear here — publish or unpublish anytime.</p>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-label="Announcements"
      className="rounded-[var(--radius-xl)] border border-[var(--line)] bg-[var(--surface-1,#fff)] p-5 shadow-[var(--shadow-sm)] sm:p-6"
    >
      <h2 className="text-base font-semibold text-[var(--ink-950)]">Posted announcements</h2>
      <ul className="mt-4 space-y-3">
        {rows.map((row) => (
          <li key={row.id} className="premium-row rounded-[var(--radius-lg)] bg-[var(--sand-100)] px-4 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate font-semibold text-[var(--ink-950)]">{row.title}</div>
                <p className="mt-1 line-clamp-2 text-sm text-[var(--ink-600)]">{row.body}</p>
              </div>
              <StatusBadge row={row} />
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-[var(--ink-500)]">
                {row.audience === "ALL" ? "Everyone" : row.audience === "OPERATORS" ? "Staff" : "Buyers"} · {row.publishedAt}
                {row.expiresAt ? ` · expires ${row.expiresAt}` : ""}
                {row.createdByName ? ` · by ${row.createdByName}` : ""}
              </div>
              <form action={toggleAnnouncementAction}>
                <input type="hidden" name="id" value={row.id} />
                <input type="hidden" name="isPublished" value={row.isPublished ? "false" : "true"} />
                <button
                  type="submit"
                  className="admin-focus rounded-[var(--radius-md)] border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--ink-700)] transition-colors hover:bg-[var(--sand-50)]"
                >
                  {row.isPublished ? "Unpublish" : "Publish"}
                </button>
              </form>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
