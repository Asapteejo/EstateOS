import { PrismaClient } from "@prisma/client";

import { blogPosts, faqs, teamMembers, testimonials } from "../src/modules/cms/demo-data";
import { properties } from "../src/modules/properties/demo-data";

const prisma = new PrismaClient();

async function main() {
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
        description: property.paymentPlan.summary,
        durationMonths: property.paymentPlan.durationMonths,
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
          sortOrder: 0,
        },
        {
          companyId: company.id,
          paymentPlanId: paymentPlan.id,
          title: "Balance settlement",
          amount: balanceAmount,
          dueInDays: property.paymentPlan.durationMonths * 30,
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

  for (const member of teamMembers) {
    await prisma.teamMember.create({
      data: {
        companyId: company.id,
        slug: member.slug,
        fullName: member.fullName,
        title: member.title,
        bio: member.bio,
        email: member.email,
        phone: member.phone,
        avatarUrl: member.image,
      },
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
      reference: "RSV-2026-00018",
      status: "ACTIVE",
      reservationFee: 5000000,
    },
  });

  const transaction = await prisma.transaction.create({
    data: {
      companyId: company.id,
      reservationId: reservation.id,
      propertyId: reservedProperty.id,
      userId: buyer.id,
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
