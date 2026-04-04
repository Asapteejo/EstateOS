"use client";

import { useEffect, useState } from "react";

import { AssetLibraryBrowser } from "@/components/uploads/asset-library-browser";
import type { MediaLibraryAsset } from "@/modules/uploads/library";
import type { UploadPurpose } from "@/modules/uploads/config";

export function AssetPickerDialog({
  open,
  onClose,
  onSelect,
  purpose,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (asset: MediaLibraryAsset) => void;
  purpose?: UploadPurpose;
}) {
  const [assets, setAssets] = useState<MediaLibraryAsset[]>([]);

  useEffect(() => {
    if (!open) return;
    void fetch("/api/admin/assets")
      .then((response) => response.json())
      .then((json: { data?: MediaLibraryAsset[] }) => setAssets(json.data ?? []))
      .catch(() => setAssets([]));
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/35 px-4 py-4 sm:items-center sm:py-6">
      <div className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-[28px] border border-[var(--line)] bg-[var(--background)] shadow-[0_30px_120px_rgba(15,23,42,0.2)] sm:rounded-[32px]">
        <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4 sm:px-6 sm:py-5">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--brand-700)]">Tenant media library</div>
            <div className="mt-2 text-xl font-semibold text-[var(--ink-950)]">Choose an existing asset</div>
          </div>
          <button type="button" className="text-sm font-medium text-[var(--ink-500)]" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="max-h-[calc(92vh-78px)] overflow-auto p-4 sm:max-h-[calc(90vh-88px)] sm:p-6">
          <AssetLibraryBrowser assets={assets} purpose={purpose} onSelect={onSelect} />
        </div>
      </div>
    </div>
  );
}
