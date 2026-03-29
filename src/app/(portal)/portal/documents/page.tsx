import Link from "next/link";

import { DashboardShell } from "@/components/portal/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requirePortalSession } from "@/lib/auth/guards";
import { getBuyerDocumentsList } from "@/modules/portal/queries";

export default async function PortalDocumentsPage() {
  const tenant = await requirePortalSession();
  const documents = await getBuyerDocumentsList(tenant);

  return (
    <DashboardShell area="portal" title="Document Vault" subtitle="Receipts, agreements, KYC files, and downloadable transaction records.">
      <Card className="p-8">
        <h2 className="text-2xl font-semibold text-[var(--ink-950)]">Documents</h2>
        <div className="mt-5 space-y-3">
          {documents.map((document) => (
            <div key={document.id} className="rounded-2xl bg-[var(--sand-100)] px-4 py-4 text-sm text-[var(--ink-700)]">
              <div className="flex items-center justify-between gap-4">
                <div className="font-semibold text-[var(--ink-950)]">{document.fileName}</div>
                <div>{document.documentType}</div>
              </div>
              <div className="mt-2 flex flex-wrap gap-4">
                <span>{document.visibility}</span>
                <span>{document.updatedAt}</span>
              </div>
              <div className="mt-4">
                <Link href={document.href}>
                  <Button variant="outline" size="sm">
                    Download document
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </DashboardShell>
  );
}
