import { buildTenantThemeStyles, type TenantBrandingConfig } from "@/modules/branding/theme";

export function TenantThemeShell({
  branding,
  surface,
  children,
}: {
  branding: TenantBrandingConfig;
  surface: "public" | "app";
  children: React.ReactNode;
}) {
  const theme = buildTenantThemeStyles(branding, surface);

  return (
    <div className={theme.classes} style={theme.style}>
      {children}
    </div>
  );
}
