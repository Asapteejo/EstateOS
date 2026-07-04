import Link from "next/link";

import type { ThreadSummary } from "@/modules/messaging/service";

/** A selectable list of conversation threads. Unread threads show a brand dot
 *  and bolder text. Selecting one adds ?thread=<id> to the current route. */
export function ThreadList({
  threads,
  basePath,
  activeId,
  showBuyer = false,
  emptyLabel = "No conversations yet.",
}: {
  threads: ThreadSummary[];
  basePath: string;
  activeId?: string;
  showBuyer?: boolean;
  emptyLabel?: string;
}) {
  if (threads.length === 0) {
    return (
      <div className="rounded-[var(--radius-xl)] border border-[var(--line)] bg-[var(--surface-1,#fff)] p-6 text-center text-sm text-[var(--ink-500)] shadow-[var(--shadow-sm)]">
        {emptyLabel}
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {threads.map((thread) => {
        const active = thread.id === activeId;
        return (
          <li key={thread.id}>
            <Link
              href={`${basePath}?thread=${thread.id}`}
              className={`admin-focus block rounded-[var(--radius-lg)] border px-4 py-3 shadow-[var(--shadow-xs)] transition-colors ${
                active
                  ? "border-[var(--brand-500)] bg-[var(--brand-50)]"
                  : "border-[var(--line)] bg-[var(--surface-1,#fff)] hover:border-[var(--brand-300)]"
              }`}
            >
              <div className="flex items-center gap-2">
                {thread.unread ? (
                  <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--brand-500)]" aria-label="Unread" />
                ) : null}
                <span
                  className={`min-w-0 flex-1 truncate text-sm ${
                    thread.unread ? "font-semibold text-[var(--ink-950)]" : "font-medium text-[var(--ink-900)]"
                  }`}
                >
                  {thread.subject}
                </span>
                <span className="shrink-0 text-xs text-[var(--ink-400)]">{thread.lastMessageAt}</span>
              </div>
              {showBuyer ? (
                <div className="mt-0.5 truncate text-xs font-medium text-[var(--brand-ink)]">{thread.buyerName}</div>
              ) : null}
              <div className="mt-0.5 truncate text-xs text-[var(--ink-500)]">{thread.preview}</div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
