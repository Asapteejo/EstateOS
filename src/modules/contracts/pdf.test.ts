import assert from "node:assert/strict";
import test from "node:test";

import { renderContractPdf } from "@/modules/contracts/pdf";
import {
  assertTemplateCanBeMutated,
  assertTenantContractAssetKeys,
  buildContractSettingsReadiness,
  buildTemplateSnapshot,
  resolveContractActorDbUserId,
  resolveContractActorUserForWrite,
  shouldTriggerContractGenerationAfterPayment,
  type ContractTemplateRow,
} from "@/modules/contracts/service";

test("contract settings readiness requires signatory, private assets, and terms", () => {
  const incomplete = buildContractSettingsReadiness({
    ceoName: "Ada CEO",
    ceoTitle: "CEO",
    signatureKey: "acme/contract-assets/signature.png",
    stampKey: null,
    contractTerms: "Buyer agrees to the tenant-provided terms.",
  });

  assert.equal(incomplete.isConfigured, false);
  assert.equal(incomplete.stampUploaded, false);

  const complete = buildContractSettingsReadiness({
    ceoName: "Ada CEO",
    ceoTitle: "CEO",
    signatureKey: "acme/contract-assets/signature.png",
    stampKey: "acme/contract-assets/stamp.png",
    contractTerms: "Buyer agrees to the tenant-provided terms.",
  });

  assert.equal(complete.isConfigured, true);
});

test("contract settings reject stamp and signature keys from another tenant", () => {
  assert.doesNotThrow(() =>
    assertTenantContractAssetKeys(
      { companyId: "company-1", companySlug: "acme" },
      {
        signatureKey: "acme/contract-assets/signature.png",
        stampKey: "acme/contract-assets/stamp.png",
      },
    ),
  );
  assert.throws(
    () =>
      assertTenantContractAssetKeys(
        { companyId: "company-1", companySlug: "acme" },
        {
          signatureKey: "other-tenant/contract-assets/signature.png",
          stampKey: "acme/contract-assets/stamp.png",
        },
      ),
    /resolved tenant/i,
  );
});

test("payment-trigger guard requires successful full payment and configured settings", () => {
  assert.equal(
    shouldTriggerContractGenerationAfterPayment({
      paymentStatus: "SUCCESS",
      outstandingBalance: 0,
      isConfigured: true,
    }),
    true,
  );
  assert.equal(
    shouldTriggerContractGenerationAfterPayment({
      paymentStatus: "SUCCESS",
      outstandingBalance: 1,
      isConfigured: true,
    }),
    false,
  );
  assert.equal(
    shouldTriggerContractGenerationAfterPayment({
      paymentStatus: "FAILED",
      outstandingBalance: 0,
      isConfigured: true,
    }),
    false,
  );
  assert.equal(
    shouldTriggerContractGenerationAfterPayment({
      paymentStatus: "SUCCESS",
      outstandingBalance: 0,
      isConfigured: false,
    }),
    false,
  );
});

test("contract renderer returns real PDF bytes for structured contract data", () => {
  const pdf = renderContractPdf({
    contractNumber: "COS-ACME-0001-V01",
    generatedDate: "May 23, 2026",
    company: {
      name: "Acme Realty",
      legalName: "Acme Realty Limited",
      address: "12 Admiralty Way, Lagos",
      email: "legal@acme.test",
      phone: "+234 800 000 0000",
    },
    buyer: {
      name: "Ada Buyer",
      email: "ada@example.com",
      phone: "+234 801 000 0000",
    },
    property: {
      title: "Eko Atrium",
      unitTitle: "A-12",
      location: "Lagos, Nigeria",
    },
    payment: {
      reference: "PAY-001",
      amount: "NGN 10,000,000",
      currency: "NGN",
      paidAt: "May 23, 2026",
    },
    signatory: {
      name: "Ada CEO",
      title: "CEO",
    },
    terms: "These are tenant-provided, lawyer-approved contract terms.",
    footerLegalText: "Tenant legal footer.",
  });

  assert.equal(pdf.subarray(0, 8).toString(), "%PDF-1.4");
  assert.equal(pdf.includes(Buffer.from("COS-ACME-0001-V01")), true);
  assert.equal(pdf.includes(Buffer.from("endstream")), true);
});

