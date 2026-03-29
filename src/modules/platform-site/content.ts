import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";

export const platformFeatures = [
  {
    title: "Listings + CRM in one operating system",
    body: "Run public inventory, inquiries, inspections, reservations, and customer follow-up from one multi-tenant platform.",
  },
  {
    title: "Transaction engine, not just a brochure site",
    body: "Move buyers from inquiry to reservation, payment, document review, receipt delivery, and milestone visibility with real workflow structure.",
  },
  {
    title: "Hybrid monetization built in",
    body: "Support monthly or annual plans plus transaction commission, manual superadmin grants, and provider-aware split settlement design.",
  },
  {
    title: "Multi-tenant by default",
    body: "EstateOS keeps tenant/company boundaries explicit while still giving the platform owner safe cross-company operational visibility.",
  },
];

export const platformHowItWorks = [
  {
    title: "Launch a tenant company",
    body: "Provision a real estate company with its own inventory, staff, buyers, branding direction, billing state, and payout configuration.",
  },
  {
    title: "Run buyer operations cleanly",
    body: "Let buyer-facing flows handle profile completion, KYC, reservations, payments, documents, and transaction progress in one experience.",
  },
  {
    title: "Control revenue centrally",
    body: "Track plan state, grants, commission records, payout readiness, and recent platform-wide billing and payment events from the superadmin surface.",
  },
];

export const platformWhyEstateOS = [
  "Built for real estate companies, not adapted from generic ecommerce logic.",
  "Separates platform owner, tenant admin, and buyer surfaces clearly.",
  "Supports commissionable grants without weakening monetization rules.",
  "Prepared for local and international payment provider strategies.",
];

export const platformFaqs = [
  {
    question: "Is EstateOS just a website builder?",
    answer: "No. It is a real estate SaaS that combines listings, CRM, transaction workflow, buyer portal, billing, and platform operations.",
  },
  {
    question: "Can a company be granted a plan manually?",
    answer: "Yes. A SUPER_ADMIN can grant plan access manually, but transaction commission still applies on successful property payments.",
  },
  {
    question: "Are international providers live?",
    answer: "The architecture is provider-ready and currency-aware. Paystack is the active transaction payment path today; broader international provider activation is follow-up work.",
  },
];

export async function getPlatformPricingPlans() {
  if (!featureFlags.hasDatabase) {
    return [
      {
        code: "growth",
        name: "Growth monthly",
        interval: "MONTHLY",
        priceAmount: 150000,
        currency: "NGN",
        description: "Monthly operations plan for one real estate company.",
      },
      {
        code: "growth",
        name: "Growth annual",
        interval: "ANNUAL",
        priceAmount: 1500000,
        currency: "NGN",
        description: "Annual operating plan with the same transaction and portal capabilities.",
      },
    ];
  }

  return prisma.plan.findMany({
    where: {
      isActive: true,
      isPublic: true,
    },
    orderBy: [{ code: "asc" }, { interval: "asc" }],
    select: {
      code: true,
      name: true,
      interval: true,
      priceAmount: true,
      currency: true,
      description: true,
    },
  }).then((plans) =>
    plans.map((plan) => ({
      code: plan.code,
      name: plan.name,
      interval: plan.interval,
      priceAmount: plan.priceAmount.toNumber(),
      currency: plan.currency,
      description: plan.description,
    })),
  );
}
