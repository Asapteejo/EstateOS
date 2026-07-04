import { MessageComposer } from "@/components/messaging/message-composer";
import { WhatsAppButton } from "@/components/shared/whatsapp-button";
import type { MessageFormState } from "@/modules/messaging/actions";
import type { ThreadDetail } from "@/modules/messaging/service";

/** A single conversation: subject header, message bubbles aligned by sender,
 *  and a reply composer wired to the supplied server action. */
export function Conversation({
  thread,
  action,
  replyPlaceholder = "Write a reply…",
}: {
  thread: ThreadDetail;
  action: (prev: MessageFormState, formData: FormData) => Promise<MessageFormState>;
  replyPlaceholder?: string;
}) {
  return (
    <div className="flex h-full min-h-[28rem] flex-col rounded-[var(--radius-xl)] border border-[var(--line)] bg-[var(--surface-1,#fff)] p-5 shadow-[var(--shadow-sm)] sm:p-6">
      <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] pb-3">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold text-[var(--ink-950)]">{thread.subject}</h2>
          <p className="mt-0.5 text-xs text-[var(--ink-500)]">Conversation with {thread.buyerName}</p>
        </div>
        <WhatsAppButton
          phone={thread.buyerPhone}
          message={`Hi ${thread.buyerName}, regarding "${thread.subject}" —`}
        />
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto py-4">
        {thread.messages.map((message) => (
          <div
            key={message.id}
            className={`flex flex-col gap-1 ${message.mine ? "items-end" : "items-start"}`}
          >
            <div
              className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm leading-6 ${
                message.mine
                  ? "bg-[var(--brand-700)] text-white"
                  : "bg-[var(--sand-100)] text-[var(--ink-900)]"
              }`}
            >
              {message.body}
            </div>
            <div className="px-1 text-[11px] text-[var(--ink-400)]">
              {message.senderName} · {message.when}
            </div>
          </div>
        ))}
      </div>

      <MessageComposer action={action} threadId={thread.id} placeholder={replyPlaceholder} />
    </div>
  );
}
