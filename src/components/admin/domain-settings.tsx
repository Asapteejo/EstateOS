"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Copy, ExternalLink, RefreshCw } from "lucide-react";
import type { CustomDomainStatus } from "@prisma/client";

import { AdminStateBanner } from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const CNAME_VALUE = "cname.vercel-dns.com";

function StatusBadge({ status }: { status: CustomDomainStatus }) {
  const styles = {
    PENDING: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
    VERIFIED: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    FAILED: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
  } as const;
  const labels = { PENDING: "Pending", VERIFIED: "Verified", FAILED: "Failed" } as const;

  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={copy}
      title="Copy"
      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-[var(--ink-500)] hover:bg-[var(--sand-100)] hover:text-[var(--ink-900)] transition-colors"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export function DomainSettings({
  slug,
  subdomain,
  subdomainUrl,
  customDomain: initialCustomDomain,
  customDomainStatus: initialStatus,
}: {
  slug: string;
  subdomain: string | null;
  subdomainUrl: string;
  customDomain: string | null;
  customDomainStatus: CustomDomainStatus | null;
}) {
  const router = useRouter();
  const [customDomain, setCustomDomain] = useState(initialCustomDomain ?? "");
  const [status, setStatus] = useState<CustomDomainStatus | null>(initialStatus);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const subdomainLabel = subdomain ?? slug;
  const activeUrl =
    status === "VERIFIED" && customDomain
      ? `https://${customDomain}`
      : subdomainUrl;

  async function saveDomain() {
    setSaving(true);
    try {
      const response = await fetch("/api/admin/domain", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customDomain: customDomain.trim() || null }),
      });
      const json = (await response.json().catch(() => null)) as { error?: string; data?: { company?: { customDomainStatus?: CustomDomainStatus } } } | null;
      if (!response.ok) {
        toast.error(json?.error ?? "Unable to save domain.");
        return;
      }
      toast.success(customDomain.trim() ? "Custom domain saved. Verify DNS to activate it." : "Custom domain removed.");
      setStatus(json?.data?.company?.customDomainStatus ?? (customDomain.trim() ? "PENDING" : null));
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function verify() {
    setVerifying(true);
    try {
      const response = await fetch("/api/admin/domain/verify", { method: "POST" });
      const json = (await response.json().catch(() => null)) as {
        error?: string;
        data?: { verified?: boolean; reason?: string; company?: { customDomainStatus?: CustomDomainStatus } };
      } | null;

      if (!response.ok) {
        toast.error(json?.error ?? "Verification failed.");
        return;
      }

      const verified = json?.data?.verified;
      const newStatus = json?.data?.company?.customDomainStatus ?? (verified ? "VERIFIED" : "FAILED");
      setStatus(newStatus as CustomDomainStatus);

      if (verified) {
        toast.success("Domain verified! Your site is now live at your custom domain.");
      } else {
        toast.error(json?.data?.reason ?? "DNS check failed. Check your CNAME record and try again.");
      }

      router.refresh();
    } finally {
      setVerifying(false);
    }
  }

  const domainChanged = customDomain.trim() !== (initialCustomDomain ?? "");

  return (
    <div className="space-y-6">
      {/* Active site URL banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[16px] border border-[var(--line)] bg-[var(--sand-50)] px-5 py-4">
        <div className="space-y-0.5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-400)]">
            Your site is live at
          </div>
          <div className="flex items-center gap-2 font-mono text-sm font-semibold text-[var(--ink-900)]">
            {activeUrl}
            <CopyButton text={activeUrl} />
          </div>
        </div>
        <a href={activeUrl} target="_blank" rel="noopener noreferrer">
          <Button variant="outline" size="sm" className="gap-2">
            <ExternalLink className="h-4 w-4" />
            Visit site
          </Button>
        </a>
      </div>

      {/* Subdomain info */}
      <div className="space-y-2">
        <div className="text-sm font-medium text-[var(--ink-700)]">EstateOS subdomain</div>
        <div className="flex items-center gap-2 rounded-[10px] border border-[var(--line)] bg-[var(--sand-50)] px-4 py-2.5 font-mono text-sm text-[var(--ink-600)]">
          <span className="flex-1">{subdomainLabel}.estateos.com</span>
          <CopyButton text={`https://${subdomainLabel}.estateos.com`} />
        </div>
        <p className="text-xs text-[var(--ink-400)]">
          Always available. Use a custom domain below to replace it as your primary address.
        </p>
      </div>

      {/* Custom domain section */}
      <div className="space-y-4">
        <div>
          <div className="text-sm font-medium text-[var(--ink-700)]">Custom domain</div>
          <p className="mt-1 text-xs text-[var(--ink-400)]">
            Enter a domain you own (e.g. <span className="font-mono">homes.yourcompany.com</span>). Add the CNAME record below, then click Verify.
          </p>
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="homes.yourcompany.com"
            value={customDomain}
            onChange={(e) => setCustomDomain(e.target.value)}
            className="font-mono text-sm"
            disabled={saving}
          />
          <Button onClick={saveDomain} disabled={saving || !domainChanged} className="shrink-0">
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>

        {/* DNS instructions */}
        {customDomain.trim() && !domainChanged && (
          <div className="space-y-3">
            <div className="rounded-[12px] border border-[var(--line)] bg-[#1a1a18] p-4 text-sm font-mono">
              <div className="mb-2 text-[11px] font-sans font-semibold uppercase tracking-[0.14em] text-[#a89f8c]">
                DNS record required
              </div>
              <div className="space-y-1.5">
                <div className="flex gap-6">
                  <span className="w-14 shrink-0 text-[#9b9488]">Type</span>
                  <span className="text-[#faf9f7]">CNAME</span>
                </div>
                <div className="flex gap-6">
                  <span className="w-14 shrink-0 text-[#9b9488]">Name</span>
                  <div className="flex items-center gap-2 text-[#faf9f7]">
                    <span>@ or www</span>
                  </div>
                </div>
                <div className="flex gap-6">
                  <span className="w-14 shrink-0 text-[#9b9488]">Value</span>
                  <div className="flex items-center gap-2 text-[#faf9f7]">
                    <span>{CNAME_VALUE}</span>
                    <CopyButton text={CNAME_VALUE} />
                  </div>
                </div>
              </div>
            </div>

            {/* Status + verify */}
            <div className="flex flex-wrap items-center gap-3">
              {status && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-[var(--ink-500)]">Status:</span>
                  <StatusBadge status={status} />
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={verify}
                disabled={verifying}
                className="gap-2"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${verifying ? "animate-spin" : ""}`} />
                {verifying ? "Checking DNS…" : "Verify now"}
              </Button>
            </div>

            {status === "VERIFIED" && (
              <AdminStateBanner
                tone="success"
                title="Domain verified"
                message={`Your site is live at https://${customDomain}. This is now your primary address.`}
              />
            )}
            {status === "FAILED" && (
              <AdminStateBanner
                tone="warning"
                title="DNS check failed"
                message={`The CNAME record for ${customDomain} was not found pointing to ${CNAME_VALUE}. DNS changes can take up to 48 hours to propagate. Try verifying again after a few minutes.`}
              />
            )}
            {status === "PENDING" && (
              <AdminStateBanner
                tone="info"
                title="Pending verification"
                message="Add the CNAME record to your DNS provider, then click Verify now. It can take a few minutes for DNS changes to propagate."
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
