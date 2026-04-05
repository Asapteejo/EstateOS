export const DEV_ACCESS_ROUTES = {
  platformPublic: "/platform",
  tenantHome: "/",
  tenantProperties: "/properties",
  portal: "/portal",
  admin: "/admin",
  superadmin: "/superadmin",
} as const;

export const DEV_ACCESS_PRESETS = [
  {
    label: "Public (EstateOS)",
    role: "clear",
    href: DEV_ACCESS_ROUTES.platformPublic,
  },
  {
    label: "Tenant Site",
    role: "clear",
    href: DEV_ACCESS_ROUTES.tenantHome,
  },
  {
    label: "Properties",
    role: "clear",
    href: DEV_ACCESS_ROUTES.tenantProperties,
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
