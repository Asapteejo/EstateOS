import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { env, featureFlags } from "@/lib/env";

export const r2 = featureFlags.hasR2
  ? new S3Client({
      region: "auto",
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID!,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
      },
    })
  : null;

export async function getPrivateUploadUrl(key: string, contentType: string) {
  if (!r2 || !env.R2_BUCKET_NAME) {
    return { url: "#", key, mode: "demo" as const };
  }

  const command = new PutObjectCommand({
    Bucket: env.R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  return {
    url: await getSignedUrl(r2, command, { expiresIn: 60 * 10 }),
    key,
    mode: "live" as const,
  };
}

export async function getPrivateDownloadUrl(key: string) {
  if (!r2 || !env.R2_BUCKET_NAME) {
    return "#";
  }

  const command = new GetObjectCommand({
    Bucket: env.R2_BUCKET_NAME,
    Key: key,
  });

  return getSignedUrl(r2, command, { expiresIn: 60 * 5 });
}
