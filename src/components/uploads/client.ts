import type { UploadPurpose } from "@/modules/uploads/config";

const kycAllowedMimeTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

const contractAssetAllowedMimeTypes = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

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

/**
 * PUTs the file to the presigned URL via XHR so upload progress can be
 * reported (the Fetch API does not expose request-body upload progress).
 * Preserves the prior fetch semantics exactly: PUT, the Content-Type header,
 * and the "Unable to upload file." failure message on any non-2xx/transport
 * error. `onProgress` receives an integer 0–100 as bytes are sent.
 */
function putFileWithProgress(
  url: string,
  file: File,
  contentType: string,
  onProgress?: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error("Unable to upload file."));
      }
    };
    xhr.onerror = () => reject(new Error("Unable to upload file."));
    xhr.send(file);
  });
}

export async function uploadTenantFile(input: {
  file: File;
  purpose: UploadPurpose;
  surface: "admin" | "portal";
  mode: "publicAsset" | "document" | "preparedUpload";
  allowExternalUrl?: boolean;
  onProgress?: (percent: number) => void;
}) {
  if (input.purpose === "KYC_DOCUMENT" && !kycAllowedMimeTypes.has((input.file.type || "").toLowerCase())) {
    throw new Error("KYC documents must be PDF, JPG, PNG, or WEBP files.");
  }
  if (
    (input.purpose === "COMPANY_STAMP" || input.purpose === "COMPANY_SIGNATURE") &&
    !contractAssetAllowedMimeTypes.has((input.file.type || "").toLowerCase())
  ) {
    throw new Error("Contract stamp and signature uploads must be PNG, JPG, or WEBP images.");
  }

  const signResponse = await fetch("/api/uploads/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      surface: input.surface,
      purpose: input.purpose,
      fileName: input.file.name,
      contentType: input.file.type || "application/octet-stream",
      sizeBytes: input.file.size,
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
    await putFileWithProgress(
      signed.data.url,
      input.file,
      input.file.type || "application/octet-stream",
      input.onProgress,
    );
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
