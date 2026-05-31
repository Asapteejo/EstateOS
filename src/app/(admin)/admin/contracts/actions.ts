"use server";

import { revalidatePath } from "next/cache";
import { PutObjectCommand } from "@aws-sdk/client-s3";

import { requireAdminSession } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";
import { r2 } from "@/lib/storage/r2";
import { env } from "@/lib/env";
import { namespaceTenantStorageKey } from "@/lib/storage/paths";
import {
  createContract,
  generateContractForTransaction,
  resolveContractActorDbUserId,
  sendContract,
} from "@/modules/contracts/service";

// ─── Upload contract PDF and link to transaction ─────────────────────────────

export async function uploadContractAction(formData: FormData): Promise<void> {
  const tenant = await requireAdminSession(["ADMIN", "LEGAL"]);
  if (!tenant.companyId || !tenant.userId) return;

  const file = formData.get("file") as File | null;
  const transactionId = (formData.get("transactionId") as string | null)?.trim();

  if (!file || !transactionId) return;
  if (file.type !== "application/pdf" && !file.name.endsWith(".pdf")) return;
  if (file.size > 20 * 1024 * 1024) return;
  if (!featureFlags.hasDatabase) return;

  // Verify the transaction belongs to this company
  const tx = await prisma.transaction.findFirst({
    where: { id: transactionId, companyId: tenant.companyId },
    select: { id: true },
  });
  if (!tx) return;

  const storageKey = namespaceTenantStorageKey(tenant, "contracts/uploaded", file.name, crypto.randomUUID());
  const actorDbUserId = await resolveContractActorDbUserId(tenant);

  // Upload directly to R2 from the server action
  if (r2 && env.R2_BUCKET_NAME) {
    const bytes = await file.arrayBuffer();
    await r2.send(
      new PutObjectCommand({
        Bucket: env.R2_BUCKET_NAME,
        Key: storageKey,
        Body: Buffer.from(bytes),
        ContentType: "application/pdf",
      }),
    );
  }

  const document = await prisma.document.create({
    data: {
      companyId: tenant.companyId,
      transactionId,
      fileName: file.name,
      storageKey,
      mimeType: "application/pdf",
      sizeBytes: file.size,
      documentType: "CONTRACT",
      visibility: "PRIVATE",
      uploadedByUserId: actorDbUserId ?? undefined,
    },
    select: { id: true },
  });

  await createContract({
    companyId: tenant.companyId,
    transactionId,
    documentId: document.id,
    actorUserId: actorDbUserId ?? undefined,
  });

  revalidatePath("/admin/contracts");
}

// ─── Send contract to buyer ───────────────────────────────────────────────────

export async function sendContractAction(formData: FormData): Promise<void> {
  const tenant = await requireAdminSession(["ADMIN", "LEGAL"]);
  if (!tenant.companyId || !tenant.userId) return;

  const signedAgreementId = (formData.get("signedAgreementId") as string | null)?.trim();
  if (!signedAgreementId) return;

  const actorDbUserId = await resolveContractActorDbUserId(tenant);

  await sendContract({
    signedAgreementId,
    companyId: tenant.companyId,
    actorUserId: actorDbUserId ?? undefined,
  });

  revalidatePath("/admin/contracts");
}

export async function generateContractAction(formData: FormData): Promise<void> {
  const tenant = await requireAdminSession(["ADMIN", "LEGAL"]);
  if (!tenant.companyId || !tenant.companySlug) return;

  const transactionId = (formData.get("transactionId") as string | null)?.trim();
  const forceRegenerate = formData.get("forceRegenerate") === "true";
  const templateId = (formData.get("templateId") as string | null)?.trim() || null;
  const regeneratedFromContractId = (formData.get("regeneratedFromContractId") as string | null)?.trim() || null;
  if (!transactionId) return;

  await generateContractForTransaction({
    companyId: tenant.companyId,
    companySlug: tenant.companySlug,
    transactionId,
    actorUserId: tenant.userId,
    actorEmail: tenant.email,
    actorIsSuperAdmin: tenant.isSuperAdmin,
    forceRegenerate,
    templateId,
    regeneratedFromContractId,
  });

  revalidatePath("/admin/contracts");
  revalidatePath("/portal/contracts");
}
