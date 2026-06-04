import assert from "node:assert/strict";
import test from "node:test";
import type { AppRole } from "@prisma/client";

import {
  BuyerSelfRegistrationAccessError,
  registerBuyerForTenantFromAuthIntent,
} from "@/modules/buyers/self-registration";

type MockUser = {
  id: string;
  clerkUserId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
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

function buildMockDb(input?: {
  user?: MockUser | null;
  companyId?: string;
  companySlug?: string;
}) {
  const state = {
    companyId: input?.companyId ?? "company_blueprint",
    companySlug: input?.companySlug ?? "blueprint-urban-residences",
    user: input?.user === undefined ? null : input.user,
    userRolesCreated: 0,
    profilesCreated: 0,
    rolesCreated: 0,
  };

  const tx = {
    company: {
      findUnique: async () => ({ id: state.companyId, slug: state.companySlug }),
    },
    user: {
      findFirst: async () => state.user,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        state.user = {
          id: "user_buyer",
          clerkUserId: String(data.clerkUserId),
          email: String(data.email),
          firstName: String(data.firstName ?? ""),
          lastName: String(data.lastName ?? ""),
          phone: (data.phone as string | null | undefined) ?? null,
          companyId: data.companyId as string,
          branchId: null,
          roles: [],
        };
        return state.user;
      },
      update: async ({ data }: { data: Record<string, unknown> }) => {
        assert.ok(state.user);
        state.user = {
          ...state.user,
          clerkUserId: (data.clerkUserId as string | undefined) ?? state.user.clerkUserId,
          email: (data.email as string | undefined) ?? state.user.email,
          firstName: (data.firstName as string | undefined) ?? state.user.firstName,
          lastName: (data.lastName as string | undefined) ?? state.user.lastName,
          phone: (data.phone as string | undefined) ?? state.user.phone,
          companyId: (data.companyId as string | undefined) ?? state.user.companyId,
        };
        return state.user;
      },
    },
    role: {
      upsert: async () => {
        state.rolesCreated += 1;
        return { id: "role_buyer" };
      },
    },
    userRole: {
      upsert: async () => {
        state.userRolesCreated += 1;
        if (
          state.user &&
          !state.user.roles.some(
            (assignment) =>
              assignment.companyId === state.companyId &&
              assignment.role.companyId === state.companyId &&
              assignment.role.name === "BUYER",
          )
        ) {
          state.user.roles.push({
            companyId: state.companyId,
            role: {
              companyId: state.companyId,
              name: "BUYER",
            },
          });
        }
        return { id: "user_role_buyer" };
      },
    },
    profile: {
      upsert: async () => {
        state.profilesCreated += 1;
        return { id: "profile_buyer" };
      },
    },
  };

  return {
    state,
    db: {
      $transaction: async <T>(callback: (transaction: typeof tx) => Promise<T>) => callback(tx),
    },
  };
}

const noopSideEffects = {
  hasDatabase: true,
  writeAuditLog: async (entry: unknown) => entry,
  notifyTenantOperators: async () => undefined,
};

test("buyer self-registration creates a DB user, scoped BUYER role, and profile", async () => {
  const { db, state } = buildMockDb();

  const result = await registerBuyerForTenantFromAuthIntent(
    {
      clerkUserId: "user_clerk",
      email: " Buyer@Example.com ",
      firstName: "Ada",
      lastName: "Okafor",
      targetCompanyId: state.companyId,
      targetCompanySlug: state.companySlug,
      host: "blueprinturbanresidences.com",
    },
    db as never,
    noopSideEffects,
  );

  assert.equal(result.status, "created");
  assert.equal(state.user?.companyId, state.companyId);
  assert.equal(state.user?.email, "buyer@example.com");
  assert.equal(state.userRolesCreated, 1);
  assert.equal(state.profilesCreated, 1);
});

