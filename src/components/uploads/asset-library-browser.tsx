"use client";

import { useMemo, useState } from "react";

import { OptimizedImage } from "@/components/media/optimized-image";
import {
  filterMediaLibraryAssets,
  type MediaLibraryAsset,
} from "@/modules/uploads/library";
import { uploadPurposeOptions } from "@/modules/uploads/config";

export function AssetLibraryBrowser({
  assets,
  onSelect,
  purpose,
}: {
  assets: MediaLibraryAsset[];
  onSelect?: (asset: MediaLibraryAsset) => void;
  purpose?: string;
}) {
  const [query, setQuery] = useState("");
  const [visibility, setVisibility] = useState<"ALL" | "PUBLIC" | "PRIVATE">("ALL");
  const [kind, setKind] = useState<"ALL" | "image" | "document">("ALL");
  const [purposeFilter, setPurposeFilter] = useState<string>(purpose ?? "ALL");
  const filtered = useMemo(() => {
    return filterMediaLibraryAssets(assets, {
      query,
      visibility,
      kind,
      purpose: (purpose ?? purposeFilter) as Parameters<typeof filterMediaLibraryAssets>[1]["purpose"],
    });
  }, [assets, kind, purpose, purposeFilter, query, visibility]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-[1fr_repeat(3,minmax(0,220px))]">
        <input
          className="h-11 rounded-2xl border border-[var(--line)] bg-white px-4 text-sm"
          placeholder="Search assets"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select className="h-11 rounded-2xl border border-[var(--line)] bg-white px-4 text-sm" value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}>
          <option value="ALL">All types</option>
          <option value="image">Images</option>
          <option value="document">Documents</option>
        </select>
        <select
          className="h-11 rounded-2xl border border-[var(--line)] bg-white px-4 text-sm"
          value={purpose ?? purposeFilter}
          onChange={(event) => setPurposeFilter(event.target.value)}
          disabled={Boolean(purpose)}
        >
          <option value="ALL">All purposes</option>
          {uploadPurposeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select className="h-11 rounded-2xl border border-[var(--line)] bg-white px-4 text-sm" value={visibility} onChange={(event) => setVisibility(event.target.value as typeof visibility)}>
          <option value="ALL">All visibility</option>
          <option value="PUBLIC">Public</option>
          <option value="PRIVATE">Private</option>
        </select>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((asset) => (
          <button
            key={asset.id}
            type="button"
            className="overflow-hidden rounded-3xl border border-[var(--line)] bg-white text-left transition hover:border-[var(--brand-700)]"
            onClick={() => onSelect?.(asset)}
          >
            {asset.kind === "image" && asset.url ? (
              <div className="relative h-36 w-full bg-[var(--sand-100)]">
                <OptimizedImage src={asset.url} alt={asset.fileName} fill preset="thumbnail" className="object-cover" />
              </div>
            ) : (
              <div className="flex h-36 items-center justify-center bg-[var(--sand-100)] text-sm text-[var(--ink-500)]">Document asset</div>
            )}
            <div className="space-y-2 p-4">
              <div className="line-clamp-1 text-sm font-semibold text-[var(--ink-950)]">{asset.fileName}</div>
              <div className="flex flex-wrap gap-2 text-xs text-[var(--ink-500)]">
                <span>{asset.purpose}</span>
                <span>{asset.visibility}</span>
                <span>{asset.kind}</span>
              </div>
            </div>
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[var(--line)] px-6 py-10 text-center text-sm text-[var(--ink-500)]">
          No tenant assets matched the current filters.
        </div>
      ) : null}
    </div>
  );
}
