import type { TenantContext } from "@/lib/tenancy/context";
import { prisma } from "@/lib/db/prisma";
import { featureFlags } from "@/lib/env";
import { findFirstForTenant } from "@/lib/tenancy/db";
import { formatCurrency, formatDate } from "@/lib/utils";

type ScopedFindFirstDelegate = { findFirst: (args?: unknown) => Promise<unknown> };

export type ReceiptDownloadPayload = {
  receiptId: string;
  receiptNumber: string;
  issuedAt: string;
  companyName: string;
  companyLogoUrl: string | null;
  companyAddress: string | null;
  companyEmail: string | null;
  companyPhone: string | null;
  buyerName: string;
  propertyTitle: string;
  unitTitle: string | null;
  marketerName: string | null;
  paymentReference: string;
  paymentMethod: string;
  paymentAmount: string;
  totalPaid: string;
  outstandingBalance: string;
  completionState: "FULLY_PAID" | "PARTIALLY_PAID";
};

function hasAdminAccess(context: TenantContext) {
  return context.roles.some((role) => role !== "BUYER");
}

export function canViewerAccessReceipt(input: {
  isAdmin: boolean;
  viewerUserId: string | null;
  transactionUserId?: string | null;
  paymentUserId?: string | null;
}) {
  if (input.isAdmin) {
    return true;
  }

  if (!input.viewerUserId) {
    return false;
  }

  return (
    input.transactionUserId === input.viewerUserId ||
    input.paymentUserId === input.viewerUserId
  );
}

export async function getReceiptForViewer(
  context: TenantContext,
  receiptId: string,
): Promise<ReceiptDownloadPayload> {
  if (!featureFlags.hasDatabase || !context.companyId) {
    return {
      receiptId,
      receiptNumber: "RCT-DEMO-0001",
      issuedAt: formatDate(new Date()),
      companyName: "Acme Realty",
      companyLogoUrl: null,
      companyAddress: "12 Admiralty Way, Lekki Phase 1, Lagos",
      companyEmail: "support@acmerealty.dev",
      companyPhone: "+234 801 000 1000",
      buyerName: "Ada Okafor",
      propertyTitle: "Eko Atrium Residences",
      unitTitle: null,
      marketerName: "Tobi Adewale",
      paymentReference: "PAY-11082",
      paymentMethod: "PAYSTACK",
      paymentAmount: formatCurrency(12500000),
      totalPaid: formatCurrency(185000000),
      outstandingBalance: formatCurrency(0),
      completionState: "FULLY_PAID" as const,
    };
  }

  const receipt = (await findFirstForTenant(
    prisma.receipt as ScopedFindFirstDelegate,
    context,
    {
      where: {
        id: receiptId,
      },
      select: {
        id: true,
        receiptNumber: true,
        issuedAt: true,
        totalAmount: true,
        company: {
          select: {
            name: true,
            logoUrl: true,
          },
        },
        payment: {
          select: {
            providerReference: true,
            method: true,
            userId: true,
          },
        },
        transaction: {
          select: {
            totalValue: true,
            outstandingBalance: true,
            marketer: {
              select: {
                fullName: true,
              },
            },
            property: {
              select: {
                title: true,
              },
            },
            propertyUnit: {
              select: {
                title: true,
              },
            },
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
            companyId: true,
            userId: true,
          },
        },
        companyId: true,
      },
    } as Parameters<typeof prisma.receipt.findFirst>[0],
  )) as {
    id: string;
    receiptNumber: string;
    issuedAt: Date;
    totalAmount: { toNumber?: () => number } | number;
    companyId: string;
    company: { name: string; logoUrl: string | null };
    payment: { providerReference: string; method: string; userId: string | null };
    transaction: {
      totalValue: { toNumber?: () => number } | number;
      outstandingBalance: { toNumber?: () => number } | number;
      marketer: { fullName: string } | null;
      property: { title: string };
      propertyUnit: { title: string } | null;
      user: { firstName: string | null; lastName: string | null };
      companyId: string;
      userId: string;
    } | null;
  } | null;

  if (!receipt) {
    throw new Error("Receipt not found.");
  }

  if (
    !canViewerAccessReceipt({
      isAdmin: hasAdminAccess(context),
      viewerUserId: context.userId,
      transactionUserId: receipt.transaction?.userId,
      paymentUserId: receipt.payment.userId,
    })
  ) {
    throw new Error("Receipt access denied.");
  }

  const siteSettings = await prisma.siteSettings.findUnique({
    where: {
      companyId: receipt.companyId,
    },
    select: {
      address: true,
      supportEmail: true,
      supportPhone: true,
    },
  });

  const totalValue =
    receipt.transaction == null
      ? 0
      : typeof receipt.transaction.totalValue === "number"
        ? receipt.transaction.totalValue
        : receipt.transaction.totalValue.toNumber?.() ?? Number(receipt.transaction.totalValue);

  const outstandingBalance =
    receipt.transaction == null
      ? 0
      : typeof receipt.transaction.outstandingBalance === "number"
        ? receipt.transaction.outstandingBalance
        : receipt.transaction.outstandingBalance.toNumber?.() ??
          Number(receipt.transaction.outstandingBalance);

  const amount =
    typeof receipt.totalAmount === "number"
      ? receipt.totalAmount
      : receipt.totalAmount.toNumber?.() ?? Number(receipt.totalAmount);

  return {
    receiptId: receipt.id,
    receiptNumber: receipt.receiptNumber,
    issuedAt: formatDate(receipt.issuedAt, "PPP"),
    companyName: receipt.company.name,
    companyLogoUrl: receipt.company.logoUrl,
    companyAddress: siteSettings?.address ?? null,
    companyEmail: siteSettings?.supportEmail ?? null,
    companyPhone: siteSettings?.supportPhone ?? null,
    buyerName:
      `${receipt.transaction?.user.firstName ?? ""} ${receipt.transaction?.user.lastName ?? ""}`.trim() ||
      "Buyer",
    propertyTitle: receipt.transaction?.property.title ?? "Property",
    unitTitle: receipt.transaction?.propertyUnit?.title ?? null,
    marketerName: receipt.transaction?.marketer?.fullName ?? null,
    paymentReference: receipt.payment.providerReference,
    paymentMethod: receipt.payment.method,
    paymentAmount: formatCurrency(amount),
    totalPaid: formatCurrency(Math.max(0, totalValue - outstandingBalance)),
    outstandingBalance: formatCurrency(outstandingBalance),
    completionState: outstandingBalance === 0 ? "FULLY_PAID" : "PARTIALLY_PAID",
  };
}

