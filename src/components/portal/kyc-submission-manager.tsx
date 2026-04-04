"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { UploadField } from "@/components/uploads/upload-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

type BuyerKycSubmissionListItem = {
  id: string;
  documentType: string;
  fileName: string;
  status: string;
  notes: string | null;
  createdAt: string;
  downloadUrl: string;
};

export function KycSubmissionManager({
  overallStatus,
  submissions,
}: {
  overallStatus: string;
  submissions: BuyerKycSubmissionListItem[];
}) {
  const router = useRouter();
  const [documentType, setDocumentType] = useState("KYC_ID");
  const [notes, setNotes] = useState("");
  const [uploaded, setUploaded] = useState<{
    fileName?: string | null;
    storageKey?: string | null;
    mimeType?: string | null;
    sizeBytes?: number | null;
  }>({});
  const [pending, setPending] = useState(false);

  async function submit() {
    if (!uploaded.fileName || !uploaded.storageKey) {
      toast.error("Choose a document file before submitting.");
      return;
    }

    setPending(true);

    const submissionResponse = await fetch("/api/portal/kyc-submissions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        documentType,
        fileName: uploaded.fileName,
        storageKey: uploaded.storageKey,
        mimeType: uploaded.mimeType ?? undefined,
        sizeBytes: uploaded.sizeBytes ?? undefined,
        notes: notes || undefined,
      }),
    });

    setPending(false);

    if (!submissionResponse.ok) {
      const json = (await submissionResponse.json().catch(() => null)) as { error?: string } | null;
      toast.error(json?.error ?? "Unable to submit KYC document.");
      return;
    }

    toast.success("KYC document submitted for review.");
    setNotes("");
    setUploaded({});
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <Card className="space-y-4 p-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold text-[var(--ink-950)]">Verification status</h3>
            <p className="mt-2 text-sm text-[var(--ink-600)]">
              Track the current KYC state and upload the documents required for reservation and legal processing.
            </p>
          </div>
          <Badge>{overallStatus.toLowerCase().replaceAll("_", " ")}</Badge>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <select
            className="h-11 rounded-2xl border border-[var(--line)] bg-white px-4 text-sm text-[var(--ink-700)]"
            value={documentType}
            onChange={(event) => setDocumentType(event.target.value)}
          >
            <option value="KYC_ID">Government ID</option>
            <option value="KYC_PROOF_OF_ADDRESS">Proof of address</option>
            <option value="PASSPORT_PHOTO">Passport photograph</option>
          </select>
          <UploadField
            label="KYC file"
            purpose="KYC_DOCUMENT"
            surface="portal"
            mode="preparedUpload"
            value={uploaded}
            onChange={(value) =>
              setUploaded({
                fileName: value.fileName,
                storageKey: value.storageKey,
                mimeType: value.mimeType,
                sizeBytes: value.sizeBytes,
              })
            }
            helperText="Private upload routed through the tenant-scoped document vault."
          />
        </div>
        <Textarea
          placeholder="Optional note for operations or legal"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
        <Button onClick={submit} disabled={pending}>
          {pending ? "Submitting..." : "Submit KYC document"}
        </Button>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-[var(--line)] px-6 py-4">
          <h3 className="text-lg font-semibold text-[var(--ink-950)]">Submitted documents</h3>
        </div>
        <div className="divide-y divide-[var(--line)]">
          {submissions.length > 0 ? (
            submissions.map((submission) => (
              <div key={submission.id} className="grid gap-4 px-6 py-5 lg:grid-cols-[1fr_0.8fr_0.8fr_auto]">
                <div>
                  <div className="font-semibold text-[var(--ink-950)]">{submission.fileName}</div>
                  <div className="mt-1 text-sm text-[var(--ink-500)]">{submission.documentType}</div>
                  {submission.notes ? (
                    <div className="mt-2 text-sm text-[var(--ink-600)]">{submission.notes}</div>
                  ) : null}
                </div>
                <div className="text-sm text-[var(--ink-700)]">
                  {new Date(submission.createdAt).toLocaleDateString()}
                </div>
                <div className="text-sm font-medium text-[var(--brand-700)]">
                  {submission.status.replaceAll("_", " ")}
                </div>
                <div className="flex justify-end">
                  <a href={submission.downloadUrl}>
                    <Button variant="outline" size="sm">Open</Button>
                  </a>
                </div>
              </div>
            ))
          ) : (
            <div className="px-6 py-10 text-center text-sm text-[var(--ink-500)]">
              No KYC documents submitted yet.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
