import type { Prisma } from "@prisma/client";

import { getUploadPurposeConfig, type UploadPurpose } from "@/modules/uploads/config";

export function buildUploadDocumentMetadata(purpose: UploadPurpose) {
  const config = getUploadPurposeConfig(purpose);
  return {
    purpose,
    assetLabel: config.label,
    visibility: config.visibility,
  } satisfies Prisma.InputJsonValue;
}
