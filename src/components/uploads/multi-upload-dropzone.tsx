"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

import { uploadTenantFile } from "@/components/uploads/client";
import { Button } from "@/components/ui/button";
import { getUploadPurposeConfig, type UploadPurpose } from "@/modules/uploads/config";

type UploadedAsset = {
  url?: string | null;
  storageKey?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
};

export function MultiUploadDropzone({
  purpose,
  surface,
  helperText,
  onUploaded,
}: {
  purpose: UploadPurpose;
  surface: "admin" | "portal";
  helperText?: string;
  onUploaded: (assets: UploadedAsset[]) => void;
}) {
  const [pending, setPending] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [fileNames, setFileNames] = useState<string[]>([]);
  const config = useMemo(() => getUploadPurposeConfig(purpose), [purpose]);

  async function handleFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList);
    if (files.length === 0) {
      return;
    }

    setPending(true);
    setFileNames(files.map((file) => file.name));

    try {
      const assets: UploadedAsset[] = [];
      for (const file of files) {
        const uploaded = await uploadTenantFile({
          file,
          purpose,
          surface,
          mode: "publicAsset",
        });
        assets.push({
          url: uploaded.url ?? null,
          storageKey: uploaded.storageKey,
          fileName: uploaded.fileName,
          mimeType: uploaded.mimeType,
          sizeBytes: uploaded.sizeBytes,
        });
      }

      onUploaded(assets);
      toast.success(`${assets.length} ${assets.length === 1 ? "asset" : "assets"} uploaded.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to upload selected files.");
    } finally {
      setPending(false);
      setFileNames([]);
      setIsDragging(false);
    }
  }

  return (
    <div
      className={`rounded-[28px] border border-dashed px-5 py-6 transition ${
        isDragging ? "border-[var(--brand-700)] bg-[var(--sand-100)]" : "border-[var(--line)] bg-white"
      }`}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        void handleFiles(event.dataTransfer.files);
      }}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-sm font-semibold text-[var(--ink-950)]">Drag and drop files here</div>
          <div className="mt-1 text-sm leading-6 text-[var(--ink-500)]">
            {helperText ?? "Upload multiple files in one pass, then fine-tune titles, ordering, and visibility below."}
          </div>
          <div className="mt-2 text-xs uppercase tracking-[0.18em] text-[var(--ink-500)]">
            Accepted: {config.accept}
          </div>
        </div>
        <label>
          <input
            type="file"
            accept={config.accept}
            multiple
            className="hidden"
            onChange={(event) => {
              if (event.target.files?.length) {
                void handleFiles(event.target.files);
              }
              event.currentTarget.value = "";
            }}
          />
          <Button type="button" variant="outline" disabled={pending}>
            {pending ? "Uploading..." : "Choose files"}
          </Button>
        </label>
      </div>
      {fileNames.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {fileNames.map((name) => (
            <span key={name} className="rounded-full bg-[var(--sand-100)] px-3 py-1 text-xs text-[var(--ink-600)]">
              {name}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
