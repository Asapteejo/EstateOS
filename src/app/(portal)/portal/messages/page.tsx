import { DashboardShell } from "@/components/portal/dashboard-shell";
import { Conversation } from "@/components/messaging/conversation";
import { NewThreadForm } from "@/components/messaging/new-thread-form";
import { ThreadList } from "@/components/messaging/thread-list";
import { requirePortalSession } from "@/lib/auth/guards";
import { replyBuyerAction } from "@/modules/messaging/actions";
import { getThread, listBuyerThreads } from "@/modules/messaging/service";

export const dynamic = "force-dynamic";

export default async function PortalMessagesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePortalSession();
  const threads = await listBuyerThreads(session);
  const sp = (await searchParams) ?? {};
  const threadId = typeof sp.thread === "string" ? sp.thread : undefined;
  const active = threadId ? await getThread(session, threadId, "buyer") : null;

  return (
    <DashboardShell
      area="portal"
      title="Messages"
      subtitle="Chat with the sales team about your properties, payments, and questions."
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <div className="space-y-4">
          <ThreadList
            threads={threads}
            basePath="/portal/messages"
            activeId={threadId}
            emptyLabel="No conversations yet. Start one below."
          />
          <NewThreadForm />
        </div>
        <div>
          {active ? (
            <Conversation thread={active} action={replyBuyerAction} />
          ) : (
            <div className="flex h-full min-h-[28rem] flex-col items-center justify-center rounded-[var(--radius-xl)] border border-dashed border-[var(--line-strong)] bg-[var(--surface-1,#fff)] p-8 text-center">
              <p className="text-sm font-medium text-[var(--ink-700)]">Select a conversation</p>
              <p className="mt-1 text-sm text-[var(--ink-500)]">
                Pick a thread on the left, or start a new one to reach the sales team.
              </p>
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
