import { randomBytes, randomUUID } from "crypto";
import type { AppRole } from "@prisma/client";

import { writeAuditLog } from "@/lib/audit/service";
import { normalizeInvitationEmail } from "@/lib/auth/invitation-email";
import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";
import { sendTransactionalEmail } from "@/lib/notifications/email";
import { buildBuyerInvitationEmail } from "@/lib/notifications/templates/buyer-invitation";
import { buildTeamInvitationEmail } from "@/lib/notifications/templates/team-invitation";
import {
  buildInvitationAcceptUrl,
  invitationExpiresAt,
  requireInvitationEmailDelivery,
} from "@/modules/invitations/team-invitations";
import { ASSIGNABLE_ROLES, ROLE_LABELS } from "@/modules/admin/users";

/** Roles a STAFF (front-desk) actor may provision. */
const STAFF_PROVISIONABLE: AppRole[] = ["BUYER"];
/** Roles an ADMIN actor may provision. */
const ADMIN_PROVISIONABLE: AppRole[] = ["BUYER", ...ASSIGNABLE_ROLES];

export type BuyerProfileInput = {
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  occupation?: string | null;
  nextOfKinName?: string | null;
  nextOfKinPhone?: string | null;
};

export type StaffProfileInput = {
  title?: string | null;
  staffCode?: string | null;
};

export type ProvisionUserInput = {
  companyId: string;
  actorUserId: string;
  actorRoles: AppRole[];
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  role: AppRole;
  branchId?: string | null;
  buyerProfile?: BuyerProfileInput;
  staffProfile?: StaffProfileInput;
  delivery: "invite" | "password";
};

export type ProvisionUserResult =
  | { ok: true; userId: string; delivery: "invite"; email: string }
  | { ok: true; userId: string; delivery: "password"; email: string; password: string }
  | { ok: false; error: string };

function allowedRolesForActor(actorRoles: AppRole[]): AppRole[] {
  const isAdmin = actorRoles.some((r) => r === "ADMIN" || r === "SUPER_ADMIN");
  if (isAdmin) return ADMIN_PROVISIONABLE;
  if (actorRoles.includes("STAFF")) return STAFF_PROVISIONABLE;
  return [];
}

function generatePassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%^&*";
  const all = upper + lower + digits + symbols;

  // Fill 12 random chars, then append one from each class for guaranteed complexity
  const body = Array.from(randomBytes(12), (b) => all[b % all.length]);
  const classBytes = randomBytes(4);
  const guaranteed = [
    upper[classBytes[0] % upper.length],
    lower[classBytes[1] % lower.length],
    digits[classBytes[2] % digits.length],
    symbols[classBytes[3] % symbols.length],
  ];
  const combined = [...body, ...guaranteed];

  // Fisher-Yates shuffle so guaranteed chars aren't always at the end
  const shuffleBytes = randomBytes(combined.length);
  for (let i = combined.length - 1; i > 0; i--) {
    const j = shuffleBytes[i] % (i + 1);
    [combined[i], combined[j]] = [combined[j], combined[i]];
  }
  return combined.join("");
}

function cleanProfile(p: BuyerProfileInput) {
  return {
    addressLine1: p.addressLine1?.trim() || null,
    addressLine2: p.addressLine2?.trim() || null,
    city: p.city?.trim() || null,
    state: p.state?.trim() || null,
    country: p.country?.trim() || "Nigeria",
    occupation: p.occupation?.trim() || null,
    nextOfKinName: p.nextOfKinName?.trim() || null,
    nextOfKinPhone: p.nextOfKinPhone?.trim() || null,
  };
}