test("buyer self-registration is idempotent for an existing same-tenant buyer", async () => {
  const { db, state } = buildMockDb({
    user: {
      id: "user_existing",
      clerkUserId: "user_clerk",
      email: "buyer@example.com",
      firstName: "Ada",
      lastName: "Okafor",
      phone: null,
      companyId: "company_blueprint",
      branchId: null,
      roles: [
        {
          companyId: "company_blueprint",
          role: { companyId: "company_blueprint", name: "BUYER" },
        },
      ],
    },
  });

  const result = await registerBuyerForTenantFromAuthIntent(
    {
      clerkUserId: "user_clerk",
      email: "buyer@example.com",
      targetCompanyId: state.companyId,
    },
    db as never,
    noopSideEffects,
  );

  assert.equal(result.status, "existing");
  assert.equal(state.userRolesCreated, 1);
  assert.equal(state.profilesCreated, 1);
  assert.equal(state.user?.roles.length, 1);
});

test("buyer self-registration links manual placeholder users without creating duplicates", async () => {
  const { db, state } = buildMockDb({
    user: {
      id: "user_placeholder",
      clerkUserId: "manual:buyer@example.com",
      email: "buyer@example.com",
      firstName: null,
      lastName: null,
      phone: null,
      companyId: null,
      branchId: null,
      roles: [],
    },
  });

  const result = await registerBuyerForTenantFromAuthIntent(
    {
      clerkUserId: "user_clerk",
      email: "buyer@example.com",
      firstName: "Ada",
      targetCompanyId: state.companyId,
    },
    db as never,
    noopSideEffects,
  );

  assert.equal(result.status, "created");
  assert.equal(state.user?.id, "user_placeholder");
  assert.equal(state.user?.clerkUserId, "user_clerk");
  assert.equal(state.user?.companyId, state.companyId);
});

test("buyer self-registration rejects superadmin and tenant operator users", async () => {
  for (const role of ["SUPER_ADMIN", "ADMIN", "STAFF", "LEGAL", "FINANCE"] satisfies AppRole[]) {
    const { db, state } = buildMockDb({
      user: {
        id: `user_${role.toLowerCase()}`,
        clerkUserId: "user_clerk",
        email: `${role.toLowerCase()}@example.com`,
        firstName: null,
        lastName: null,
        phone: null,
        companyId: role === "SUPER_ADMIN" ? null : "company_blueprint",
        branchId: null,
        roles: [
          {
            companyId: role === "SUPER_ADMIN" ? null : "company_blueprint",
            role: { companyId: role === "SUPER_ADMIN" ? null : "company_blueprint", name: role },
          },
        ],
      },
    });

    await assert.rejects(
      () =>
        registerBuyerForTenantFromAuthIntent(
          {
            clerkUserId: "user_clerk",
            email: `${role.toLowerCase()}@example.com`,
            targetCompanyId: state.companyId,
          },
          db as never,
          noopSideEffects,
        ),
      BuyerSelfRegistrationAccessError,
    );
    assert.equal(state.userRolesCreated, 0);
    assert.equal(state.profilesCreated, 0);
  }
});

test("buyer self-registration rejects buyers from another tenant without overwriting company", async () => {
  const { db, state } = buildMockDb({
    user: {
      id: "user_other_buyer",
      clerkUserId: "user_clerk",
      email: "buyer@example.com",
      firstName: null,
      lastName: null,
      phone: null,
      companyId: "company_other",
      branchId: null,
      roles: [
        {
          companyId: "company_other",
          role: { companyId: "company_other", name: "BUYER" },
        },
      ],
    },
  });

  await assert.rejects(
    () =>
      registerBuyerForTenantFromAuthIntent(
        {
          clerkUserId: "user_clerk",
          email: "buyer@example.com",
          targetCompanyId: state.companyId,
        },
        db as never,
        noopSideEffects,
      ),
    BuyerSelfRegistrationAccessError,
  );

  assert.equal(state.user?.companyId, "company_other");
  assert.equal(state.userRolesCreated, 0);
  assert.equal(state.profilesCreated, 0);
});
