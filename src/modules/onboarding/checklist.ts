/**
 * Onboarding checklist data aggregator.
 *
 * Runs all completion checks in parallel and returns a typed list of steps
 * so the UI can render progress without fetching anything itself.
 *
 * Steps (in display order):
 *   1. Workspace created        — always complete
 *   2. Company profile          — logoUrl set + supportEmail set
 *   3. Branding published       — publishedBrandingConfig written at least once
 *   4. First property listed    — Property row exists for this company
 *   5. Team member added        — TeamMember row exists for this company
 *   6. Payment account linked   — CompanyPaymentProviderAccount row exists
 *   7. First deal created       — Transaction row exists for this company
 */

import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";
import type { TenantContext } from "@/lib/tenancy/context";

export type OnboardingStep = {
  id: string;
  title: string;
  description: string;
  complete: boolean;
  href: string;
  cta: string;
};

export type OnboardingChecklist = {
  steps: OnboardingStep[];
  completedCount: number;
  totalCount: number;
  allComplete: boolean;
};

export async function getOnboardingChecklist(
  context: TenantContext,
): Promise<OnboardingChecklist> {
  const steps = buildEmptySteps();

  if (!featureFlags.hasDatabase || !context.companyId) {
    return summarise(steps);
  }

  const [company, siteSettings, propertyCount, teamCount, providerCount, transactionCount] =
    await Promise.all([
      prisma.company.findUnique({
        where: { id: context.companyId },
        select: { logoUrl: true },
      }),

      prisma.siteSettings.findUnique({
        where: { companyId: context.companyId },
        select: {
          supportEmail: true,
          publishedBrandingConfig: true,
        },
      }),

      prisma.property.count({ where: { companyId: context.companyId } }),

      prisma.teamMember.count({ where: { companyId: context.companyId } }),

      prisma.companyPaymentProviderAccount.count({
        where: { companyId: context.companyId },
      }),

      prisma.transaction.count({ where: { companyId: context.companyId } }),
    ]);

  steps[0].complete = true; // workspace always done
  steps[1].complete = Boolean(company?.logoUrl) && Boolean(siteSettings?.supportEmail);
  steps[2].complete = siteSettings?.publishedBrandingConfig != null;
  steps[3].complete = propertyCount > 0;
  steps[4].complete = teamCount > 0;
  steps[5].complete = providerCount > 0;
  steps[6].complete = transactionCount > 0;

  return summarise(steps);
}

function buildEmptySteps(): OnboardingStep[] {
  return [
    {
      id: "workspace",
      title: "Create your workspace",
      description: "Sign up and create your company workspace on EstateOS.",
      complete: false,
      href: "/app/onboarding",
      cta: "Get started",
    },
    {
      id: "profile",
      title: "Complete your company profile",
      description: "Upload your logo and add a support email so buyers can reach you.",
      complete: false,
      href: "/admin/settings",
      cta: "Open settings",
    },
    {
      id: "branding",
      title: "Publish your brand",
      description: "Customise colours, fonts, and your buyer portal appearance.",
      complete: false,
      href: "/admin/settings/branding",
      cta: "Open branding studio",
    },
    {
      id: "property",
      title: "Add your first property",
      description: "List a property so buyers can browse, enquire, and reserve.",
      complete: false,
      href: "/admin/listings",
      cta: "Add property",
    },
    {
      id: "team",
      title: "Add a team member",
      description: "Add a marketer or sales agent to your public team directory.",
      complete: false,
      href: "/admin/team",
      cta: "Manage team",
    },
    {
      id: "payment",
      title: "Connect a payment account",
      description: "Link your Paystack subaccount so buyers can pay directly.",
      complete: false,
      href: "/admin/settings",
      cta: "Connect account",
    },
    {
      id: "deal",
      title: "Create your first deal",
      description: "Raise a reservation and start tracking payments on the deal board.",
      complete: false,
      href: "/admin/deals/new",
      cta: "Create deal",
    },
  ];
}

function summarise(steps: OnboardingStep[]): OnboardingChecklist {
  const completedCount = steps.filter((s) => s.complete).length;
  return {
    steps,
    completedCount,
    totalCount: steps.length,
    allComplete: completedCount === steps.length,
  };
}
