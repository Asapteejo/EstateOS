export const DEV_ACCESS_ROUTES = {
  platformPublic: "/",
  portal: "/portal",
  admin: "/admin",
  superadmin: "/superadmin",
  onboarding: "/app/onboarding",
} as const;

export const DEV_ACCESS_PRESETS = [
  {
    label: "Public (EstateOS)",
    role: "clear",
    href: DEV_ACCESS_ROUTES.platformPublic,
  },
  {
    label: "Get Started",
    role: "clear",
    href: DEV_ACCESS_ROUTES.onboarding,
  },
  {
    label: "Portal",
    role: "buyer",
    href: DEV_ACCESS_ROUTES.portal,
  },
  {
    label: "Admin",
    role: "admin",
    href: DEV_ACCESS_ROUTES.admin,
  },
  {
    label: "Superadmin",
    role: "superadmin",
    href: DEV_ACCESS_ROUTES.superadmin,
  },
] as const;

export function buildDevTenantSiteUrl(input: {
  currentHost: string | null;
  currentProtocol: "http" | "https";
  companySlug: string | null;
  pathname?: string;
}) {
  const host = input.currentHost?.toLowerCase() ?? "localhost:3000";
  const pathname = input.pathname ?? "/";
  const resolvedHost = host.split("/")[0] ?? "localhost:3000";
  const hostname = resolvedHost.split(":")[0] ?? "localhost";
  const port = resolvedHost.includes(":") ? resolvedHost.split(":")[1] : "3000";
  const hostSlug =
    hostname.endsWith(".localhost") && !hostname.startsWith("localhost")
      ? hostname.slice(0, -".localhost".length)
      : null;
  const slug = input.companySlug?.trim() || hostSlug || null;

  if (!slug) {
    return null;
  }

  if (hostname.includes("localhost") || hostname.startsWith("127.0.0.1")) {
    return `${input.currentProtocol}://${slug}.localhost${port ? `:${port}` : ""}${pathname}`;
  }

  if (hostname.split(".").length >= 2) {
    return `${input.currentProtocol}://${slug}.${hostname}${pathname}`;
  }

  return `${input.currentProtocol}://${slug}.localhost${port ? `:${port}` : ""}${pathname}`;
}
