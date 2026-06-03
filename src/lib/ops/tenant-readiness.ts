export type ReadinessStatus = "complete" | "warning" | "missing";
export type ReadinessOwner = "Tenant Admin" | "Superadmin" | "Platform";

export type TenantReadinessItem = {
  id:
    | "company-profile"
    | "logo"
    | "branding"
    | "property-inventory"
    | "payment-account"
    | "paystack-platform"
    | "contract-settings"
    | "company-stamp"
    | "authorized-signature"
    | "custom-domain"
    | "r2-storage"
    | "public-site";
  label: string;
  status: ReadinessStatus;
  owner: ReadinessOwner;
  actionLink: string;
  explanation: string;
};

export type TenantReadinessInput = {
  companyExists: boolean;
  companyActive: boolean;
  companyProfileComplete?: boolean;
  adminUsers: number;
  brandingConfigured: boolean;
  logoConfigured: boolean;
  faviconConfigured?: boolean;
  heroConfigured?: boolean;
  propertiesCount: number;
  paymentAccountConfigured: boolean;
  paystackConfigured: boolean;
  contractSettingsConfigured: boolean;
  stampConfigured: boolean;
  signatureConfigured: boolean;
  customDomainConfigured?: boolean;
  customDomainSkipped?: boolean;
  r2Configured: boolean;
  publicSiteReachable?: boolean;
  walletConfigured: boolean;
  companyId?: string;
};

function status(complete: boolean, warning = false): ReadinessStatus {
  if (complete) return "complete";
  return warning ? "warning" : "missing";
}

function adminLink(path: string) {
  return path;
}

function superadminLink(companyId: string | undefined, suffix = "") {
  return companyId ? `/superadmin/companies/${companyId}${suffix}` : "/superadmin/companies";
}

export function buildTenantReadinessChecklist(input: TenantReadinessInput): TenantReadinessItem[] {
  if (!input.companyExists) {
    return [{
      id: "company-profile",
      label: "Company profile",
      status: "missing",
      owner: "Superadmin",
      actionLink: "/superadmin/companies/new",
      explanation: "Create the tenant company before any go-live work can continue.",
    }];
  }

  const customDomainStatus: ReadinessStatus = input.customDomainConfigured
    ? "complete"
    : input.customDomainSkipped
      ? "warning"
      : "missing";

  return [
    {
      id: "company-profile",
      label: "Company profile",
      status: status(input.companyActive && input.adminUsers > 0 && input.companyProfileComplete !== false),
      owner: "Tenant Admin",
      actionLink: adminLink("/admin/settings"),
      explanation: "Company must be active and have at least one tenant operator.",
    },
    {
      id: "logo",
      label: "Logo",
      status: status(input.logoConfigured),
      owner: "Tenant Admin",
      actionLink: adminLink("/admin/settings/branding"),
      explanation: "Upload a company logo so public pages, admin, and buyer portal show tenant identity.",
    },
    {
      id: "branding",
      label: "Branding",
      status: status(input.brandingConfigured),
      owner: "Tenant Admin",
      actionLink: adminLink("/admin/settings/branding"),
      explanation: "Publish branding from the branding studio after checking contrast and public layout.",
    },
    {
      id: "property-inventory",
      label: "Property inventory",
      status: status(input.propertiesCount > 0),
      owner: "Tenant Admin",
      actionLink: adminLink("/admin/listings"),
      explanation: "List at least one property before opening the public tenant site.",
    },
    {
      id: "payment-account",
      label: "Payment account",
      status: status(input.paymentAccountConfigured),
      owner: "Tenant Admin",
      actionLink: adminLink("/admin/settings"),
      explanation: "Connect the tenant Paystack subaccount so buyer payments can settle correctly.",
    },
    {
      id: "paystack-platform",
      label: "Paystack platform readiness",
      status: status(input.paystackConfigured),
      owner: "Platform",
      actionLink: "/superadmin/settings",
      explanation: "Platform live Paystack keys must be configured before real checkout and subaccount setup.",
    },
    {
      id: "contract-settings",
      label: "Contract settings",
      status: status(input.contractSettingsConfigured),
      owner: "Tenant Admin",
      actionLink: adminLink("/admin/settings/contracts"),
      explanation: "Configure lawyer-approved terms and authorized signatory details.",
    },
    {
      id: "company-stamp",
      label: "Company stamp",
      status: status(input.stampConfigured),
      owner: "Tenant Admin",
      actionLink: adminLink("/admin/settings/contracts"),
      explanation: "Upload the private company stamp used in generated Contract of Sale PDFs.",
    },
    {
      id: "authorized-signature",
      label: "Authorized signature",
      status: status(input.signatureConfigured),
      owner: "Tenant Admin",
      actionLink: adminLink("/admin/settings/contracts"),
      explanation: "Upload the private authorized signatory signature used in generated contracts.",
    },
    {
      id: "custom-domain",
      label: "Custom domain",
      status: customDomainStatus,
      owner: input.customDomainConfigured ? "Tenant Admin" : "Superadmin",
      actionLink: input.companyId
        ? superadminLink(input.companyId, "/domains")
        : adminLink("/admin/settings"),
      explanation: input.customDomainSkipped
        ? "Custom domain was intentionally skipped; EstateOS subdomain remains available."
        : "Configure and verify a custom domain or intentionally skip it before go-live.",
    },
    {
      id: "r2-storage",
      label: "R2 private storage",
      status: status(input.r2Configured),
      owner: "Platform",
      actionLink: "/api/readyz",
      explanation: "Private storage must be configured for documents, contracts, stamps, and signatures.",
    },
    {
      id: "public-site",
      label: "Public site reachability",
      status: status(Boolean(input.publicSiteReachable), input.propertiesCount > 0 && input.companyActive),
      owner: "Superadmin",
      actionLink: input.companyId ? superadminLink(input.companyId, "/qa") : "/admin/settings",
      explanation: "Public site should resolve after domain/subdomain, branding, and inventory are ready.",
    },
  ];
}

export function summarizeTenantReadiness(input: TenantReadinessInput) {
  const checklist = buildTenantReadinessChecklist(input);
  const missingItems = checklist
    .filter((item) => item.status === "missing")
    .map((item) => item.label);
  const warningItems = checklist
    .filter((item) => item.status === "warning")
    .map((item) => item.label);

  return {
    status: !input.companyExists
      ? "Not ready" as const
      : missingItems.length === 0
        ? warningItems.length === 0
          ? "Ready" as const
          : "Partially ready" as const
        : "Partially ready" as const,
    missingItems,
    warningItems,
    checklist,
    warnings: input.walletConfigured ? [] : ["WhatsApp communication wallet is not initialized."],
  };
}

export function buildTenantReadiness(input: TenantReadinessInput) {
  const summary = summarizeTenantReadiness(input);
  if (!input.companyExists) {
    return {
      status: summary.status,
      missingItems: ["company"],
    };
  }

  return summary;
}
