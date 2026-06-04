import type { AppRole } from "@prisma/client";

import { writeAuditLog } from "@/lib/audit/service";
import { adminRoles, buyerRoles, hasRequiredRole } from "@/lib/auth/roles";
import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";
import { buildSafeErrorLogContext, logWarn } from "@/lib/ops/logger";
import { createInAppNotification, getTenantOperatorRecipients } from "@/lib/notifications/service";

const OPERATOR_ROLES: AppRole[] = ["SUPER_ADMIN", ...adminRoles];

type BuyerRegistrationUser = {
  id: string;
  clerkUserId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  companyId: string | null;
  branchId: string | null;
  roles: Array<{
    companyId: string | null;
    role: {
      companyId: string | null;
      name: AppRole;
    };
  }>;
};

type BuyerRegistrationStatus = "created" | "existing";

export type BuyerSelfRegistrationResult = {
  status: BuyerRegistrationStatus;
  userId: string;
  companyId: string;
  roleId: string;
};

type BuyerSelfRegistrationSideEffects = {
  hasDatabase?: boolean;
  writeAuditLog?: (entry: Parameters<typeof writeAuditLog>[0]) => Promise<unknown>;
  notifyTenantOperators?: (input: Parameters<typeof notifyTenantOperators>[0]) => Promise<unknown>;
};

export class BuyerSelfRegistrationAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BuyerSelfRegistrationAccessError";
  }
}

