"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Copy, ExternalLink, RefreshCw } from "lucide-react";
import type { CustomDomainStatus } from "@prisma/client";

import { AdminStateBanner } from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CustomDomainVercelMetadata } from "@/lib/domains/custom-domain";

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

function IntegrationBadge({ complete, label }: { complete: boolean; label: string }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
      complete
        ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
        : "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
    }`}>
      {label}
    </span>
  );
}

export function DomainSettings({
  slug,
  subdomain,
  subdomainUrl,
  customDomain: initialCustomDomain,
  customDomainStatus: initialStatus,
  cnameTarget,
  rootTarget,
  vercel,
}: {
  slug: string;
  subdomain: string | null;
  subdomainUrl: string;
  customDomain: string | null;
  customDomainStatus: CustomDomainStatus | null;
  cnameTarget: string;
  rootTarget: string;
  vercel?: CustomDomainVercelMetadata | null;
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

      <div className="space-y-4">
        <div>
          <div className="text-sm font-medium text-[var(--ink-700)]">Custom domain</div>
          <p className="mt-1 text-xs text-[var(--ink-400)]">
            Enter a domain you own (e.g. <span className="font-mono">yourcompany.com</span>). EstateOS will attach it to Vercel when configured; DNS remains manual.
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
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>

        {/* DNS instructions */}
        {customDomain.trim() && !domainChanged && (
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-[12px] border border-[var(--line)] bg-white p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-400)]">
                  Vercel
                </div>
                <div className="mt-2">
                  <IntegrationBadge
                    complete={vercel?.attached === true}
                    label={vercel?.attached ? "Attached" : vercel?.manualSetupRequired ? "Manual setup" : "Not attached"}
                  />
                </div>
                <p className="mt-2 text-xs leading-5 text-[var(--ink-500)]">
                  {vercel?.manualSetupRequired
                    ? "Vercel API is not configured. A platform operator must add this domain in Vercel."
                    : "EstateOS checks that this domain is attached to the production Vercel project."}
                </p>
              </div>
              <div className="rounded-[12px] border border-[var(--line)] bg-white p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-400)]">
                  DNS
                </div>
                <div className="mt-2">
                  <IntegrationBadge complete={status === "VERIFIED"} label={status === "VERIFIED" ? "Verified" : "Pending"} />
                </div>
                <p className="mt-2 text-xs leading-5 text-[var(--ink-500)]">
                  Cloudflare or your registrar must point the apex and www records to Vercel.
                </p>
              </div>
              <div className="rounded-[12px] border border-[var(--line)] bg-white p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-400)]">
                  SSL
                </div>
                <div className="mt-2">
                  <IntegrationBadge
                    complete={vercel?.domains?.some((domain) => domain.sslReady) === true}
                    label={vercel?.domains?.some((domain) => domain.sslReady) ? "Ready" : "Pending"}
                  />
                </div>
                <p className="mt-2 text-xs leading-5 text-[var(--ink-500)]">
                  SSL becomes ready after Vercel sees the correct DNS records.
                </p>
              </div>
            </div>

            <div className="rounded-[12px] border border-[var(--line)] bg-[#1a1a18] p-4 text-sm font-mono">
              <div className="mb-2 text-[11px] font-sans font-semibold uppercase tracking-[0.14em] text-[#a89f8c]">
                Manual DNS records
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-lg bg-white/5 px-3 py-2">
                  <div className="text-[#9b9488]">Apex / root</div>
                  <div className="mt-1 text-[#faf9f7]">Type: A</div>
                  <div className="text-[#faf9f7]">Name: @</div>
                  <div className="flex items-center gap-2 text-[#faf9f7]">
                    <span>Value: {rootTarget}</span>
                    <CopyButton text={rootTarget} />
                  </div>
                </div>
                <div className="rounded-lg bg-white/5 px-3 py-2">
                  <div className="text-[#9b9488]">www alias</div>
                  <div className="mt-1 text-[#faf9f7]">Type: CNAME</div>
                  <div className="text-[#faf9f7]">Name: www</div>
                  <div className="flex items-center gap-2 text-[#faf9f7]">
                    <span>Value: {cnameTarget}</span>
                    <CopyButton text={cnameTarget} />
                  </div>
                </div>
              </div>
              <div className="mt-4 rounded-lg bg-white/5 px-3 py-2 font-sans text-xs leading-5 text-[#d6d1c7]">
                In Cloudflare, keep the records DNS-only until Vercel reports SSL as ready, then enable proxying only if your setup requires it.
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
                {verifying ? "Checking DNS..." : "Verify now"}
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
                message={`EstateOS could not verify the Vercel attachment and required DNS records for ${customDomain}. DNS changes can take up to 48 hours to propagate.`}
              />
            )}
            {status === "PENDING" && (
              <AdminStateBanner
                tone="info"
                title="Pending verification"
                message="Add the A and CNAME records to your DNS provider, then click Verify now. It can take a few minutes for DNS changes to propagate."
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
