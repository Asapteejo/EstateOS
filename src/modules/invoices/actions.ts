"use server";

import { revalidatePath } from "next/cache";

import { requireAdminSession } from "@/lib/auth/guards";
import { rolesForAdminPath } from "@/lib/auth/admin-sections";
import { createInvoice, type InvoiceLineItem } from "@/modules/invoices/service";

export type InvoiceFormState = { ok: boolean; error: string | null };

function str(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function num(value: FormDataEntryValue | null): number {
  const cleaned = str(value).replace(/[^0-9.]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export async function createInvoiceAction(
  _prev: InvoiceFormState,
  formData: FormData,
): Promise<InvoiceFormState> {
  const tenant = await requireAdminSession(rolesForAdminPath("/admin/invoices"));

  const items: InvoiceLineItem[] = [];
  for (let i = 1; i <= 4; i += 1) {
    const description = str(formData.get(`description_${i}`));
    const amount = num(formData.get(`amount_${i}`));
    if (description.length > 0 && amount > 0) {
      items.push({ description, amount });
    }
  }

  const dueRaw = str(formData.get("dueDate"));

  const result = await createInvoice(tenant, {
    buyerName: str(formData.get("buyerName")),
    buyerEmail: str(formData.get("buyerEmail")),
    propertyTitle: str(formData.get("propertyTitle")) || null,
    items,
    taxAmount: num(formData.get("taxAmount")),
    dueDate: dueRaw ? new Date(dueRaw) : null,
    notes: str(formData.get("notes")) || null,
  });

  if (result.ok) {
    revalidatePath("/admin/invoices");
    revalidatePath("/portal/invoices");
  }

  return { ok: result.ok, error: result.error };
}
