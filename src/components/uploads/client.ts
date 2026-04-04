import type { UploadPurpose } from "@/modules/uploads/config";

export type UploadedAssetResult = {
  fileName: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  url?: string | null;
  documentId?: string | null;
};

type SignedUploadResponse = {
  data?: {
    key: string;
    url: string;
    mode: "live" | "demo";
    assetUrl?: string | null;
  };
};

export async function uploadTenantFile(input: {
  file: File;
  purpose: UploadPurpose;
  surface: "admin" | "portal";
  mode: "publicAsset" | "document" | "preparedUpload";
  allowExternalUrl?: boolean;
}) {
  const signResponse = await fetch("/api/uploads/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      surface: input.surface,
      purpose: input.purpose,
      fileName: input.file.name,
      contentType: input.file.type || "application/octet-stream",
    }),
  });

  if (!signResponse.ok) {
    const json = (await signResponse.json().catch(() => null)) as { error?: string } | null;
    throw new Error(json?.error ?? "Unable to prepare upload.");
  }

  const signed = (await signResponse.json()) as SignedUploadResponse;
  if (!signed.data) {
    throw new Error("Upload preparation returned an empty response.");
  }

  if (signed.data.mode === "live") {
    const uploadResponse = await fetch(signed.data.url, {
      method: "PUT",
      body: input.file,
      headers: {
        "Content-Type": input.file.type || "application/octet-stream",
      },
    });

    if (!uploadResponse.ok) {
      throw new Error("Unable to upload file.");
    }
  } else if (!input.allowExternalUrl && input.mode === "publicAsset") {
    throw new Error("Storage is not configured for direct uploads here yet. Use an external asset URL in local development.");
  }

  const baseResult: UploadedAssetResult = {
    fileName: input.file.name,
    storageKey: signed.data.key,
    mimeType: input.file.type || "application/octet-stream",
    sizeBytes: input.file.size,
    url: signed.data.assetUrl ?? null,
  };

  if (input.mode === "publicAsset" || input.mode === "preparedUpload") {
    return baseResult;
  }

  const completeResponse = await fetch("/api/uploads/documents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      surface: input.surface,
      purpose: input.purpose,
      fileName: input.file.name,
      storageKey: signed.data.key,
      mimeType: input.file.type || "application/octet-stream",
      sizeBytes: input.file.size,
    }),
  });

  if (!completeResponse.ok) {
    const json = (await completeResponse.json().catch(() => null)) as { error?: string } | null;
    throw new Error(json?.error ?? "Unable to finalize uploaded document.");
  }

  const completed = (await completeResponse.json()) as {
    data?: { id: string; fileName: string; storageKey: string };
  };

  return {
    ...baseResult,
    documentId: completed.data?.id ?? null,
    fileName: completed.data?.fileName ?? input.file.name,
    storageKey: completed.data?.storageKey ?? signed.data.key,
  };
}