export function isBuyerSelfRegistrationAccessError(
  error: unknown,
): error is BuyerSelfRegistrationAccessError {
  return error instanceof BuyerSelfRegistrationAccessError;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function canLinkPlaceholderClerkId(clerkUserId: string) {
  return clerkUserId.startsWith("manual:");
}

function selectRoleNames(user: BuyerRegistrationUser) {
  return user.roles.map((assignment) => assignment.role.name);
}

function hasScopedBuyerRole(user: BuyerRegistrationUser, companyId: string) {
  return user.roles.some(
    (assignment) =>
      assignment.companyId === companyId &&
      assignment.role.companyId === companyId &&
      buyerRoles.includes(assignment.role.name),
  );
}

function hasOperatorRole(user: BuyerRegistrationUser) {
  return hasRequiredRole(selectRoleNames(user), OPERATOR_ROLES);
}

function assertBuyerRegistrationAllowed(user: BuyerRegistrationUser, companyId: string) {
  if (hasOperatorRole(user)) {
    throw new BuyerSelfRegistrationAccessError(
      "This account already has operator access and cannot be silently registered as a buyer.",
    );
  }

  if (user.companyId && user.companyId !== companyId) {
    throw new BuyerSelfRegistrationAccessError(
      "This account already belongs to another tenant.",
    );
  }

  const hasOtherTenantBuyerRole = user.roles.some(
    (assignment) =>
      assignment.companyId &&
      assignment.companyId !== companyId &&
      buyerRoles.includes(assignment.role.name),
  );
  if (hasOtherTenantBuyerRole) {
    throw new BuyerSelfRegistrationAccessError(
      "This buyer account already belongs to another tenant.",
    );
  }
}

async function notifyTenantOperators(input: {
  companyId: string;
  buyerName: string;
  buyerEmail: string;
  userId: string;
}) {
  try {
    const operators = await getTenantOperatorRecipients(input.companyId);
    await Promise.all(
      operators.map((operator) =>
        createInAppNotification({
          companyId: input.companyId,
          userId: operator.id,
          type: "SYSTEM",
          title: "New buyer registered",
          body: `${input.buyerName} joined the buyer portal.`,
          metadata: {
            buyerUserId: input.userId,
            buyerEmail: input.buyerEmail,
            source: "buyer-self-registration",
          },
        }),
      ),
    );
  } catch (error) {
    logWarn("Buyer self-registration notification failed.", {
      companyId: input.companyId,
      userId: input.userId,
      ...buildSafeErrorLogContext(error),
    });
  }
}

export async function registerBuyerForTenantFromAuthIntent(
  input: {
    clerkUserId: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
    targetCompanyId: string;
    targetCompanySlug?: string | null;
    host?: string | null;
  },
  db = prisma,
  sideEffects: BuyerSelfRegistrationSideEffects = {},
): Promise<BuyerSelfRegistrationResult> {
  if (sideEffects.hasDatabase === false || (!sideEffects.hasDatabase && !featureFlags.hasDatabase)) {
    throw new Error("Database access is required for buyer registration.");
  }

  const email = normalizeEmail(input.email);
  if (!email) {
    throw new BuyerSelfRegistrationAccessError("A verified email address is required.");
  }

  const result = await db.$transaction(async (tx) => {
    const company = await tx.company.findUnique({
      where: { id: input.targetCompanyId },
      select: { id: true, slug: true },
    });
    if (!company) {
      throw new BuyerSelfRegistrationAccessError("Target tenant could not be resolved.");
    }

    let user = await tx.user.findFirst({
      where: {
        OR: [
          { clerkUserId: input.clerkUserId },
          { email: { equals: email, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        clerkUserId: true,
        email: true,
        firstName: true,
        lastName: true,
        companyId: true,
        branchId: true,
        roles: {
          select: {
            companyId: true,
            role: {
              select: {
                companyId: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (
      user &&
      user.clerkUserId !== input.clerkUserId &&
      !canLinkPlaceholderClerkId(user.clerkUserId)
    ) {
      throw new BuyerSelfRegistrationAccessError(
        "Email address is already linked to another account.",
      );
    }

    if (!user) {
      user = await tx.user.create({
        data: {
          clerkUserId: input.clerkUserId,
          email,
          firstName: input.firstName?.trim() ?? "",
          lastName: input.lastName?.trim() ?? "",
          phone: input.phone?.trim() || null,
          companyId: company.id,
          isActive: true,
        },
        select: {
          id: true,
          clerkUserId: true,
          email: true,
          firstName: true,
          lastName: true,
          companyId: true,
          branchId: true,
          roles: {
            select: {
              companyId: true,
              role: {
                select: {
                  companyId: true,
                  name: true,
                },
              },
            },
          },
        },
      });
    }

    assertBuyerRegistrationAllowed(user, company.id);
    const wasExistingBuyer = hasScopedBuyerRole(user, company.id);

    if (
      user.clerkUserId !== input.clerkUserId ||
      user.companyId !== company.id ||
      user.email !== email ||
      user.firstName !== (input.firstName?.trim() ?? user.firstName ?? "") ||
      user.lastName !== (input.lastName?.trim() ?? user.lastName ?? "")
    ) {
      user = await tx.user.update({
        where: { id: user.id },
        data: {
          clerkUserId: input.clerkUserId,
          email,
          firstName: input.firstName?.trim() ?? user.firstName ?? "",
          lastName: input.lastName?.trim() ?? user.lastName ?? "",
          phone: input.phone?.trim() || undefined,
          companyId: company.id,
          isActive: true,
        },
        select: {
          id: true,
          clerkUserId: true,
          email: true,
          firstName: true,
          lastName: true,
          companyId: true,
          branchId: true,
          roles: {
            select: {
              companyId: true,
              role: {
                select: {
                  companyId: true,
                  name: true,
                },
              },
            },
          },
        },
      });
    }

    const buyerRole = await tx.role.upsert({
      where: {
        companyId_name: {
          companyId: company.id,
          name: "BUYER",
        },
      },
      update: { label: "Buyer" },
      create: {
        companyId: company.id,
        name: "BUYER",
        label: "Buyer",
      },
      select: { id: true },
    });

    await tx.userRole.upsert({
      where: {
        userId_roleId_companyId: {
          userId: user.id,
          roleId: buyerRole.id,
          companyId: company.id,
        },
      },
      update: {},
      create: {
        userId: user.id,
        roleId: buyerRole.id,
        companyId: company.id,
      },
    });

    await tx.profile.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        country: "Nigeria",
        profileCompleted: false,
      },
      select: { id: true },
    });

    return {
      status: wasExistingBuyer ? "existing" : "created",
      userId: user.id,
      companyId: company.id,
      roleId: buyerRole.id,
    } satisfies BuyerSelfRegistrationResult;
  });

  const auditWriter = sideEffects.writeAuditLog ?? writeAuditLog;
  await auditWriter({
    actorUserId: result.userId,
    companyId: result.companyId,
    action: "CREATE",
    entityType: "BuyerSelfRegistration",
    entityId: result.userId,
    summary:
      result.status === "existing"
        ? "Buyer portal access confirmed from tenant public site"
        : "Buyer self-registered from tenant public site",
    payload: {
      email,
      companySlug: input.targetCompanySlug,
      host: input.host,
      status: result.status,
    },
  });

  if (result.status === "created") {
    const buyerName = `${input.firstName ?? ""} ${input.lastName ?? ""}`.trim() || email;
    const notifier = sideEffects.notifyTenantOperators ?? notifyTenantOperators;
    void notifier({
      companyId: result.companyId,
      userId: result.userId,
      buyerName,
      buyerEmail: email,
    });
  }

  return result;
}
