import { requireAdminSession } from "@/lib/auth/guards";
import { buildCsv } from "@/lib/exports/csv";
import { prisma } from "@/lib/db/prisma";
import { findManyForTenant } from "@/lib/tenancy/db";
import { formatCurrency, formatDate } from "@/lib/utils";

type ScopedFindManyDelegate = { findMany: (args?: unknown) => Promise<unknown> };

export async function GET() {
  const tenant = await requireAdminSession(["ADMIN"]);

  const transactions = (await findManyForTenant(
    prisma.transaction as ScopedFindManyDelegate,
    tenant,
    {
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        paymentStatus: true,
        currentStage: true,
        nextPaymentDueAt: true,
        totalValue: true,
        outstandingBalance: true,
        reservation: {
          select: {
            reference: true,
          },
        },
        property: {
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
      },
    } as Parameters<typeof prisma.transaction.findMany>[0],
  )) as Array<{
    id: string;
    paymentStatus: string;
    currentStage: string;
    nextPaymentDueAt: Date | null;
    totalValue: { toNumber?: () => number } | number;
    outstandingBalance: { toNumber?: () => number } | number;
    reservation: { reference: string } | null;
    property: { title: string };
    user: { firstName: string | null; lastName: string | null };
  }>;

  const csv = buildCsv(
    [
      "Reference",
      "Property",
      "Buyer",
      "Stage",
      "Payment status",
      "Total value",
      "Outstanding balance",
      "Next due date",
    ],
    transactions.map((transaction) => [
      transaction.reservation?.reference ?? transaction.id,
      transaction.property.title,
      `${transaction.user.firstName ?? ""} ${transaction.user.lastName ?? ""}`.trim() || "Buyer",
      transaction.currentStage,
      transaction.paymentStatus,
      formatCurrency(typeof transaction.totalValue === "number" ? transaction.totalValue : transaction.totalValue.toNumber?.() ?? Number(transaction.totalValue)),
      formatCurrency(typeof transaction.outstandingBalance === "number" ? transaction.outstandingBalance : transaction.outstandingBalance.toNumber?.() ?? Number(transaction.outstandingBalance)),
      transaction.nextPaymentDueAt ? formatDate(transaction.nextPaymentDueAt, "PPP") : "",
    ]),
  );

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="estateos-transactions.csv"',
    },
  });
}
