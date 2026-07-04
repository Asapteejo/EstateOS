import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";
import { formatCurrency } from "@/lib/utils";
import { buildSafeErrorLogContext, logError } from "@/lib/ops/logger";
import type { TenantContext } from "@/lib/tenancy/context";

export type InvoiceStatus = "DRAFT" | "SENT" | "PAID" | "VOID";
export type InvoiceLineItem = { description: string; amount: number };

export type InvoiceSummary = {
  id: string;
  invoiceNumber: string;
  buyerName: string;
  buyerEmail: string;
  propertyTitle: string | null;
  total: string;
  status: InvoiceStatus;
  issuedAt: string;
  dueDate: string | null;
};

export type CreateInvoiceInput = {
  buyerName: string;
  buyerEmail: string;
  buyerId?: string | null;
  propertyTitle?: string | null;
  propertyId?: string | null;
  items: InvoiceLineItem[];
  taxAmount?: number;
  dueDate?: Date | null;
  notes?: string | null;
};

const OPERATOR_ROLES = ["ADMIN", "SUPER_ADMIN", "FINANCE", "STAFF", "LEGAL"];

function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function shortDate(value: Date | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" });
}

function generateInvoiceNumber(): string {
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `INV-${stamp}-${suffix}`;
}

/** Create an invoice. Never throws — returns a structured result. */
export async function createInvoice(
  context: TenantContext,
  input: CreateInvoiceInput,
): Promise<{ ok: boolean; error: string | null; id?: string }> {
  if (!featureFlags.hasDatabase || !context.companyId) {
    return { ok: false, error: "No active company." };
  }
  const buyerName = input.buyerName.trim();
  const buyerEmail = input.buyerEmail.trim();
  if (buyerName.length < 2) return { ok: false, error: "Enter the buyer's name." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(buyerEmail)) return { ok: false, error: "Enter a valid buyer email." };

  const items = input.items
    .map((item) => ({ description: item.description.trim(), amount: toNumber(item.amount) }))
    .filter((item) => item.description.length > 0 && item.amount > 0);
  if (items.length === 0) return { ok: false, error: "Add at least one line item with an amount." };

  const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
  const taxAmount = Math.max(0, toNumber(input.taxAmount));
  const total = subtotal + taxAmount;

  try {
    const invoice = await prisma.invoice.create({
      data: {
        companyId: context.companyId,
        invoiceNumber: generateInvoiceNumber(),
        buyerId: input.buyerId ?? null,
        buyerName,
        buyerEmail,
        propertyId: input.propertyId ?? null,
        propertyTitle: input.propertyTitle?.trim() || null,
        items,
        subtotal,
        taxAmount,
        total,
        notes: input.notes?.trim() || null,
        dueDate: input.dueDate ?? null,
        createdById: context.userId ?? null,
      },
      select: { id: true },
    });
    return { ok: true, error: null, id: invoice.id };
  } catch (error) {
    logError("Invoice create failed (migration pending?).", {
      route: "/admin/invoices",
      companyId: context.companyId,
      ...buildSafeErrorLogContext(error),
    });
    return { ok: false, error: "Could not create the invoice. Please try again." };
  }
}

function toSummary(row: {
  id: string;
  invoiceNumber: string;
  buyerName: string;
  buyerEmail: string;
  propertyTitle: string | null;
  total: unknown;
  status: string;
  issuedAt: Date;
  dueDate: Date | null;
}): InvoiceSummary {
  return {
    id: row.id,
    invoiceNumber: row.invoiceNumber,
    buyerName: row.buyerName,
    buyerEmail: row.buyerEmail,
    propertyTitle: row.propertyTitle,
    total: formatCurrency(toNumber(row.total)),
    status: row.status as InvoiceStatus,
    issuedAt: shortDate(row.issuedAt),
    dueDate: row.dueDate ? shortDate(row.dueDate) : null,
  };
}

const SUMMARY_SELECT = {
  id: true,
  invoiceNumber: true,
  buyerName: true,
  buyerEmail: true,
  propertyTitle: true,
  total: true,
  status: true,
  issuedAt: true,
  dueDate: true,
} as const;

