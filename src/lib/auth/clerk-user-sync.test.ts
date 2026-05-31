import assert from "node:assert/strict";
import test from "node:test";
import {
  syncAuthenticatedClerkUser,
  type ClerkUserSyncInput,
} from "@/lib/auth/clerk-user-sync";

function createDelegate(existing: { id: string; clerkUserId: string } | null = null) {
  const calls = { create: 0, update: 0 };
  return {
    calls,
    delegate: {
      async findFirst() {
        return existing;
      },
      async create({ data }: { data: ClerkUserSyncInput }) {
        calls.create += 1;
        return { id: "created-user", clerkUserId: data.clerkUserId };
      },
      async update({
        where,
        data,
      }: {
        where: { id: string };
        data: ClerkUserSyncInput;
      }) {
        calls.update += 1;
        return { id: where.id, clerkUserId: data.clerkUserId };
      },
    },
  };
}

test("creates a persisted user on first Clerk login without creating roles", async () => {
  const { calls, delegate } = createDelegate();
  const result = await syncAuthenticatedClerkUser(
    { clerkUserId: "user_123", email: " OWNER@example.com " },
    delegate,
  );

  assert.deepEqual(result, { userId: "created-user", outcome: "created" });
  assert.equal(calls.create, 1);
  assert.equal(calls.update, 0);
});

test("links a manually provisioned placeholder user to Clerk", async () => {
  const { calls, delegate } = createDelegate({
    id: "db-user",
    clerkUserId: "manual:owner@example.com",
  });
  const result = await syncAuthenticatedClerkUser(
    { clerkUserId: "user_123", email: "owner@example.com" },
    delegate,
  );

  assert.deepEqual(result, { userId: "db-user", outcome: "linked" });
  assert.equal(calls.create, 0);
  assert.equal(calls.update, 1);
});

test("refuses to overwrite an email linked to another Clerk identity", async () => {
  const { calls, delegate } = createDelegate({
    id: "db-user",
    clerkUserId: "user_existing",
  });

  await assert.rejects(
    syncAuthenticatedClerkUser(
      { clerkUserId: "user_new", email: "owner@example.com" },
      delegate,
    ),
    /different Clerk identity/,
  );
  assert.equal(calls.create, 0);
  assert.equal(calls.update, 0);
});

