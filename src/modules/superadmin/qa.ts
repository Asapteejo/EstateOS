import { Prisma } from "@prisma/client";

import { env, featureFlags } from "@/lib/env";
import { prisma } from "@/lib/db/prisma";

export type QaStatus = "PASS" | "WARN" | "FAIL";

export type QaCheck = {
  label: string;
  status: QaStatus;
  detail: string;
};

export type QaSection = {
  title: string;
  checks: QaCheck[];
};

type SecretKeyStatus = "Configured" | "Missing";
type SecretStatusMap<TKey extends string> = Record<TKey, SecretKeyStatus>;

type PaystackKey =
  | "PAYSTACK_SECRET_KEY"
  | "PAYSTACK_PUBLIC_KEY"
  | "PAYSTACK_WEBHOOK_SECRET";

type R2Key =
  | "R2_ACCOUNT_ID"
  | "R2_ACCESS_KEY_ID"
  | "R2_SECRET_ACCESS_KEY"
  | "R2_BUCKET_NAME"
  | "R2_PUBLIC_BASE_URL";

type EnvLike = Record<string, string | undefined>;

type CompanyQaRecord = {
  id: string;
  name: string;
  slug: string;
  status: "ACTIVE" | "SUSPENDED" | "DISABLED";
  subdomain: string | null;
  customDomain: string | null;
  siteSetting: { id: string } | null;
  billingSettings: {
    transactionProvider: string;
    subscriptionProvider: string | null;
    notes: string | null;
  } | null;
  subscriptions: Array<{
    id: string;
    status: string;
    startsAt: Date;
    endsAt: Date | null;
    billingProvider: string | null;
    metadata: Prisma.JsonValue | null;
    plan: {
      name: string;
      slug: string;
    };
  }>;
  _count: {
    properties: number;
    inquiries: number;
  };
};

export function envKeyStatus(value: string | null | undefined): SecretKeyStatus {
  return value && value.trim().length > 0 ? "Configured" : "Missing";
}

export function buildPaystackSecretStatus(raw: EnvLike): SecretStatusMap<PaystackKey> {
  return {
    PAYSTACK_SECRET_KEY: envKeyStatus(raw.PAYSTACK_SECRET_KEY),
    PAYSTACK_PUBLIC_KEY: envKeyStatus(raw.PAYSTACK_PUBLIC_KEY),
    PAYSTACK_WEBHOOK_SECRET: envKeyStatus(raw.PAYSTACK_WEBHOOK_SECRET),
  };
}

export function buildR2SecretStatus(raw: EnvLike): SecretStatusMap<R2Key> {
  return {
    R2_ACCOUNT_ID: envKeyStatus(raw.R2_ACCOUNT_ID),
    R2_ACCESS_KEY_ID: envKeyStatus(raw.R2_ACCESS_KEY_ID),
    R2_SECRET_ACCESS_KEY: envKeyStatus(raw.R2_SECRET_ACCESS_KEY),
    R2_BUCKET_NAME: envKeyStatus(raw.R2_BUCKET_NAME),
    R2_PUBLIC_BASE_URL: envKeyStatus(raw.R2_PUBLIC_BASE_URL),
  };
}

export function allConfigured(statuses: Record<string, SecretKeyStatus>) {
  return Object.values(statuses).every((status) => status === "Configured");
}

export function buildPaymentQaChecks(input: {
  billingMode: string;
  paystack: SecretStatusMap<PaystackKey>;
}): QaCheck[] {
  const paystackReady = allConfigured(input.paystack);
  const checks: QaCheck[] = [
    ...Object.entries(input.paystack).map(([key, status]) => ({
      label: key,
      status: status === "Configured" ? "PASS" as const : "FAIL" as const,
      detail: status,
    })),
    {
      label: "Billing mode",
      status: "PASS",
      detail: input.billingMode,
    },
    {
      label: "Real payment testing",
      status: paystackReady && input.billingMode === "PAID" ? "PASS" : input.billingMode === "PAID" ? "FAIL" : "WARN",
      detail:
        paystackReady && input.billingMode === "PAID"
          ? "Paystack is configured for real payment testing."
          : input.billingMode === "PAID"
            ? "PAID billing requires all Paystack keys before real payment testing."
            : "Manual/trial tenants can test app flows without Paystack, but real payments are not enabled.",
    },
  ];

  if (input.billingMode === "MANUAL_OVERRIDE" && !paystackReady) {
    checks.push({
      label: "Manual billing warning",
      status: "WARN",
      detail: "This tenant can bypass payment for walkthroughs; configure Paystack before testing real payments.",
    });
  }

  return checks;
}

