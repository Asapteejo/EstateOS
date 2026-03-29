import { NextResponse } from "next/server";

import { env, featureFlags } from "@/lib/env";
import { getPrivateDownloadUrl } from "@/lib/storage/r2";
import { getPublicPropertiesContext, getPublicBrochureByPropertySlug } from "@/modules/properties/queries";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const tenant = await getPublicPropertiesContext();
  const { slug } = await params;
  const brochure = await getPublicBrochureByPropertySlug(slug, tenant);

  const targetUrl =
    featureFlags.hasR2 && !env.R2_PUBLIC_BASE_URL
      ? await getPrivateDownloadUrl(brochure.storageKey)
      : env.R2_PUBLIC_BASE_URL
        ? `${env.R2_PUBLIC_BASE_URL.replace(/\/$/, "")}/${brochure.storageKey}`
        : "/brochure";

  return NextResponse.redirect(targetUrl);
}
