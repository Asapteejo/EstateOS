import { DashboardShell } from "@/components/portal/dashboard-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function PortalKycPage() {
  return (
    <DashboardShell area="portal" title="KYC Documents" subtitle="Private document upload foundation for ID, proof of address, and buyer verification.">
      <Card className="space-y-4 p-8">
        <div className="rounded-3xl border border-dashed border-[var(--line)] bg-[var(--sand-100)] p-8 text-center text-sm text-[var(--ink-600)]">
          Secure uploads will use signed R2 URLs and private document metadata records.
        </div>
        <Button>Request upload URL</Button>
      </Card>
    </DashboardShell>
  );
}