export function renderReceiptHtml(payload: ReceiptDownloadPayload) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${payload.receiptNumber}</title>
    <style>
      body { font-family: Arial, sans-serif; background: #f6f1e8; color: #12202a; margin: 0; padding: 32px; }
      .sheet { max-width: 840px; margin: 0 auto; background: #ffffff; border-radius: 28px; padding: 40px; border: 1px solid #e8e2d9; }
      .header { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; }
      .brand { display: flex; gap: 16px; align-items: center; }
      .brand-mark { width: 56px; height: 56px; border-radius: 18px; background: #0e5b49; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: bold; }
      .eyebrow { font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase; color: #5b6a73; }
      h1 { margin: 12px 0 0; font-size: 40px; }
      .status { padding: 10px 14px; border-radius: 999px; background: #e7f4ee; color: #0e5b49; font-size: 13px; font-weight: 600; }
      .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; margin-top: 32px; }
      .card { border: 1px solid #ebe3d8; border-radius: 20px; padding: 18px; background: #fbfaf7; }
      .label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.14em; color: #6b7a83; }
      .value { margin-top: 8px; font-size: 22px; font-weight: 700; }
      .meta { margin-top: 40px; display: grid; gap: 14px; }
      .row { display: flex; justify-content: space-between; gap: 18px; border-bottom: 1px solid #ebe3d8; padding-bottom: 12px; }
      .row:last-child { border-bottom: 0; }
    </style>
  </head>
  <body>
    <div class="sheet">
      <div class="header">
        <div>
          <div class="brand">
            <div class="brand-mark">EO</div>
            <div>
              <div class="eyebrow">Branded client receipt</div>
              <div style="font-size:28px;font-weight:700;">${payload.companyName}</div>
            </div>
          </div>
          <h1>${payload.receiptNumber}</h1>
        </div>
        <div class="status">${payload.completionState === "FULLY_PAID" ? "Full payment complete" : "Payment recorded"}</div>
      </div>
      <div class="grid">
        <div class="card"><div class="label">Buyer</div><div class="value">${payload.buyerName}</div></div>
        <div class="card"><div class="label">Issued</div><div class="value">${payload.issuedAt}</div></div>
        <div class="card"><div class="label">Property</div><div class="value">${payload.propertyTitle}${payload.unitTitle ? ` · ${payload.unitTitle}` : ""}</div></div>
        <div class="card"><div class="label">Payment reference</div><div class="value">${payload.paymentReference}</div></div>
      </div>
      <div class="meta">
        <div class="row"><span>Payment method</span><strong>${payload.paymentMethod}</strong></div>
        <div class="row"><span>Payment amount</span><strong>${payload.paymentAmount}</strong></div>
        <div class="row"><span>Total paid so far</span><strong>${payload.totalPaid}</strong></div>
        <div class="row"><span>Outstanding balance</span><strong>${payload.outstandingBalance}</strong></div>
        <div class="row"><span>Marketer</span><strong>${payload.marketerName ?? "Unassigned"}</strong></div>
        <div class="row"><span>Company address</span><strong>${payload.companyAddress ?? "Not configured"}</strong></div>
        <div class="row"><span>Contact</span><strong>${payload.companyEmail ?? "Not configured"}${payload.companyPhone ? ` · ${payload.companyPhone}` : ""}</strong></div>
      </div>
    </div>
  </body>
</html>`;
}
