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
  const slug = input.companySlug?.trim() || "acme-realty";

  if (host.includes("localhost") || host.startsWith("127.0.0.1")) {
    const port = host.includes(":") ? host.split(":")[1] : "3000";
    return `${input.currentProtocol}://${slug}.localhost${port ? `:${port}` : ""}${pathname}`;
  }

  return pathname;
}
