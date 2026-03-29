export function resolveBrochureRedirectUrl(
  requestUrl: string,
  targetUrl?: string | null,
) {
  if (!targetUrl) {
    return new URL("/brochure", requestUrl);
  }

  try {
    return new URL(targetUrl);
  } catch {
    return new URL(targetUrl, requestUrl);
  }
}