export function buildStorageQaChecks(input: {
  r2: SecretStatusMap<R2Key>;
}): QaCheck[] {
  const coreR2 = {
    R2_ACCOUNT_ID: input.r2.R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID: input.r2.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: input.r2.R2_SECRET_ACCESS_KEY,
    R2_BUCKET_NAME: input.r2.R2_BUCKET_NAME,
  };
  const r2Ready = allConfigured(coreR2);

  return [
    ...Object.entries(coreR2).map(([key, status]) => ({
      label: key,
      status: status === "Configured" ? "PASS" as const : "FAIL" as const,
      detail: status,
    })),
    {
      label: "R2_PUBLIC_BASE_URL",
      status: input.r2.R2_PUBLIC_BASE_URL === "Configured" ? "PASS" : "WARN",
      detail:
        input.r2.R2_PUBLIC_BASE_URL === "Configured"
          ? "Configured"
          : "Missing. Private documents still work; public assets use the signed proxy fallback.",
    },
    {
      label: "Upload testing",
      status: r2Ready ? "PASS" : "FAIL",
      detail: r2Ready
        ? "R2 is configured for document and property media upload tests."
        : "Document/property image upload features may fail until all R2 values are configured.",
    },
  ];
}

export function manualBillingAllowsWalkthrough(input: {
  billingMode: string;
  subscriptionStatus: string;
}) {
  return (
    input.billingMode === "MANUAL_OVERRIDE" &&
    ["GRANTED", "ACTIVE", "TRIAL"].includes(input.subscriptionStatus)
  );
}

function getSubscriptionMetadata(metadata: Prisma.JsonValue | null) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }

  return metadata as Record<string, unknown>;
}

function resolveBillingMode(company: CompanyQaRecord) {
  const current = company.subscriptions[0] ?? null;
  const metadata = getSubscriptionMetadata(current?.metadata ?? null);
  const metadataMode = typeof metadata.billingMode === "string" ? metadata.billingMode : null;

  if (metadataMode) {
    return metadataMode;
  }

  if (company.billingSettings?.subscriptionProvider === "MANUAL" || current?.billingProvider === "MANUAL") {
    return "MANUAL_OVERRIDE";
  }

  if (current?.status === "TRIAL") {
    return "TRIAL";
  }

  return current ? "PAID" : "NOT_SET";
}

function publicUrlForCompany(company: CompanyQaRecord) {
  if (company.customDomain) {
    return `https://${company.customDomain}`;
  }

  if (featureFlags.isProduction) {
    return `https://${company.subdomain ?? company.slug}.estateos.com`;
  }

  return `${env.PLATFORM_BASE_URL}/properties?tenant=${encodeURIComponent(company.slug)}`;
}

function check(label: string, pass: boolean, detail: string, warnInstead = false): QaCheck {
  return {
    label,
    status: pass ? "PASS" : warnInstead ? "WARN" : "FAIL",
    detail,
  };
}

function buildNextStep(input: {
  adminReady: boolean;
  buyerReady: boolean;
  realPaymentsReady: boolean;
  uploadsReady: boolean;
}) {
  if (input.adminReady && input.buyerReady && input.realPaymentsReady && input.uploadsReady) {
    return "This tenant is ready for admin walkthroughs, buyer portal testing, real payments, and uploads.";
  }

  if (input.adminReady && input.buyerReady) {
    const blockers = [
      input.realPaymentsReady ? null : "real payments need Paystack keys and PAID billing",
      input.uploadsReady ? null : "uploads need R2 keys",
    ].filter(Boolean);

    return `You can test admin/buyer flows now, but ${blockers.join(" and ")}.`;
  }

  return "Fix failed tenant/admin/buyer readiness checks before starting the walkthrough.";
}

