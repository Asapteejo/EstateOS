import Link from "next/link";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";

type FeedItem = {
  id: string;
  timestamp: Date;
  type:
    | "payment_completed"
    | "payment_request_sent"
    | "company_onboarded"
    | "company_created"
    | "overdue_detected"
    | "subscription_revenue"
    | "webhook_alert"
    | "job_failure";
  companyId: string | null;
  companyName: string;
  title: string;
  summary: string;
  amount: number | null;
  amountLabel: string | null;
  accent: "positive" | "alert" | "neutral";
};

export function SuperadminActivityFeed({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle: string;
  items: FeedItem[];
}) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-[var(--line)] px-6 py-5">
        <h2 className="text-lg font-semibold text-[var(--ink-950)]">{title}</h2>
        <p className="mt-1 text-sm text-[var(--ink-500)]">{subtitle}</p>
      </div>
      <div className="divide-y divide-[var(--line)]">
        {items.length ? (
          items.map((item) => (
            <div key={item.id} className="grid gap-3 px-6 py-4 lg:grid-cols-[auto_1fr_auto] lg:items-center">
              <Badge
                className={
                  item.accent === "positive"
                    ? "bg-emerald-100 text-emerald-800"
                    : item.accent === "alert"
                      ? "bg-rose-100 text-rose-800"
                      : "bg-slate-100 text-slate-700"
                }
              >
                {item.title}
              </Badge>
              <div>
                <div className="font-medium text-[var(--ink-950)]">
                  {item.companyId ? (
                    <Link href={`/superadmin/companies/${item.companyId}`} className="hover:underline">
                      {item.companyName}
                    </Link>
                  ) : (
                    item.companyName
                  )}
                </div>
                <div className="mt-1 text-sm text-[var(--ink-600)]">{item.summary}</div>
              </div>
              <div className="text-left text-sm text-[var(--ink-500)] lg:text-right">
                <div>{item.amountLabel ?? (item.amount != null ? formatCurrency(item.amount) : null)}</div>
                <div className="mt-1">{formatDate(item.timestamp, "PPP p")}</div>
              </div>
            </div>
          ))
        ) : (
          <div className="px-6 py-10 text-sm text-[var(--ink-500)]">
            No platform events yet. Once companies start sending payment requests and collecting money, activity will surface here.
          </div>
        )}
      </div>
    </Card>
  );
}
