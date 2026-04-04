"use client";

import { useId, useRef, useState } from "react";
import { toast } from "sonner";

import { OptimizedImage } from "@/components/media/optimized-image";
import { AssetPickerDialog } from "@/components/uploads/asset-picker-dialog";
import { uploadTenantFile } from "@/components/uploads/client";
import { Button } from "@/components/ui/button";
import { getUploadPurposeConfig, type UploadPurpose } from "@/modules/uploads/config";

type UploadFieldValue = {
  url?: string | null;
  storageKey?: string | null;
  fileName?: string | null;
  documentId?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
};

export function UploadField({
  label,
  purpose,
  surface,
  mode,
  value,
  onChange,
  helperText,
  allowExternalUrl = false,
  externalUrlLabel = "Or paste an external URL",
}: {
  label: string;
  purpose: UploadPurpose;
  surface: "admin" | "portal";
  mode: "publicAsset" | "document" | "preparedUpload";
  value: UploadFieldValue;
  onChange: (value: UploadFieldValue) => void;
  helperText?: string;
  allowExternalUrl?: boolean;
  externalUrlLabel?: string;
}) {
  const inputId = useId();
  const config = getUploadPurposeConfig(purpose);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pending, setPending] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  async function upload(file: File) {
    setPending(true);
    try {
      const uploaded = await uploadTenantFile({
        file,
        purpose,
        surface,
        mode,
        allowExternalUrl,
      });
      setPending(false);
      onChange({
        url: uploaded.url ?? null,
        storageKey: uploaded.storageKey,
        fileName: uploaded.fileName,
        documentId: uploaded.documentId ?? null,
        mimeType: uploaded.mimeType,
        sizeBytes: uploaded.sizeBytes,
      });
      toast.success(`${config.label} uploaded.`);
    } catch (error) {
      setPending(false);
      toast.error(error instanceof Error ? error.message : "Unable to upload file.");
    }
  }

  return (
    <div className="space-y-3 rounded-3xl border border-[var(--line)] bg-white px-4 py-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-[var(--ink-700)]">{label}</div>
          {helperText ? (
            <div className="mt-1 text-xs leading-5 text-[var(--ink-500)]">{helperText}</div>
          ) : null}
        </div>
        {(value.url || value.documentId || value.fileName) ? (
          <button
            type="button"
            className="text-xs font-medium text-[var(--ink-500)]"
            onClick={() => onChange({ url: null, storageKey: null, fileName: null, documentId: null })}
          >
            Remove
          </button>
        ) : null}
      </div>

      {mode === "publicAsset" && value.url ? (
        <div className="overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--sand-100)]">
          <div className="relative h-36 w-full">
            <OptimizedImage src={value.url} alt={label} fill preset="card" className="object-cover" />
          </div>
        </div>
      ) : null}

      {mode === "document" && value.fileName ? (
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--sand-100)] px-4 py-3 text-sm text-[var(--ink-700)]">
          {value.fileName}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={pending}>
          {pending ? "Uploading..." : value.fileName ? "Replace file" : "Upload file"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setPickerOpen(true)}>
          Choose existing
        </Button>
        <input
          id={inputId}
          ref={fileInputRef}
          type="file"
          accept={config.accept}
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              void upload(file);
            }
            event.currentTarget.value = "";
          }}
        />
        {value.storageKey ? (
          <span className="text-xs text-[var(--ink-500)]">Stored in tenant-scoped media</span>
        ) : null}
      </div>

      {allowExternalUrl ? (
        <label className="block space-y-2">
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--ink-500)]">{externalUrlLabel}</span>
          <input
            className="h-11 w-full rounded-2xl border border-[var(--line)] bg-white px-4 text-sm"
            value={value.url ?? ""}
            onChange={(event) => onChange({ ...value, url: event.target.value || null })}
            placeholder="https://..."
          />
        </label>
      ) : null}
      <AssetPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        purpose={purpose}
        onSelect={(asset) => {
          onChange({
            url: asset.url ?? null,
            storageKey: asset.storageKey ?? null,
            fileName: asset.fileName ?? null,
            documentId: asset.documentId ?? null,
          });
          setPickerOpen(false);
        }}
      />
    </div>
  );
}