export async function getSuperadminCompanyQaChecklist(companyId: string) {
  if (!featureFlags.hasDatabase) {
    throw new Error("Database is required for QA checklist.");
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      subdomain: true,
      customDomain: true,
      siteSetting: { select: { id: true } },
      billingSettings: {
        select: {
          transactionProvider: true,
          subscriptionProvider: true,
          notes: true,
        },
      },
      subscriptions: {
        where: { isCurrent: true },
        orderBy: { startsAt: "desc" },
        take: 1,
        select: {
          id: true,
          status: true,
          startsAt: true,
          endsAt: true,
          billingProvider: true,
          metadata: true,
          plan: {
            select: {
              name: true,
              slug: true,
            },
          },
        },
      },
      _count: {
        select: {
          properties: true,
          inquiries: true,
        },
      },
    },
  });

  if (!company) {
    throw new Error("Company not found.");
  }

  const [adminCount, buyerClientCount] = await Promise.all([
    prisma.user.count({
      where: {
        companyId,
        roles: {
          some: {
            companyId,
            role: { companyId, name: "ADMIN" },
          },
        },
      },
    }),
    prisma.user.count({
      where: {
        companyId,
        NOT: {
          roles: {
            some: {
              companyId,
              role: { companyId, name: "ADMIN" },
            },
          },
        },
      },
    }),
  ]);

  const currentSubscription = company.subscriptions[0] ?? null;
  const billingMode = resolveBillingMode(company);
  const publicUrl = publicUrlForCompany(company);
  const paystack = buildPaystackSecretStatus(process.env);
  const r2 = buildR2SecretStatus(process.env);
  const paystackReady = allConfigured(paystack);
  const r2Ready = allConfigured(r2);
  const adminReady =
    company.status === "ACTIVE" &&
    Boolean(currentSubscription) &&
    adminCount > 0 &&
    (billingMode !== "PAID" || paystackReady);
  const buyerReady =
    company.status === "ACTIVE" &&
    Boolean(company.slug) &&
    (buyerClientCount > 0 || !featureFlags.isProduction);
  const defaultSlugMatches = env.DEFAULT_COMPANY_SLUG === company.slug;
  const manualWalkthrough = manualBillingAllowsWalkthrough({
    billingMode,
    subscriptionStatus: currentSubscription?.status ?? "NOT_SET",
  });

  const tenantReadiness: QaCheck[] = [
    check("Company exists", true, `${company.name} was found.`),
    check("Company slug exists", Boolean(company.slug), company.slug || "Missing slug."),
    check("Company is active", company.status === "ACTIVE", `Current status: ${company.status}`),
    check("Plan is set", Boolean(currentSubscription?.plan), currentSubscription?.plan.name ?? "No current plan."),
    check("Billing mode is set", billingMode !== "NOT_SET", billingMode),
    check(
      "Subscription override status",
      Boolean(currentSubscription),
      currentSubscription
        ? `${currentSubscription.status} via ${currentSubscription.billingProvider ?? "default provider"}`
        : "No current subscription.",
    ),
    check(
      "Subscription expiry",
      true,
      currentSubscription?.endsAt ? currentSubscription.endsAt.toISOString().slice(0, 10) : "No expiry/lifetime access.",
      true,
    ),
    check("Company admin/owner exists", adminCount > 0, `${adminCount} admin user(s) linked to this company.`),
    check("At least one property/listing exists", company._count.properties > 0, `${company._count.properties} listing(s).`),
    check("At least one buyer/client exists", buyerClientCount > 0, `${buyerClientCount} buyer/client user(s).`, !featureFlags.isProduction),
    check("At least one inquiry exists", company._count.inquiries > 0, `${company._count.inquiries} inquiry record(s).`, true),
    check("Tenant branding/settings exists", Boolean(company.siteSetting), company.siteSetting ? "Site settings found." : "Site settings missing.", true),
  ];

  const adminWalkthrough: QaCheck[] = [
    {
      label: "Admin dev link",
      status: !featureFlags.isProduction && featureFlags.allowDevBypass ? "PASS" : "WARN",
      detail: "/api/dev/session?role=admin&redirectTo=/admin",
    },
    check("Admin user/role exists", adminCount > 0, `${adminCount} admin user(s) with company ADMIN role.`),
    {
      label: "Manual billing bypass",
      status: manualWalkthrough ? "PASS" : billingMode === "PAID" ? "WARN" : "FAIL",
      detail: manualWalkthrough
        ? "Tenant can bypass payment for admin/buyer walkthroughs."
        : billingMode === "PAID"
          ? "PAID tenant should use Paystack for payment testing."
          : "No usable manual/trial subscription override found.",
    },
  ];

  const buyerPortal: QaCheck[] = [
    check("Buyer portal configured", Boolean(company.slug), publicUrl),
    {
      label: "DEFAULT_COMPANY_SLUG",
      status: featureFlags.isProduction || defaultSlugMatches ? "PASS" : "WARN",
      detail: featureFlags.isProduction
        ? "Production tenant routing does not depend on DEFAULT_COMPANY_SLUG."
        : defaultSlugMatches
          ? `DEFAULT_COMPANY_SLUG matches ${company.slug}.`
          : `Set DEFAULT_COMPANY_SLUG=${company.slug} for dev session routing. Current: ${env.DEFAULT_COMPANY_SLUG ?? "missing"}.`,
    },
    {
      label: "Public/buyer portal URL preview",
      status: "PASS",
      detail: publicUrl,
    },
    {
      label: "Test buyer session",
      status: !featureFlags.isProduction && featureFlags.allowDevBypass ? "PASS" : "WARN",
      detail: !featureFlags.isProduction
        ? "/api/dev/session?role=buyer&redirectTo=/portal"
        : "Use real Clerk buyer auth in production.",
    },
  ];

  const sections: QaSection[] = [
    { title: "Tenant readiness", checks: tenantReadiness },
    { title: "Admin walkthrough", checks: adminWalkthrough },
    { title: "Buyer portal", checks: buyerPortal },
    { title: "Payment readiness", checks: buildPaymentQaChecks({ billingMode, paystack }) },
    { title: "File/storage readiness", checks: buildStorageQaChecks({ r2 }) },
  ];

  return {
    company: {
      id: company.id,
      name: company.name,
      slug: company.slug,
      status: company.status,
    },
    billingMode,
    publicUrl,
    adminDevLink: "/api/dev/session?role=admin&redirectTo=/admin",
    buyerDevLink: "/api/dev/session?role=buyer&redirectTo=/portal",
    nextStep: buildNextStep({
      adminReady,
      buyerReady,
      realPaymentsReady: paystackReady && billingMode === "PAID",
      uploadsReady: r2Ready,
    }),
    sections,
  };
}
