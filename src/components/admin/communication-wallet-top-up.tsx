"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCreditsFromAmount } from "@/modules/communication/pricing";

const PRESET_AMOUNTS = [5000, 10000, 50000];

function formatNaira(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function CommunicationWalletTopUp({ paystackConfigured }: { paystackConfigured: boolean }) {
  const [selectedAmount, setSelectedAmount] = useState(5000);
  const [customAmount, setCustomAmount] = useState("");
  const [pending, setPending] = useState(false);

  const amount = customAmount.trim() ? Number(customAmount) : selectedAmount;
  const credits = useMemo(() => {
    try {
      return getCreditsFromAmount(amount);
    } catch {
      return 0;
    }
  }, [amount]);

  async function topUp() {
    if (!Number.isInteger(amount) || amount <= 0 || credits <= 0) {
      toast.error("Enter a valid top-up amount.");
      return;
    }

    setPending(true);
    try {
      const response = await fetch("/api/admin/communication-wallet/top-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountNGN: amount }),
      });
      const json = (await response.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
        data?: {
          authorizationUrl?: string;
        };
      } | null;

      if (!response.ok || !json?.success || !json.data?.authorizationUrl) {
        throw new Error(json?.error ?? "Unable to initialize Paystack checkout.");
      }

      window.location.href = json.data.authorizationUrl;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to initialize top-up.");
      setPending(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--sand-50)] p-4">
      <div className="text-sm font-semibold text-[var(--ink-950)]">Buy WhatsApp Credits</div>
      <p className="mt-1 text-sm text-[var(--ink-500)]">
        Top up through Paystack. Credits are added automatically after verified payment webhook
        confirmation.
      </p>
      {!paystackConfigured ? (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Credit top-up requires Paystack secret, public, and webhook configuration.
        </div>
      ) : null}
      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_0.8fr]">
        <div className="flex flex-wrap gap-2">
          {PRESET_AMOUNTS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => {
                setSelectedAmount(preset);
                setCustomAmount("");
              }}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                !customAmount && selectedAmount === preset
                  ? "bg-[var(--brand-700)] text-white"
                  : "border border-[var(--line)] bg-white text-[var(--ink-700)]"
              }`}
            >
              {formatNaira(preset)}
            </button>
          ))}
        </div>
        <Input
          type="number"
          min={100}
          step={100}
          placeholder="Custom amount"
          value={customAmount}
          onChange={(event) => setCustomAmount(event.target.value)}
        />
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-[var(--ink-700)]">
          You will receive <span className="font-semibold">{credits}</span> credits.
        </div>
        <Button type="button" onClick={topUp} disabled={!paystackConfigured || pending || credits <= 0}>
          {pending ? "Opening Paystack..." : "Top Up Credits"}
        </Button>
      </div>
    </div>
  );
}
