import { PrismaClient } from "@prisma/client";

import { blogPosts, faqs, teamMembers, testimonials } from "../src/modules/cms/demo-data";
import { properties } from "../src/modules/properties/demo-data";

const prisma = new PrismaClient();

async function main() {
  await prisma.billingEvent.deleteMany();
  await prisma.splitSettlement.deleteMany();
  await prisma.commissionRecord.deleteMany();
  await prisma.companyPaymentProviderAccount.deleteMany();
  await prisma.companyBillingSettings.deleteMany();
  await prisma.companySubscription.deleteMany();
  await prisma.commissionRule.deleteMany();
  await prisma.plan.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.receipt.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.transactionMilestone.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.inspectionBooking.deleteMany();
  await prisma.inquiry.deleteMany();
  await prisma.savedProperty.deleteMany();
  await prisma.propertyMedia.deleteMany();
  await prisma.propertyFeature.deleteMany();
  await prisma.propertyLocation.deleteMany();
  await prisma.propertyUnit.deleteMany();
  await prisma.installment.deleteMany();
  await prisma.paymentPlan.deleteMany();
  await prisma.teamMember.deleteMany();
  await prisma.testimonial.deleteMany();
  await prisma.fAQItem.deleteMany();
  await prisma.blogPost.deleteMany();
  await prisma.userRole.deleteMany();
  await prisma.staffProfile.deleteMany();
  await prisma.profile.deleteMany();
  await prisma.user.deleteMany();
  await prisma.role.deleteMany();
  await prisma.branch.deleteMany();
  await prisma.siteSettings.deleteMany();
  await prisma.property.deleteMany();
  await prisma.company.deleteMany();

  const company = await prisma.company.create({
    data: {
      id: "demo-company-acme",
      name: "Acme Realty",
      slug: "acme-realty",
      legalName: "Acme Realty Limited",
      description: "Premium real estate operator",
      subdomain: "acme",
      primaryColor: "#0e5b49",
      accentColor: "#d3c1a1",
    },
  });

  await prisma.siteSettings.create({
    data: {
      companyId: company.id,
      companyName: company.name,
      supportEmail: "support@acmerealty.dev",
      supportPhone: "+234 801 000 1000",
      address: "12 Admiralty Way, Lekki Phase 1, Lagos",
    },
  });

  const branch = await prisma.branch.create({
    data: {
      id: "demo-branch-lagos-hq",
      companyId: company.id,
      name: "Lagos HQ",
      slug: "lagos-hq",
      city: "Lagos",
      state: "Lagos",
    },
  });

  await prisma.plan.create({
    data: {
      code: "growth",
      slug: "growth-monthly",
      name: "Growth",
      description: "Monthly operating plan for one real estate company with transaction workflows enabled.",
      interval: "MONTHLY",
      priceAmount: 150000,
      currency: "NGN",
      isActive: true,
      isPublic: true,
      canBeGranted: true,
      featureFlags: {
        TRANSACTIONS: true,
        ADMIN_OPERATIONS: true,
        BILLING_OVERVIEW: true,
      },
    },
  });

  const growthAnnualPlan = await prisma.plan.create({
    data: {
      code: "growth",
      slug: "growth-annual",
      name: "Growth",
      description: "Annual operating plan for one real estate company with transaction workflows enabled.",
      interval: "ANNUAL",
      priceAmount: 1500000,
      currency: "NGN",
      isActive: true,
      isPublic: true,
      canBeGranted: true,
      featureFlags: {
        TRANSACTIONS: true,
        ADMIN_OPERATIONS: true,
        BILLING_OVERVIEW: true,
      },
    },
  });

  const buyerRole = await prisma.role.create({
    data: {
      companyId: company.id,
      name: "BUYER",
      label: "Buyer",
    },
  });

  const adminRole = await prisma.role.create({
    data: {
      companyId: company.id,
      name: "ADMIN",
      label: "Admin",
    },
  });

  const superAdminRole = await prisma.role.create({
    data: {
      name: "SUPER_ADMIN",
      label: "Super Admin",
    },
  });

  const buyer = await prisma.user.create({
    data: {
      clerkUserId: "demo-buyer",
      email: "buyer@acmerealty.dev",
      firstName: "Ada",
      lastName: "Okafor",
      companyId: company.id,
      branchId: branch.id,
      profile: {
        create: {
          city: "Lagos",
          state: "Lagos",
          occupation: "Product Manager",
          profileCompleted: true,
        },
      },
    },
  });

  const admin = await prisma.user.create({
    data: {
      clerkUserId: "demo-admin",
      email: "admin@acmerealty.dev",
      firstName: "Tobi",
      lastName: "Adewale",
      companyId: company.id,
      branchId: branch.id,
      staffProfile: {
        create: {
          title: "Operations Director",
          department: "Operations",
          staffCode: "OPS-001",
        },
      },
    },
  });

  await prisma.userRole.createMany({
    data: [
      {
        userId: buyer.id,
        roleId: buyerRole.id,
        companyId: company.id,
      },
      {
        userId: admin.id,
        roleId: adminRole.id,
        companyId: company.id,
      },
      {
        userId: admin.id,
        roleId: superAdminRole.id,
      },
    ],
  });

  const companyCommissionRule = await prisma.commissionRule.create({
    data: {
      companyId: company.id,
      name: "Default transaction commission",
      code: "default-transaction-commission",
      feeType: "FLAT",
      flatAmount: 25000,
      currency: "NGN",
      notes: "Applies even when the tenant plan was granted manually.",
    },
  });

  await prisma.companyBillingSettings.create({
    data: {
      companyId: company.id,
      defaultCurrency: "NGN",
      transactionProvider: "PAYSTACK",
      subscriptionProvider: "STRIPE",
      requireActivePlanForTransactions: true,
      requireActivePlanForAdminOps: false,
      defaultCommissionRuleId: companyCommissionRule.id,
      notes: "Pilot billing configuration",
    },
  });

  await prisma.companyPaymentProviderAccount.create({
    data: {
      companyId: company.id,
      provider: "PAYSTACK",
      displayName: "Acme Realty Paystack settlement",
      accountReference: "ACME-PAYSTACK-SETTLEMENT",
      subaccountCode: "ACCT_demo_acme",
      settlementCurrency: "NGN",
      settlementCountry: "NG",
      status: "ACTIVE",
      supportsTransactionSplit: true,
      supportsSubscriptions: false,
      isDefaultPayout: true,
    },
  });

  const currentSubscription = await prisma.companySubscription.create({
    data: {
      companyId: company.id,
      planId: growthAnnualPlan.id,
      status: "GRANTED",
      interval: "ANNUAL",
      isCurrent: true,
      startsAt: new Date("2026-01-01T00:00:00.000Z"),
      endsAt: new Date("2027-01-01T00:00:00.000Z"),
      grantedByUserId: admin.id,
      grantReason: "Pilot launch support by EstateOS superadmin.",
      billingProvider: "MANUAL",
      autoRenews: false,
      metadata: {
        source: "seed",
      },
    },
  });

  await prisma.billingEvent.create({
    data: {
      companyId: company.id,
      subscriptionId: currentSubscription.id,
      actorUserId: admin.id,
      type: "PLAN_GRANTED",
      provider: "MANUAL",
      amount: 0,
      currency: "NGN",
      status: "GRANTED",
      summary: "Superadmin granted the Growth annual plan for pilot usage.",
      metadata: {
        planId: growthAnnualPlan.id,
      },
    },
  });

  for (const property of properties) {
    const propertyType = property.type.toUpperCase().replace("-", "_");
    const propertyStatus = property.status.toUpperCase();

    const createdProperty = await prisma.property.create({
      data: {
        companyId: company.id,
        branchId: branch.id,
        title: property.title,
        slug: property.slug,
        shortDescription: property.shortDescription,
        description: property.description,
        propertyType: propertyType as never,
        status: propertyStatus as never,
        isFeatured: property.featured,
        priceFrom: property.priceFrom,
        priceTo: property.priceTo,
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
        parkingSpaces: property.parkingSpaces,
        sizeSqm: property.sizeSqm,
        locationSummary: property.locationSummary,
        hasPaymentPlan: true,
        landmarks: property.landmarks,
      },
    });

    const brochure = await prisma.document.create({
      data: {
        companyId: company.id,
        fileName: `${property.slug}-brochure.pdf`,
        storageKey: `${company.slug}/brochures/${property.slug}-brochure.pdf`,
        mimeType: "application/pdf",
        documentType: "BROCHURE",
        visibility: "PUBLIC",
      },
    });

    await prisma.property.update({
      where: {
        id: createdProperty.id,
      },
      data: {
        brochureDocumentId: brochure.id,
      },
    });

    await prisma.propertyLocation.create({
      data: {
        companyId: company.id,
        propertyId: createdProperty.id,
        city: property.city,
        state: property.state,
        latitude: property.coordinates[1],
        longitude: property.coordinates[0],
      },
    });

    const paymentPlan = await prisma.paymentPlan.create({
      data: {
        companyId: company.id,
        propertyId: createdProperty.id,
        title: property.paymentPlan.title,
        kind: "FIXED",
        description: property.paymentPlan.summary,
        scheduleDescription: "Structured fixed installment option seeded for local testing.",
        durationMonths: property.paymentPlan.durationMonths,
        installmentCount: 2,
        depositPercent: property.paymentPlan.depositPercent,
      },
    });

    const depositAmount = Math.round(
      property.priceFrom * (property.paymentPlan.depositPercent / 100),
    );
    const balanceAmount = property.priceFrom - depositAmount;

    await prisma.installment.createMany({
      data: [
        {
          companyId: company.id,
          paymentPlanId: paymentPlan.id,
          title: "Initial deposit",
          amount: depositAmount,
          dueInDays: 0,
          scheduleLabel: "At reservation",
          sortOrder: 0,
        },
        {
          companyId: company.id,
          paymentPlanId: paymentPlan.id,
          title: "Balance settlement",
          amount: balanceAmount,
          dueInDays: property.paymentPlan.durationMonths * 30,
          scheduleLabel: "Before handover",
          sortOrder: 1,
        },
      ],
    });

    await prisma.propertyFeature.createMany({
      data: property.features.map((feature) => ({
        companyId: company.id,
        propertyId: createdProperty.id,
        label: feature,
      })),
    });

    await prisma.propertyMedia.createMany({
      data: property.images.map((image, index) => ({
        companyId: company.id,
        propertyId: createdProperty.id,
        url: image,
        title: `${property.title} image ${index + 1}`,
        sortOrder: index,
        isPrimary: index === 0,
        visibility: "PUBLIC",
      })),
    });
  }

  const createdTeamMembers: Array<{ id: string; fullName: string }> = [];
  for (const [index, member] of teamMembers.entries()) {
    const createdMember = await prisma.teamMember.create({
      data: {
        companyId: company.id,
        slug: member.slug,
        fullName: member.fullName,
        title: member.title,
        bio: member.bio,
        email: member.email,
        phone: member.phone,
        avatarUrl: member.image,
        whatsappNumber: member.phone,
        profileHighlights: [
          "Visible in buyer selection flow",
          "Supports property discovery and deal follow-up",
        ],
        portfolioText: "Experienced in guided reservations, property education, and transaction coordination.",
        portfolioLinks: ["https://estateos.app/demo-marketer"],
        specialties: index === 0 ? ["Luxury", "Off-plan"] : ["Residential", "Land"],
        isActive: true,
        isPublished: true,
      },
    });
    createdTeamMembers.push({
      id: createdMember.id,
      fullName: createdMember.fullName,
    });
  }

  await prisma.testimonial.createMany({
    data: testimonials.map((testimonial) => ({
      companyId: company.id,
      fullName: testimonial.fullName,
      role: testimonial.role,
      companyName: testimonial.company,
      quote: testimonial.quote,
    })),
  });

  await prisma.fAQItem.createMany({
    data: faqs.map((faq) => ({
      companyId: company.id,
      question: faq.question,
      answer: faq.answer,
      category: faq.category,
    })),
  });

  for (const post of blogPosts) {
    await prisma.blogPost.create({
      data: {
        companyId: company.id,
        slug: post.slug,
        title: post.title,
        excerpt: post.excerpt,
        content: post.content.join("\n\n"),
        authorName: post.authorName,
        coverImageUrl: post.coverImageUrl,
        isPublished: true,
        publishedAt: new Date(post.publishedAt),
      },
    });
  }

  const reservedProperty = await prisma.property.findUniqueOrThrow({
    where: {
      companyId_slug: {
        companyId: company.id,
        slug: "eko-atrium-residences",
      },
    },
  });

  const reservedPropertyPlan = await prisma.paymentPlan.findFirstOrThrow({
    where: {
      companyId: company.id,
      propertyId: reservedProperty.id,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  const initialInstallment = await prisma.installment.findFirstOrThrow({
    where: {
      companyId: company.id,
      paymentPlanId: reservedPropertyPlan.id,
      sortOrder: 0,
    },
  });

  const inquiry = await prisma.inquiry.create({
    data: {
      companyId: company.id,
      propertyId: reservedProperty.id,
      userId: buyer.id,
      fullName: "Ada Okafor",
      email: "buyer@acmerealty.dev",
      phone: "+234 801 000 1111",
      message: "I would like to proceed toward reservation for a 3-bedroom unit.",
      source: "WEBSITE",
      status: "QUALIFIED",
    },
  });

  await prisma.inspectionBooking.create({
    data: {
      companyId: company.id,
      propertyId: reservedProperty.id,
      inquiryId: inquiry.id,
      userId: buyer.id,
      fullName: "Ada Okafor",
      email: "buyer@acmerealty.dev",
      phone: "+234 801 000 1111",
      scheduledFor: new Date("2026-03-18T10:00:00.000Z"),
      status: "COMPLETED",
    },
  });

  const reservation = await prisma.reservation.create({
    data: {
      companyId: company.id,
      propertyId: reservedProperty.id,
      userId: buyer.id,
      marketerId: createdTeamMembers[0]?.id,
      paymentPlanId: reservedPropertyPlan.id,
      reference: "RSV-2026-00018",
      status: "ACTIVE",
      reservationFee: 185000000,
    },
  });

  const transaction = await prisma.transaction.create({
    data: {
      companyId: company.id,
      reservationId: reservation.id,
      propertyId: reservedProperty.id,
      userId: buyer.id,
      marketerId: createdTeamMembers[0]?.id,
      paymentPlanId: reservedPropertyPlan.id,
      currentStage: "ALLOCATION_IN_PROGRESS",
      totalValue: 185000000,
      outstandingBalance: 24500000,
    },
  });

  for (const [index, stage] of [
    "INQUIRY_RECEIVED",
    "KYC_SUBMITTED",
    "RESERVATION_FEE_PAID",
    "CONTRACT_ISSUED",
    "ALLOCATION_IN_PROGRESS",
  ].entries()) {
    await prisma.transactionMilestone.create({
      data: {
        companyId: company.id,
        transactionId: transaction.id,
        stage: stage as never,
        title: stage.replaceAll("_", " "),
        status: index < 4 ? "COMPLETED" : "ACTIVE",
      },
    });
  }

  const payment = await prisma.payment.create({
    data: {
      companyId: company.id,
      transactionId: transaction.id,
      installmentId: initialInstallment.id,
      userId: buyer.id,
      marketerId: createdTeamMembers[0]?.id,
      providerReference: "PAY-11082",
      amount: 12500000,
      status: "SUCCESS",
      method: "PAYSTACK",
      paidAt: new Date("2026-03-21"),
    },
  });

  await prisma.receipt.create({
    data: {
      companyId: company.id,
      paymentId: payment.id,
      transactionId: transaction.id,
      receiptNumber: "RCT-PAY-11082",
      totalAmount: 12500000,
    },
  });

  await prisma.document.create({
    data: {
      companyId: company.id,
      userId: buyer.id,
      transactionId: transaction.id,
      fileName: "RCT-PAY-11082.pdf",
      storageKey: `${company.slug}/receipts/RCT-PAY-11082.pdf`,
      mimeType: "application/pdf",
      documentType: "RECEIPT",
      visibility: "PRIVATE",
    },
  });

  await prisma.commissionRecord.create({
    data: {
      companyId: company.id,
      paymentId: payment.id,
      transactionId: transaction.id,
      subscriptionId: currentSubscription.id,
      planId: growthAnnualPlan.id,
      commissionRuleId: companyCommissionRule.id,
      grossAmount: 12500000,
      companyAmount: 12475000,
      platformCommission: 25000,
      providerFee: 0,
      netAmount: 12475000,
      currency: "NGN",
      settlementStatus: "READY",
      metadata: {
        isGrantedPlan: true,
      },
    },
  });

  await prisma.splitSettlement.create({
    data: {
      companyId: company.id,
      paymentId: payment.id,
      provider: "PAYSTACK",
      grossAmount: 12500000,
      companyAmount: 12475000,
      platformAmount: 25000,
      providerFee: 0,
      currency: "NGN",
      status: "READY",
      metadata: {
        paystack: {
          subaccount: "ACCT_demo_acme",
          transaction_charge: 2500000,
        },
      },
    },
  });

  const kycIdDocument = await prisma.document.create({
    data: {
      companyId: company.id,
      userId: buyer.id,
      fileName: "ada-okafor-passport.pdf",
      storageKey: `${company.slug}/kyc/ada-okafor-passport.pdf`,
      mimeType: "application/pdf",
      documentType: "KYC_ID",
      visibility: "PRIVATE",
      uploadedByUserId: buyer.id,
      createdForUserId: buyer.id,
    },
  });

  const proofOfAddressDocument = await prisma.document.create({
    data: {
      companyId: company.id,
      userId: buyer.id,
      fileName: "ada-okafor-address.pdf",
      storageKey: `${company.slug}/kyc/ada-okafor-address.pdf`,
      mimeType: "application/pdf",
      documentType: "KYC_PROOF_OF_ADDRESS",
      visibility: "PRIVATE",
      uploadedByUserId: buyer.id,
      createdForUserId: buyer.id,
    },
  });

  await prisma.kYCSubmission.createMany({
    data: [
      {
        companyId: company.id,
        userId: buyer.id,
        documentId: kycIdDocument.id,
        status: "APPROVED",
        reviewedById: admin.id,
        notes: "Identity document verified.",
      },
      {
        companyId: company.id,
        userId: buyer.id,
        documentId: proofOfAddressDocument.id,
        status: "UNDER_REVIEW",
        reviewedById: admin.id,
        notes: "Cross-checking submitted address details.",
      },
    ],
  });

  await prisma.notification.create({
    data: {
      companyId: company.id,
      userId: buyer.id,
      type: "PAYMENT_CONFIRMED",
      channel: "IN_APP",
      title: "Payment confirmed",
      body: "Your latest installment has been confirmed and receipted.",
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
