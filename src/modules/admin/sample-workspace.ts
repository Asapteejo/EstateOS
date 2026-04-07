import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";
import type { TenantContext } from "@/lib/tenancy/context";
import { PRODUCT_EVENT_NAMES, trackProductEvent } from "@/modules/analytics/activity";

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function loadSampleWorkspaceForTenant(context: TenantContext) {
  if (!featureFlags.hasDatabase || !context.companyId) {
    throw new Error("Sample workspace requires a real database-backed tenant.");
  }

  const company = await prisma.company.findUnique({
    where: {
      id: context.companyId,
    },
    select: {
      id: true,
      slug: true,
      name: true,
      branches: {
        orderBy: {
          createdAt: "asc",
        },
        take: 1,
        select: {
          id: true,
        },
      },
    },
  });

  if (!company) {
    throw new Error("Company not found.");
  }

  const existing = await Promise.all([
    prisma.activityEvent.findFirst({
      where: {
        companyId: context.companyId,
        eventName: PRODUCT_EVENT_NAMES.sampleWorkspaceLoaded,
      },
      select: { id: true },
    }),
    prisma.transaction.count({ where: { companyId: context.companyId } }),
    prisma.inquiry.count({ where: { companyId: context.companyId } }),
  ]);

  if (existing[0] || existing[1] > 0 || existing[2] > 0) {
    return {
      loaded: false,
      reason: "Workspace already has live deal data. Sample data was not injected.",
    };
  }

  let buyerRole = await prisma.role.findUnique({
    where: {
      companyId_name: {
        companyId: context.companyId,
        name: "BUYER",
      },
    },
    select: {
      id: true,
    },
  });

  if (!buyerRole) {
    buyerRole = await prisma.role.create({
      data: {
        companyId: context.companyId,
        name: "BUYER",
        label: "Buyer",
      },
      select: {
        id: true,
      },
    });
  }

  const branchId =
    company.branches[0]?.id ??
    (
      await prisma.branch.create({
        data: {
          companyId: context.companyId,
          name: "HQ",
          slug: "hq",
          city: "Lagos",
          state: "Lagos",
        },
        select: {
          id: true,
        },
      })
    ).id;

  const existingMarketer = await prisma.teamMember.findFirst({
    where: {
      companyId: context.companyId,
      isActive: true,
    },
    orderBy: {
      createdAt: "asc",
    },
    select: {
      id: true,
      fullName: true,
      title: true,
    },
  });

  const marketer =
    existingMarketer ??
    (await prisma.teamMember.create({
      data: {
        companyId: context.companyId,
        fullName: "Amina Yusuf",
        slug: "amina-yusuf",
        title: "Senior Sales Marketer",
        bio: "Leads high-intent buyer follow-up and installment conversion for flagship developments.",
        email: `amina+${company.slug}@estateos-demo.dev`,
        phone: "+234 810 000 1100",
        whatsappNumber: "+234 810 000 1100",
        staffCode: "MKT-001",
        officeLocation: "Lagos HQ",
        specialties: ["Off-plan sales", "Collections follow-up"] as Prisma.InputJsonValue,
        profileHighlights: ["Handles tour-to-reservation conversion", "Supports collections follow-up"] as Prisma.InputJsonValue,
        sortOrder: 0,
        isActive: true,
        isPublished: true,
      },
      select: {
        id: true,
        fullName: true,
        title: true,
      },
    }));

  const property = await prisma.property.create({
    data: {
      companyId: context.companyId,
      branchId,
      title: "Orchid Ridge Residences",
      slug: `${slugify("Orchid Ridge Residences")}-${company.slug}`,
      shortDescription: "High-demand estate designed for structured off-plan sales and collections.",
      description: "A realistic sample development for demoing inquiry tracking, reservations, and installment collections.",
      propertyType: "APARTMENT",
      status: "AVAILABLE",
      isFeatured: true,
      priceFrom: 92000000,
      priceTo: 138000000,
      currency: "NGN",
      bedrooms: 3,
      bathrooms: 3,
      parkingSpaces: 2,
      locationSummary: "Lekki Phase 1, Lagos",
      hasPaymentPlan: true,
      verificationStatus: "VERIFIED",
      lastVerifiedAt: new Date(),
      verificationDueAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14),
      isPubliclyVisible: true,
      wishlistDurationDays: 14,
    },
    select: {
      id: true,
      title: true,
    },
  });

  await prisma.propertyLocation.create({
    data: {
      companyId: context.companyId,
      propertyId: property.id,
      city: "Lagos",
      state: "Lagos",
      country: "Nigeria",
      addressLine1: "4 Admiralty Way, Lekki Phase 1",
    },
  });

  const units = await Promise.all([
    prisma.propertyUnit.create({
      data: {
        companyId: context.companyId,
        propertyId: property.id,
        unitCode: "A-101",
        title: "Block A / Unit 101",
        status: "AVAILABLE",
        price: 92000000,
        bedrooms: 3,
        bathrooms: 3,
      },
      select: { id: true, title: true, price: true },
    }),
    prisma.propertyUnit.create({
      data: {
        companyId: context.companyId,
        propertyId: property.id,
        unitCode: "B-202",
        title: "Block B / Unit 202",
        status: "AVAILABLE",
        price: 116000000,
        bedrooms: 4,
        bathrooms: 4,
      },
      select: { id: true, title: true, price: true },
    }),
    prisma.propertyUnit.create({
      data: {
        companyId: context.companyId,
        propertyId: property.id,
        unitCode: "C-303",
        title: "Block C / Unit 303",
        status: "AVAILABLE",
        price: 138000000,
        bedrooms: 4,
        bathrooms: 4,
      },
      select: { id: true, title: true, price: true },
    }),
  ]);

  const paymentPlan = await prisma.paymentPlan.create({
    data: {
      companyId: context.companyId,
      propertyId: property.id,
      title: "12-month developer installment plan",
      kind: "FIXED",
      description: "Structured sample plan for demoing requests, overdue follow-up, and receipts.",
      scheduleDescription: "40% deposit, then staged milestone payments.",
      durationMonths: 12,
      installmentCount: 3,
      isActive: true,
    },
    select: {
      id: true,
    },
  });

  const installments = await Promise.all([
    prisma.installment.create({
      data: {
        companyId: context.companyId,
        paymentPlanId: paymentPlan.id,
        title: "Reservation deposit",
        amount: 36800000,
        dueInDays: 0,
        scheduleLabel: "Immediately after reservation",
        sortOrder: 0,
      },
      select: { id: true, amount: true },
    }),
    prisma.installment.create({
      data: {
        companyId: context.companyId,
        paymentPlanId: paymentPlan.id,
        title: "Construction milestone",
        amount: 27600000,
        dueInDays: 60,
        scheduleLabel: "Month 2",
        sortOrder: 1,
      },
      select: { id: true, amount: true },
    }),
    prisma.installment.create({
      data: {
        companyId: context.companyId,
        paymentPlanId: paymentPlan.id,
        title: "Final allocation balance",
        amount: 27600000,
        dueInDays: 120,
        scheduleLabel: "Month 4",
        sortOrder: 2,
      },
      select: { id: true, amount: true },
    }),
  ]);

  const buyerProfiles = [
    {
      clerkUserId: `sample-buyer-chioma-${company.slug}`,
      email: `chioma+${company.slug}@estateos-demo.dev`,
      firstName: "Chioma",
      lastName: "Nwosu",
      phone: "+234 802 000 2001",
    },
    {
      clerkUserId: `sample-buyer-tunde-${company.slug}`,
      email: `tunde+${company.slug}@estateos-demo.dev`,
      firstName: "Tunde",
      lastName: "Olawale",
      phone: "+234 802 000 2002",
    },
    {
      clerkUserId: `sample-buyer-zainab-${company.slug}`,
      email: `zainab+${company.slug}@estateos-demo.dev`,
      firstName: "Zainab",
      lastName: "Bello",
      phone: "+234 802 000 2003",
    },
  ];

  const buyers: Array<{
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
  }> = [];
  for (const profile of buyerProfiles) {
    const buyer = await prisma.user.create({
      data: {
        ...profile,
        companyId: context.companyId,
        branchId,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
      },
    });
    buyers.push(buyer);

    await prisma.userRole.create({
      data: {
        userId: buyer.id,
        roleId: buyerRole.id,
        companyId: context.companyId,
      },
    });
  }

  const [leadBuyer, inspectionBuyer, activeBuyer] = buyers;
  const [firstUnit, secondUnit, thirdUnit] = units;

  await prisma.inquiry.create({
    data: {
      companyId: context.companyId,
      propertyId: property.id,
      userId: leadBuyer.id,
      fullName: `${leadBuyer.firstName} ${leadBuyer.lastName}`,
      email: leadBuyer.email,
      phone: leadBuyer.phone ?? undefined,
      message: "I want a clean breakdown of payment milestones before I proceed.",
      source: "WEBSITE",
      status: "QUALIFIED",
    },
  });

  const inspectionInquiry = await prisma.inquiry.create({
    data: {
      companyId: context.companyId,
      propertyId: property.id,
      userId: inspectionBuyer.id,
      assignedStaffId: null,
      fullName: `${inspectionBuyer.firstName} ${inspectionBuyer.lastName}`,
      email: inspectionBuyer.email,
      phone: inspectionBuyer.phone ?? undefined,
      message: "Please book me for a site tour this week.",
      source: "WEBSITE",
      status: "INSPECTION_BOOKED",
    },
    select: {
      id: true,
    },
  });

  await prisma.inspectionBooking.create({
    data: {
      companyId: context.companyId,
      propertyId: property.id,
      inquiryId: inspectionInquiry.id,
      userId: inspectionBuyer.id,
      fullName: `${inspectionBuyer.firstName} ${inspectionBuyer.lastName}`,
      email: inspectionBuyer.email,
      phone: inspectionBuyer.phone ?? undefined,
      scheduledFor: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2),
      status: "CONFIRMED",
    },
  });

  async function createDeal(input: {
    buyer: (typeof buyers)[number];
    unit: (typeof units)[number];
    reference: string;
    reservationFee: number;
    totalValue: number;
    outstandingBalance: number;
    paymentStatus: "PENDING" | "PARTIAL" | "OVERDUE" | "COMPLETED";
    currentStage: "INQUIRY_RECEIVED" | "KYC_SUBMITTED" | "RESERVATION_FEE_PAID" | "ALLOCATION_IN_PROGRESS" | "FINAL_PAYMENT_COMPLETED";
    nextPaymentDueAt?: Date | null;
    successfulPaymentAmount?: number;
    providerReference?: string;
  }) {
    const reservation = await prisma.reservation.create({
      data: {
        companyId: context.companyId!,
        propertyId: property.id,
        propertyUnitId: input.unit.id,
        userId: input.buyer.id,
        marketerId: marketer.id,
        paymentPlanId: paymentPlan.id,
        reference: input.reference,
        status: input.paymentStatus === "COMPLETED" ? "CONVERTED" : "ACTIVE",
        reservationFee: input.reservationFee,
        reservedUntil: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      },
      select: {
        id: true,
      },
    });

    const transaction = await prisma.transaction.create({
      data: {
        companyId: context.companyId!,
        reservationId: reservation.id,
        propertyId: property.id,
        propertyUnitId: input.unit.id,
        userId: input.buyer.id,
        marketerId: marketer.id,
        paymentPlanId: paymentPlan.id,
        currentStage: input.currentStage,
        totalValue: input.totalValue,
        outstandingBalance: input.outstandingBalance,
        paymentStatus: input.paymentStatus,
        nextPaymentDueAt: input.nextPaymentDueAt ?? null,
        lastPaymentAt: input.successfulPaymentAmount ? new Date(Date.now() - 1000 * 60 * 60 * 24 * 3) : null,
      },
      select: {
        id: true,
      },
    });

    await prisma.paymentRequest.create({
      data: {
        companyId: context.companyId!,
        userId: input.buyer.id,
        reservationId: reservation.id,
        transactionId: transaction.id,
        installmentId: installments[1].id,
        status: input.paymentStatus === "COMPLETED" ? "PAID" : "AWAITING_PAYMENT",
        channel: "IN_APP",
        collectionMethod: "HOSTED_CHECKOUT",
        provider: "PAYSTACK",
        title: `Installment for ${input.unit.title}`,
        purpose: "Milestone payment",
        amount: Math.max(input.outstandingBalance, 18500000),
        currency: "NGN",
        sentAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4),
        dueAt: input.nextPaymentDueAt ?? new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
        paidAt: input.paymentStatus === "COMPLETED" ? new Date(Date.now() - 1000 * 60 * 60 * 24) : null,
        providerReference: `${input.reference}-REQ`,
        checkoutUrl: "https://paystack.example/checkout/sample",
      },
    });

    if (input.successfulPaymentAmount && input.providerReference) {
      const payment = await prisma.payment.create({
        data: {
          companyId: context.companyId!,
          transactionId: transaction.id,
          installmentId: installments[0].id,
          userId: input.buyer.id,
          marketerId: marketer.id,
          providerReference: input.providerReference,
          amount: input.successfulPaymentAmount,
          currency: "NGN",
          status: "SUCCESS",
          method: "PAYSTACK",
          paidAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
        },
        select: {
          id: true,
        },
      });

      await prisma.receipt.create({
        data: {
          companyId: context.companyId!,
          paymentId: payment.id,
          transactionId: transaction.id,
          receiptNumber: `RCT-${input.providerReference}`,
          totalAmount: input.successfulPaymentAmount,
        },
      });
    }

    await prisma.propertyUnit.update({
      where: {
        id: input.unit.id,
      },
      data: {
        status: input.paymentStatus === "COMPLETED" ? "SOLD" : "RESERVED",
      },
    });

    return transaction;
  }

  await createDeal({
    buyer: activeBuyer,
    unit: firstUnit,
    reference: "RSV-SAMPLE-001",
    reservationFee: 36800000,
    totalValue: 92000000,
    outstandingBalance: 55200000,
    paymentStatus: "PARTIAL",
    currentStage: "ALLOCATION_IN_PROGRESS",
    nextPaymentDueAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 10),
    successfulPaymentAmount: 36800000,
    providerReference: "PAY-SAMPLE-001",
  });

  await createDeal({
    buyer: inspectionBuyer,
    unit: secondUnit,
    reference: "RSV-SAMPLE-002",
    reservationFee: 46400000,
    totalValue: 116000000,
    outstandingBalance: 46400000,
    paymentStatus: "OVERDUE",
    currentStage: "RESERVATION_FEE_PAID",
    nextPaymentDueAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5),
    successfulPaymentAmount: 69600000,
    providerReference: "PAY-SAMPLE-002",
  });

  await createDeal({
    buyer: leadBuyer,
    unit: thirdUnit,
    reference: "RSV-SAMPLE-003",
    reservationFee: 55200000,
    totalValue: 138000000,
    outstandingBalance: 0,
    paymentStatus: "COMPLETED",
    currentStage: "FINAL_PAYMENT_COMPLETED",
    successfulPaymentAmount: 138000000,
    providerReference: "PAY-SAMPLE-003",
  });

  await prisma.propertyMedia.createMany({
    data: [
      {
        companyId: context.companyId,
        propertyId: property.id,
        title: "Hero exterior",
        url: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1600&q=80",
        mimeType: "image/jpeg",
        sortOrder: 0,
        isPrimary: true,
        visibility: "PUBLIC",
      },
      {
        companyId: context.companyId,
        propertyId: property.id,
        title: "Sample lounge",
        url: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1600&q=80",
        mimeType: "image/jpeg",
        sortOrder: 1,
        isPrimary: false,
        visibility: "PUBLIC",
      },
    ],
  });

  await trackProductEvent({
    companyId: context.companyId,
    userId: context.userId ?? undefined,
    eventName: PRODUCT_EVENT_NAMES.sampleWorkspaceLoaded,
    summary: "Loaded sample developer workspace",
    payload: {
      propertyId: property.id,
      marketerId: marketer.id,
    } satisfies Prisma.InputJsonValue,
  });

  return {
    loaded: true,
    reason: `Loaded a sample workspace for ${company.name}.`,
  };
}
