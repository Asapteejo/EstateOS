"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

type Props = {
  calculationId: string;
};

export function FeasibilityAiNarrative({ calculationId }: Props) {
  const [narrative, setNarrative] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    setNarrative("");

    try {
      const res = await fetch(`/api/admin/feasibility/${calculationId}/narrative`, {
        method: "POST",
      });

      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        setError((body as { error?: string }).error ?? "Failed to generate narrative.");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setNarrative((prev) => prev + decoder.decode(value, { stream: true }));
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button
          variant="secondary"
          onClick={generate}
          disabled={loading}
        >
          {loading ? "Generating…" : narrative ? "Regenerate AI summary" : "Generate AI summary"}
        </Button>
        {loading && (
          <span className="text-xs text-[var(--ink-400)] animate-pulse">
            AI is analysing your feasibility data…
          </span>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {narrative && (
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-50)] p-5 space-y-4">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand-700)]">
            AI feasibility narrative
          </div>
          {narrative
            .split(/\n\n+/)
            .filter((p) => p.trim())
            .map((paragraph, i) => (
              <p key={i} className="text-sm leading-7 text-[var(--ink-700)]">
                {paragraph.trim()}
              </p>
            ))}
        </div>
      )}
    </div>
  );
}