/** Every invoice for the company (accountant view). Degrades to [] pre-migration. */
export async function listInvoicesForAdmin(context: { companyId: string | null }): Promise<InvoiceSummary[]> {
  if (!featureFlags.hasDatabase || !context.companyId) return [];
  try {
    const rows = await prisma.invoice.findMany({
      where: { companyId: context.companyId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: SUMMARY_SELECT,
    });
    return rows.map(toSummary);
  } catch (error) {
    logError("List invoices (admin) failed; returning empty.", {
      route: "/admin/invoices",
      companyId: context.companyId,
      ...buildSafeErrorLogContext(error),
    });
    return [];
  }
}

/** Invoices addressed to a specific buyer (by id or email). Degrades to []. */
export async function listInvoicesForBuyer(context: {
  companyId: string | null;
  userId?: string | null;
  email?: string | null;
}): Promise<InvoiceSummary[]> {
  if (!featureFlags.hasDatabase || !context.companyId) return [];
  const email = context.email?.trim().toLowerCase() ?? null;
  const or: Array<Record<string, unknown>> = [];
  if (context.userId) or.push({ buyerId: context.userId });
  if (email) or.push({ buyerEmail: { equals: email, mode: "insensitive" } });
  if (or.length === 0) return [];
  try {
    const rows = await prisma.invoice.findMany({
      where: { companyId: context.companyId, OR: or },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: SUMMARY_SELECT,
    });
    return rows.map(toSummary);
  } catch (error) {
    logError("List invoices (buyer) failed; returning empty.", {
      route: "/portal/invoices",
      companyId: context.companyId,
      ...buildSafeErrorLogContext(error),
    });
    return [];
  }
}

export type InvoiceDocument = {
  invoiceNumber: string;
  status: InvoiceStatus;
  issuedAt: string;
  dueDate: string;
  companyName: string;
  companyLogoUrl: string | null;
  companyAddress: string | null;
  companyEmail: string | null;
  companyPhone: string | null;
  buyerName: string;
  buyerEmail: string;
  propertyTitle: string | null;
  currency: string;
  items: Array<{ description: string; amount: string }>;
  subtotal: string;
  taxAmount: string;
  total: string;
  notes: string | null;
};

function viewerIsOperator(roles: readonly string[] | undefined): boolean {
  return Boolean(roles?.some((role) => OPERATOR_ROLES.includes(role)));
}

/** Fetch a single invoice as a print-ready document, enforcing that a buyer can
 *  only open invoices addressed to them. Throws on not-found / access denied. */
export async function getInvoiceDocumentForViewer(
  viewer: TenantContext,
  invoiceId: string,
): Promise<InvoiceDocument> {
  if (!featureFlags.hasDatabase || !viewer.companyId) {
    throw new Error("Invoice not found.");
  }
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, companyId: viewer.companyId },
  });
  if (!invoice) throw new Error("Invoice not found.");

  if (!viewerIsOperator(viewer.roles)) {
    const email = viewer.email?.trim().toLowerCase() ?? "";
    const ownsById = invoice.buyerId && invoice.buyerId === viewer.userId;
    const ownsByEmail = email.length > 0 && invoice.buyerEmail.trim().toLowerCase() === email;
    if (!ownsById && !ownsByEmail) throw new Error("Access denied.");
  }

  const [company, siteSettings] = await Promise.all([
    prisma.company.findUnique({ where: { id: viewer.companyId }, select: { name: true, logoUrl: true } }),
    prisma.siteSettings
      .findUnique({ where: { companyId: viewer.companyId }, select: { address: true, supportEmail: true, supportPhone: true } })
      .catch(() => null),
  ]);

  const rawItems = Array.isArray(invoice.items) ? (invoice.items as unknown as InvoiceLineItem[]) : [];
  const currency = invoice.currency || "NGN";

  return {
    invoiceNumber: invoice.invoiceNumber,
    status: invoice.status as InvoiceStatus,
    issuedAt: shortDate(invoice.issuedAt),
    dueDate: invoice.dueDate ? shortDate(invoice.dueDate) : "On receipt",
    companyName: company?.name ?? "Company",
    companyLogoUrl: company?.logoUrl ?? null,
    companyAddress: siteSettings?.address ?? null,
    companyEmail: siteSettings?.supportEmail ?? null,
    companyPhone: siteSettings?.supportPhone ?? null,
    buyerName: invoice.buyerName,
    buyerEmail: invoice.buyerEmail,
    propertyTitle: invoice.propertyTitle,
    currency,
    items: rawItems.map((item) => ({
      description: item.description,
      amount: formatCurrency(toNumber(item.amount), currency),
    })),
    subtotal: formatCurrency(toNumber(invoice.subtotal), currency),
    taxAmount: formatCurrency(toNumber(invoice.taxAmount), currency),
    total: formatCurrency(toNumber(invoice.total), currency),
    notes: invoice.notes,
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Tenant-branded, print-ready invoice document. The tenant's identity leads;
 *  a discreet "Powered by EstateOS" line sits at the very bottom. */
export function renderInvoiceHtml(doc: InvoiceDocument): string {
  const initials = doc.companyName.slice(0, 2).toUpperCase();
  const brandMark = doc.companyLogoUrl
    ? `<img src="${escapeHtml(doc.companyLogoUrl)}" alt="${escapeHtml(doc.companyName)}" style="width:56px;height:56px;border-radius:14px;object-fit:cover;" />`
    : `<div class="brand-mark">${escapeHtml(initials)}</div>`;
  const rows = doc.items
    .map(
      (item) =>
        `<tr><td>${escapeHtml(item.description)}</td><td style="text-align:right;">${escapeHtml(item.amount)}</td></tr>`,
    )
    .join("");
  const contactLine = [doc.companyEmail, doc.companyPhone].filter((v): v is string => v !== null).map(escapeHtml).join(" · ");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Invoice ${escapeHtml(doc.invoiceNumber)}</title>
    <style>
      body { font-family: Arial, Helvetica, sans-serif; background: #f4f5f7; color: #1a2230; margin: 0; padding: 28px; }
      .sheet { max-width: 800px; margin: 0 auto; background: #fff; border: 1px solid #e6e8ec; border-radius: 20px; padding: 40px; }
      .top { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; }
      .brand { display: flex; gap: 14px; align-items: center; }
      .brand-mark { width: 56px; height: 56px; border-radius: 14px; background: #0e5b49; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 20px; }
      .company { font-size: 20px; font-weight: 700; }
      .muted { color: #6b7480; font-size: 13px; }
      .title { text-align: right; }
      .title h1 { margin: 0; font-size: 30px; letter-spacing: 2px; color: #0e5b49; }
      .status { display: inline-block; margin-top: 6px; padding: 4px 12px; border-radius: 999px; background: #eef4f1; color: #0e5b49; font-size: 12px; font-weight: 700; }
      .parties { display: flex; justify-content: space-between; gap: 24px; margin-top: 32px; }
      .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.14em; color: #8a929c; }
      table { width: 100%; border-collapse: collapse; margin-top: 28px; }
      th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: #8a929c; border-bottom: 1px solid #e6e8ec; padding: 10px 0; }
      td { padding: 12px 0; border-bottom: 1px solid #f0f1f4; font-size: 14px; }
      .totals { margin-top: 20px; margin-left: auto; width: 260px; }
      .totals .row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }
      .totals .grand { border-top: 2px solid #1a2230; margin-top: 6px; padding-top: 12px; font-size: 18px; font-weight: 700; }
      .notes { margin-top: 28px; font-size: 13px; color: #4a535f; }
      .foot { margin-top: 40px; padding-top: 18px; border-top: 1px solid #e6e8ec; display: flex; justify-content: space-between; align-items: center; gap: 12px; }
      .powered { font-size: 12px; color: #98a0aa; }
      .powered strong { color: #0e5b49; }
      .print-btn { background: #0e5b49; color: #fff; border: 0; border-radius: 10px; padding: 10px 16px; font-size: 13px; font-weight: 600; cursor: pointer; }
      @media print { body { background: #fff; padding: 0; } .sheet { border: 0; border-radius: 0; } .no-print { display: none !important; } }
    </style>
  </head>
  <body>
    <div class="sheet">
      <div class="top">
        <div class="brand">
          ${brandMark}
          <div>
            <div class="company">${escapeHtml(doc.companyName)}</div>
            ${doc.companyAddress ? `<div class="muted">${escapeHtml(doc.companyAddress)}</div>` : ""}
            ${contactLine ? `<div class="muted">${contactLine}</div>` : ""}
          </div>
        </div>
        <div class="title">
          <h1>INVOICE</h1>
          <div class="muted">${escapeHtml(doc.invoiceNumber)}</div>
          <div class="status">${escapeHtml(doc.status)}</div>
        </div>
      </div>

      <div class="parties">
        <div>
          <div class="label">Billed to</div>
          <div style="margin-top:6px;font-weight:600;">${escapeHtml(doc.buyerName)}</div>
          <div class="muted">${escapeHtml(doc.buyerEmail)}</div>
          ${doc.propertyTitle ? `<div class="muted" style="margin-top:6px;">Property: ${escapeHtml(doc.propertyTitle)}</div>` : ""}
        </div>
        <div style="text-align:right;">
          <div class="label">Issued</div>
          <div style="margin-top:6px;">${escapeHtml(doc.issuedAt)}</div>
          <div class="label" style="margin-top:12px;">Due</div>
          <div style="margin-top:6px;">${escapeHtml(doc.dueDate)}</div>
        </div>
      </div>

      <table>
        <thead><tr><th>Description</th><th style="text-align:right;">Amount</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>

      <div class="totals">
        <div class="row"><span>Subtotal</span><span>${escapeHtml(doc.subtotal)}</span></div>
        <div class="row"><span>Tax</span><span>${escapeHtml(doc.taxAmount)}</span></div>
        <div class="row grand"><span>Amount due</span><span>${escapeHtml(doc.total)}</span></div>
      </div>

      ${doc.notes ? `<div class="notes"><strong>Notes:</strong> ${escapeHtml(doc.notes)}</div>` : ""}

      <div class="foot">
        <div class="powered">Powered by <strong>EstateOS</strong></div>
        <button class="print-btn no-print" onclick="window.print()">Print / Save as PDF</button>
      </div>
    </div>
  </body>
</html>`;
}
