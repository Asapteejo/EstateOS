"use client";

import { useEffect, useState } from "react";

import { AssetLibraryBrowser } from "@/components/uploads/asset-library-browser";
import { Dialog } from "@/components/ui/dialog";
import type { MediaLibraryAsset } from "@/modules/uploads/library";
import type { UploadPurpose } from "@/modules/uploads/config";

/**
 * Tenant media library picker — migrated to the shared Dialog primitive
 * (portal, Escape/backdrop close, scroll lock, focus trap + restore). Assets
 * load lazily when the dialog opens, as before.
 */
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

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Choose an existing asset"
      description="Tenant media library"
      size="xl"
    >
      <AssetLibraryBrowser assets={assets} purpose={purpose} onSelect={onSelect} />
    </Dialog>
  );
}