async function resolveActorName(actorUserId: string): Promise<string> {
  const user = await prisma.user.findFirst({
    where: { OR: [{ id: actorUserId }, { clerkUserId: actorUserId }] },
    select: { firstName: true, lastName: true, email: true },
  });
  return `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim() || user?.email || "Your team";
}

export async function provisionCompanyUser(input: ProvisionUserInput): Promise<ProvisionUserResult> {
  // 1. Role gating — enforce on every call, not just in the UI
  const allowed = allowedRolesForActor(input.actorRoles);
  if (!allowed.includes(input.role)) {
    return { ok: false, error: `Your role does not permit creating a ${input.role} account.` };
  }

  // 2. Basic validation
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  if (!firstName || !lastName) {
    return { ok: false, error: "First and last name are required." };
  }
  const email = normalizeInvitationEmail(input.email);
  if (!email) return { ok: false, error: "A valid email address is required." };

  // 3. Company exists
  const company = await prisma.company.findUnique({
    where: { id: input.companyId },
    select: { id: true, name: true },
  });
  if (!company) return { ok: false, error: "Company not found." };

  // 4. Email uniqueness — User.email is globally unique in the schema
  const globalExisting = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, companyId: true },
  });
  if (globalExisting) {
    if (globalExisting.companyId === input.companyId) {
      return { ok: false, error: "A user with this email already exists in your company." };
    }
    return { ok: false, error: "This email is already registered on the platform." };
  }

  // 5. Delivery gate
  if (input.delivery === "password") {
    if (!featureFlags.hasClerkPassword) {
      return { ok: false, error: "Password delivery is not enabled. Use invite link instead." };
    }
    return provisionWithPassword({ input, email, firstName, lastName, company });
  }

  return provisionWithInvite({ input, email, firstName, lastName, company });
}

// ─── Invite path ──────────────────────────────────────────────────────────────

async function provisionWithInvite(args: {
  input: ProvisionUserInput;
  email: string;
  firstName: string;
  lastName: string;
  company: { id: string; name: string };
}): Promise<ProvisionUserResult> {
  const { input, email, firstName, lastName, company } = args;
  requireInvitationEmailDelivery();

  const fullName = `${firstName} ${lastName}`;
  const token = randomBytes(32).toString("hex");
  const expiresAt = invitationExpiresAt();

  const userId = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        clerkUserId: `manual:${randomUUID()}`,
        email,
        firstName,
        lastName,
        phone: input.phone?.trim() || null,
        companyId: input.companyId,
        branchId: input.branchId ?? null,
      },
      select: { id: true },
    });

    const roleRecord = await tx.role.upsert({
      where: { companyId_name: { companyId: input.companyId, name: input.role } },
      create: {
        companyId: input.companyId,
        name: input.role,
        label: ROLE_LABELS[input.role] ?? String(input.role),
      },
      update: {},
    });

    await tx.userRole.create({
      data: { userId: user.id, roleId: roleRecord.id, companyId: input.companyId },
    });

    if (input.role === "BUYER") {
      await tx.profile.create({
        data: {
          userId: user.id,
          ...(input.buyerProfile ? cleanProfile(input.buyerProfile) : {}),
        },
      });
    } else {
      await tx.staffProfile.create({
        data: {
          userId: user.id,
          title: input.staffProfile?.title?.trim() || null,
          staffCode: input.staffProfile?.staffCode?.trim() || null,
          isAssignable: input.role === "MARKETER",
        },
      });
    }

    // Revoke any pending invitations for this email+company
    await tx.teamMemberInvitation.updateMany({
      where: { companyId: input.companyId, email, status: "PENDING" },
      data: { status: "REVOKED" },
    });

    await tx.teamMemberInvitation.create({
      data: {
        companyId: input.companyId,
        branchId: input.branchId ?? null,
        email,
        fullName,
        role: input.role,
        token,
        expiresAt,
        invitedByUserId: input.actorUserId,
      },
    });

    return user.id;
  });

  const acceptUrl = buildInvitationAcceptUrl(token);
  const emailContent =
    input.role === "BUYER"
      ? buildBuyerInvitationEmail({ inviteeName: fullName, companyName: company.name, acceptUrl, expiresAt })
      : buildTeamInvitationEmail({
          inviteeName: fullName,
          companyName: company.name,
          inviterName: await resolveActorName(input.actorUserId),
          role: input.role,
          acceptUrl,
          expiresAt,
        });

  await sendTransactionalEmail({ to: email, ...emailContent });

  await writeAuditLog({
    companyId: input.companyId,
    actorUserId: input.actorUserId,
    action: "CREATE",
    entityType: "User",
    entityId: userId,
    summary: `Operator-provisioned ${input.role} account (invite delivery).`,
    payload: { email, role: input.role, delivery: "invite" },
  });

  return { ok: true, userId, delivery: "invite", email };
}

// ─── Password path (gated by CLERK_PASSWORD_ENABLED) ─────────────────────────

async function provisionWithPassword(args: {
  input: ProvisionUserInput;
  email: string;
  firstName: string;
  lastName: string;
  company: { id: string; name: string };
}): Promise<ProvisionUserResult> {
  const { input, email, firstName, lastName } = args;
  const password = generatePassword();

  // Create Clerk account with password — never log or store the password after this
  const { clerkClient } = await import("@clerk/nextjs/server");
  const client = await clerkClient();
  let clerkUserId: string;
  try {
    const clerkUser = await client.users.createUser({
      emailAddress: [email],
      password,
      firstName,
      lastName,
      publicMetadata: { mustResetPassword: true },
    });
    clerkUserId = clerkUser.id;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create Clerk account.";
    return { ok: false, error: message };
  }

  let userId: string;
  try {
    userId = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          clerkUserId,
          email,
          firstName,
          lastName,
          phone: input.phone?.trim() || null,
          companyId: input.companyId,
          branchId: input.branchId ?? null,
        },
        select: { id: true },
      });

      const roleRecord = await tx.role.upsert({
        where: { companyId_name: { companyId: input.companyId, name: input.role } },
        create: {
          companyId: input.companyId,
          name: input.role,
          label: ROLE_LABELS[input.role] ?? String(input.role),
        },
        update: {},
      });

      await tx.userRole.create({
        data: { userId: user.id, roleId: roleRecord.id, companyId: input.companyId },
      });

      if (input.role === "BUYER") {
        await tx.profile.create({
          data: {
            userId: user.id,
            ...(input.buyerProfile ? cleanProfile(input.buyerProfile) : {}),
          },
        });
      } else {
        await tx.staffProfile.create({
          data: {
            userId: user.id,
            title: input.staffProfile?.title?.trim() || null,
            staffCode: input.staffProfile?.staffCode?.trim() || null,
            isAssignable: input.role === "MARKETER",
          },
        });
      }

      return user.id;
    });
  } catch (err) {
    // Best-effort cleanup: delete the Clerk user if the DB transaction failed
    try {
      await client.users.deleteUser(clerkUserId);
    } catch {
      // Cleanup failed — the orphaned Clerk user must be removed manually
    }
    const message = err instanceof Error ? err.message : "Failed to create user record.";
    return { ok: false, error: message };
  }

  // Audit log — the password is intentionally omitted
  await writeAuditLog({
    companyId: input.companyId,
    actorUserId: input.actorUserId,
    action: "CREATE",
    entityType: "User",
    entityId: userId,
    summary: `Operator-provisioned ${input.role} account (password delivery).`,
    payload: { email, role: input.role, delivery: "password", clerkUserId },
  });

  // Return password for one-time UI display only — never persisted
  return { ok: true, userId, delivery: "password", email, password };
}
