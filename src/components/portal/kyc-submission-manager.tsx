"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { UploadField } from "@/components/uploads/upload-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import {
  getAcceptedBuyerIdentityDocuments,
  globalBuyerIdentityDocuments,
  nigeriaBuyerIdentityDocuments,
} from "@/modules/kyc/presentation";
import { Select } from "@/components/ui/select";

type BuyerKycSubmissionListItem = {
  id: string;
  documentType: string;
  identityDocumentType: string | null;
  country: string | null;
  fileName: string;
  status: string;
  notes: string | null;
  rejectionReason: string | null;
  requiredActions: string | null;
  reviewedAt: string | null;
  createdAt: string;
  downloadUrl: string;
  unsupportedFormatMessage: string | null;
};

export function KycSubmissionManager({
  overallStatus,
  profileReady,
  profileChecklist,
  buyerCountry,
  submissions,
}: {
  overallStatus: string;
  profileReady: boolean;
  profileChecklist: Array<{ label: string; complete: boolean }>;
  buyerCountry: string;
  submissions: BuyerKycSubmissionListItem[];
}) {
  const router = useRouter();
  const [country, setCountry] = useState(buyerCountry || "Nigeria");
  const [identityDocumentType, setIdentityDocumentType] = useState<string>(
    getAcceptedBuyerIdentityDocuments(buyerCountry || "Nigeria")[0][0],
  );
  const [notes, setNotes] = useState("");
  const [guideOpen, setGuideOpen] = useState(() => {
    if (typeof window === "undefined") {
      return true;
    }
    return window.localStorage.getItem("estateos:buyer-kyc-guide-dismissed") !== "true";
  });
  const [uploaded, setUploaded] = useState<{
    fileName?: string | null;
    storageKey?: string | null;
    mimeType?: string | null;
    sizeBytes?: number | null;
  }>({});
  const [pending, setPending] = useState(false);

  async function submit() {
    if (!profileReady) {
      toast.error("Complete your profile first before submitting KYC.");
      return;
    }

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
        documentType: "KYC_ID",
        country,
        identityDocumentType,
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

  function dismissGuide() {
    setGuideOpen(false);
    window.localStorage.setItem("estateos:buyer-kyc-guide-dismissed", "true");
  }

  const acceptedDocuments = getAcceptedBuyerIdentityDocuments(country);

  return (
    <div className="space-y-6">
      <Card className="space-y-5 p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ink-500)]">
              KYC guide
            </div>
            <h3 className="mt-2 text-xl font-semibold text-[var(--ink-950)]">
              Submit one clear government-issued ID
            </h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--ink-600)]">
              Upload only one valid government-issued ID. Make sure the name and photo are clear.
            </p>
          </div>
          <Button type="button" variant="outline" onClick={() => setGuideOpen((current) => !current)}>
            View KYC guide
          </Button>
        </div>
        {guideOpen ? (
          <div className="space-y-5">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {[
                "Complete your buyer profile",
                "Choose your country",
                "Select one accepted ID document",
                "Upload a clear photo/PDF",
                "Submit for review",
                "Wait for approval or correction request",
              ].map((step, index) => (
                <div key={step} className="rounded-[20px] border border-[var(--line)] bg-white px-4 py-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ink-400)]">
                    Step {index + 1}
                  </div>
                  <div className="mt-1 text-sm font-medium text-[var(--ink-800)]">{step}</div>
                </div>
              ))}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <AcceptedDocumentList title="Accepted in Nigeria" items={nigeriaBuyerIdentityDocuments} />
              <AcceptedDocumentList title="Accepted in other countries" items={globalBuyerIdentityDocuments} />
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={dismissGuide}>
              Hide guide
            </Button>
          </div>
        ) : null}
      </Card>

      {!profileReady ? (
        <Card className="space-y-5 border-amber-200 bg-amber-50 p-6 sm:p-8">
          <div>
            <h3 className="text-xl font-semibold text-amber-950">
              Complete your profile first before submitting KYC.
            </h3>
            <p className="mt-2 text-sm leading-6 text-amber-900">
              KYC reviewers need your essential contact and location details before they can match your ID to your buyer profile.
            </p>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {profileChecklist.map((item) => (
              <div key={item.label} className="flex items-center gap-2 text-sm text-amber-950">
                <span className="text-xs font-semibold uppercase tracking-[0.14em]">
                  {item.complete ? "Done" : "Needed"}
                </span>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
          <Link href="/portal/profile">
            <Button type="button">Complete Profile</Button>
          </Link>
        </Card>
      ) : null}

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
          <label className="space-y-2">
            <span className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--ink-500)]">Country</span>
            <Select className="w-full"
            value={country}
            onChange={(event) => {
                const nextCountry = event.target.value;
                setCountry(nextCountry);
                setIdentityDocumentType(getAcceptedBuyerIdentityDocuments(nextCountry)[0][0]);
              }}
            >
              <option value="Nigeria">Nigeria</option>
              <option value="Other">Other country</option>
            </Select>
          </label>
          <label className="space-y-2">
            <span className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--ink-500)]">Identity document type</span>
            <Select className="w-full"
              value={identityDocumentType}
              onChange={(event) => setIdentityDocumentType(event.target.value)}
            >
              {acceptedDocuments.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
          </label>
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
            helperText="PDF, JPG, PNG, or WEBP only. Private upload routed through the tenant-scoped document vault."
          />
        </div>
        <Field label="Note for operations or legal (optional)">
          <Textarea
            placeholder="Add any context that helps the review team."
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </Field>
        <Button onClick={submit} disabled={pending || !profileReady}>
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
                  <div className="mt-1 text-sm text-[var(--ink-500)]">
                    {submission.identityDocumentType ?? submission.documentType}
                    {submission.country ? ` - ${submission.country}` : ""}
                  </div>
                  {submission.notes ? (
                    <div className="mt-2 text-sm text-[var(--ink-600)]">{submission.notes}</div>
                  ) : null}
                  {submission.rejectionReason ? (
                    <div className="mt-2 rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-700">
                      Reason: {submission.rejectionReason}
                    </div>
                  ) : null}
                  {submission.requiredActions ? (
                    <div className="mt-2 rounded-2xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
                      Required action: {submission.requiredActions}
                    </div>
                  ) : null}
                  {submission.unsupportedFormatMessage ? (
                    <div className="mt-2 rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-700">
                      {submission.unsupportedFormatMessage}
                    </div>
                  ) : null}
                </div>
                <div className="text-sm text-[var(--ink-700)]">
                  {new Date(submission.createdAt).toLocaleDateString()}
                </div>
                <div className="text-sm font-medium text-[var(--brand-700)]">
                  {formatKycStatus(submission.status)}
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <a href={`${submission.downloadUrl}?disposition=inline`} target="_blank" rel="noreferrer">
                    <Button variant="outline" size="sm">View</Button>
                  </a>
                  <a href={`${submission.downloadUrl}?disposition=attachment`}>
                    <Button variant="outline" size="sm">Download</Button>
                  </a>
                  <Button variant="outline" size="sm" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
                    Replace
                  </Button>
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

function formatKycStatus(status: string) {
  if (status === "APPROVED") {
    return "Accepted";
  }
  if (status === "REJECTED") {
    return "Rejected";
  }
  if (status === "CHANGES_REQUESTED") {
    return "Changes requested";
  }
  if (status === "SUBMITTED" || status === "UNDER_REVIEW") {
    return "Pending";
  }
  return status.toLowerCase().replaceAll("_", " ");
}

function AcceptedDocumentList({
  title,
  items,
}: {
  title: string;
  items: readonly (readonly [string, string])[];
}) {
  return (
    <div className="rounded-[20px] border border-[var(--line)] bg-[var(--sand-100)] p-4">
      <div className="text-sm font-semibold text-[var(--ink-950)]">{title}</div>
      <ul className="mt-3 space-y-2 text-sm text-[var(--ink-600)]">
        {items.map(([value, label]) => (
          <li key={value}>{label}</li>
        ))}
      </ul>
    </div>
  );
}
