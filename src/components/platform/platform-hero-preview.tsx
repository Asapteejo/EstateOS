import { CheckCircle2, ReceiptText } from "lucide-react";

/**
 * Code-rendered product preview for the platform hero.
 *
 * A light "operator view" panel that floats on the dark hero gradient so the
 * landing page *shows* the product instead of only describing it. All data here
 * is illustrative sample UI (not real tenant data) — it exists purely to convey
 * what the deal board and payment flow look like.
 *
 * Purely presentational and server-rendered (no client JS). Entrance motion is
 * supplied by the <Reveal> wrapper around it on the page.
 */

type DealTone = "reserved" | "pending" | "overdue" | "paid";

const TONE: Record<DealTone, { label: string; dot: string; pill: string }> = {
  reserved: {
    label: "Reserved",
    dot: "bg-sky-500",
    pill: "bg-sky-50 text-sky-700 ring-1 ring-sky-200",
  },
  pending: {
    label: "Payment due",
    dot: "bg-amber-500",
    pill: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  },
  overdue: {
    label: "Overdue",
    dot: "bg-rose-500",
    pill: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
  },
  paid: {
    label: "Paid",
    dot: "bg-emerald-500",
    pill: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  },
};

const DEALS: {
  initials: string;
  name: string;
  unit: string;
  amount: string;
  tone: DealTone;
  avatar: string;
}[] = [
  {
    initials: "AO",
    name: "Adunni O.",
    unit: "Unit B12 · Lekki Phase 1",
    amount: "₦4.5M",
    tone: "pending",
    avatar: "bg-[#0b5d48]",
  },
  {
    initials: "CE",
    name: "Chidi E.",
    unit: "Plot 9 · Ibeju-Lekki",
    amount: "₦2.0M",
    tone: "overdue",
    avatar: "bg-[#9a3412]",
  },
  {
    initials: "FB",
    name: "Fatima B.",
    unit: "Unit A4 · Gwarinpa",
    amount: "₦7.2M",
    tone: "reserved",
    avatar: "bg-[#1e3a8a]",
  },
];

export function PlatformHeroPreview() {
  return (
    <div className="relative">
      {/* Soft glow behind the panel */}
      <div
        aria-hidden
        className="absolute -inset-6 rounded-[32px] bg-[radial-gradient(60%_60%_at_70%_20%,rgba(215,185,143,0.25),transparent)]"
      />

      <div className="relative overflow-hidden rounded-[22px] border border-white/12 bg-white shadow-[0_30px_80px_-20px_rgba(0,0,0,0.55)]">
        {/* Window chrome */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-slate-200" />
            <span className="text-[13px] font-semibold text-slate-900">Deal board</span>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Live
          </span>
        </div>

        {/* Deal rows */}
        <div className="divide-y divide-slate-100">
          {DEALS.map((deal) => {
            const tone = TONE[deal.tone];
            return (
              <div key={deal.name} className="flex items-center gap-3 px-5 py-3.5">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold text-white ${deal.avatar}`}
                >
                  {deal.initials}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold text-slate-900">{deal.name}</div>
                  <div className="truncate text-[11px] text-slate-500">{deal.unit}</div>
                </div>
                <div className="text-right">
                  <div className="text-[13px] font-semibold tabular-nums text-slate-900">{deal.amount}</div>
                  <span
                    className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${tone.pill}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                    {tone.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Collections footer widget */}
        <div className="space-y-3 border-t border-slate-100 bg-slate-50/70 px-5 py-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Collected this month
            </span>
            <span className="text-[13px] font-semibold tabular-nums text-slate-900">₦38.4M</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div className="h-full w-[72%] rounded-full bg-[linear-gradient(90deg,#0b5d48,#14b8a6)]" />
          </div>
          <div className="flex items-center gap-2 text-[11px] font-medium text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
            Receipt sent automatically on payment
            <ReceiptText className="ml-auto h-3.5 w-3.5 text-slate-400" aria-hidden />
          </div>
        </div>
      </div>
    </div>
  );
}
