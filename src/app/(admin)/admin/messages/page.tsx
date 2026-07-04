import { DashboardShell } from "@/components/portal/dashboard-shell";
import { Conversation } from "@/components/messaging/conversation";
import { ThreadList } from "@/components/messaging/thread-list";
import { requireAdminSession } from "@/lib/auth/guards";
import { rolesForAdminPath } from "@/lib/auth/admin-sections";
import { replyAdminAction } from "@/modules/messaging/actions";
import { getThread, listAdminThreads } from "@/modules/messaging/service";

export const dynamic = "force-dynamic";

export default async function AdminMessagesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const tenant = await requireAdminSession(rolesForAdminPath("/admin/messages"));
  const threads = await listAdminThreads(tenant);
  const sp = (await searchParams) ?? {};
  const threadId = typeof sp.thread === "string" ? sp.thread : undefined;
  const active = threadId ? await getThread(tenant, threadId, "team") : null;

  return (
    <DashboardShell
      area="admin"
      title="Messages"
      subtitle="Reply to buyer conversations across your workspace."
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <ThreadList
          threads={threads}
          basePath="/admin/messages"
          activeId={threadId}
          showBuyer
          emptyLabel="No buyer conversations yet."
        />
        <div>
          {active ? (
            <Conversation thread={active} action={replyAdminAction} replyPlaceholder="Reply to the buyer…" />
          ) : (
            <div className="flex h-full min-h-[28rem] flex-col items-center justify-center rounded-[var(--radius-xl)] border border-dashed border-[var(--line-strong)] bg-[var(--surface-1,#fff)] p-8 text-center">
              <p className="text-sm font-medium text-[var(--ink-700)]">Select a conversation</p>
              <p className="mt-1 text-sm text-[var(--ink-500)]">
                Choose a buyer thread on the left to read and reply.
              </p>
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