function templateFixture(overrides: Partial<ContractTemplateRow> = {}): ContractTemplateRow {
  return {
    id: "template-v1",
    companyId: "company-1",
    mode: "SYSTEM_TEMPLATE",
    version: 1,
    isActive: true,
    isConfigured: true,
    documentId: null,
    storageKey: null,
    fieldMappings: null,
    ceoName: "Ada CEO",
    ceoTitle: "CEO",
    signatureKey: "companies/company-1/signature.png",
    stampKey: "companies/company-1/stamp.png",
    contractTerms: "Version one terms.",
    footerLegalText: "Footer v1.",
    replacedByTemplateId: null,
    archivedAt: null,
    createdByUserId: "admin-1",
    notes: null,
    createdAt: new Date("2026-05-23T00:00:00.000Z"),
    updatedAt: new Date("2026-05-23T00:00:00.000Z"),
    ...overrides,
  };
}

test("template snapshot locks template identity and legal metadata hashes", async () => {
  const v1 = templateFixture();
  const v2 = templateFixture({
    id: "template-v2",
    version: 2,
    ceoName: "Grace CEO",
    footerLegalText: "Footer v2.",
    replacedByTemplateId: null,
  });

  const snapshotV1 = await buildTemplateSnapshot(v1);
  const snapshotV2 = await buildTemplateSnapshot(v2);

  assert.equal(snapshotV1.templateId, "template-v1");
  assert.equal(snapshotV1.templateVersion, 1);
  assert.equal(snapshotV1.ceoName, "Ada CEO");
  assert.equal(snapshotV1.footerLegalTextHash?.length, 64);
  assert.equal(snapshotV2.templateId, "template-v2");
  assert.equal(snapshotV2.templateVersion, 2);
  assert.notEqual(snapshotV1.footerLegalTextHash, snapshotV2.footerLegalTextHash);
});

test("used template versions cannot be mutated in place", () => {
  assert.doesNotThrow(() => assertTemplateCanBeMutated({ generatedContractsCount: 0 }));
  assert.throws(
    () => assertTemplateCanBeMutated({ generatedContractsCount: 1 }),
    /cannot be mutated/i,
  );
});

function createContractUserDelegate(users: Array<{ id: string; clerkUserId?: string; email: string; companyId: string | null }>) {
  return {
    async findFirst(args: { where: Record<string, unknown>; select: { id: true; companyId: true } }) {
      const where = args.where as {
        OR?: Array<Record<string, string>>;
        companyId?: string;
      };

      return users.find((user) => {
        if (where.companyId && user.companyId !== where.companyId) {
          return false;
        }

        return where.OR?.some((condition) => {
          if (condition.id) return user.id === condition.id;
          if (condition.clerkUserId) return user.clerkUserId === condition.clerkUserId;
          if (condition.email) return user.email === condition.email;
          return false;
        });
      }) ?? null;
    },
  };
}

test("contract actor resolver resolves Clerk/dev ids to tenant DB user ids", async () => {
  const resolved = await resolveContractActorDbUserId(
    {
      userId: "demo-admin",
      email: "admin@example.com",
      companyId: "company_1",
      isSuperAdmin: false,
    },
    {
      userDelegate: createContractUserDelegate([
        { id: "user_db_1", clerkUserId: "demo-admin", email: "admin@example.com", companyId: "company_1" },
      ]),
    },
  );

  assert.equal(resolved, "user_db_1");
});

test("contract actor resolver omits unresolved synthetic ids outside production", async () => {
  const resolved = await resolveContractActorDbUserId(
    {
      userId: "synthetic-admin",
      email: "missing@example.com",
      companyId: "company_1",
      isSuperAdmin: false,
    },
    {
      userDelegate: createContractUserDelegate([]),
    },
  );

  assert.equal(resolved, null);
});

test("contract actor resolver remains tenant-isolated", async () => {
  const resolved = await resolveContractActorDbUserId(
    {
      userId: "demo-admin",
      email: "admin@example.com",
      companyId: "company_1",
      isSuperAdmin: false,
    },
    {
      userDelegate: createContractUserDelegate([
        { id: "user_db_2", clerkUserId: "demo-admin", email: "admin@example.com", companyId: "company_2" },
      ]),
    },
  );

  assert.equal(resolved, null);
});

test("contract actor resolver is strict in production", () => {
  assert.throws(
    () => resolveContractActorUserForWrite({
      requestedUserId: "missing-user",
      resolvedUserId: null,
      isProduction: true,
    }),
    /does not exist/i,
  );
});
