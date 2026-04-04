import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { getPrivateDownloadUrl } from "@/lib/storage/r2";
import { isPublicStorageDomain } from "@/modules/uploads/config";

function extractDomain(keyParts: string[]) {
  return keyParts[1] ?? "";
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const { key } = await params;
  const storageKey = key.join("/");
  const domain = extractDomain(key);

  if (!isPublicStorageDomain(domain)) {
    return new NextResponse("Not found.", { status: 404 });
  }

  const target = env.R2_PUBLIC_BASE_URL
    ? `${env.R2_PUBLIC_BASE_URL.replace(/\/$/, "")}/${storageKey}`
    : await getPrivateDownloadUrl(storageKey);

  return NextResponse.redirect(new URL(target, request.url));
}
