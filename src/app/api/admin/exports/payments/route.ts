import { requireAdminSession } from "@/lib/auth/guards";
import { buildCsv } from "@/lib/exports/csv";
import { prisma } from "@/lib/db/prisma";
import { findManyForTenant } from "@/lib/tenancy/db";
import { formatCurrency, formatDate } from "@/lib/utils";

type ScopedFindManyDelegate = { findMany: (args?: unknown) => Promise<unknown> };

export async function GET() {
  const tenant = await requireAdminSession(["ADMIN"]);

  const payments = (await findManyForTenant(
    prisma.payment as ScopedFindManyDelegate,
    tenant,
    {
      orderBy: {
        createdAt: "desc",
      },
      select: {
        providerReference: true,
        amount: true,
        status: true,
        method: true,
        paidAt: true,
        marketer: {
          select: {
            fullName: true,
          },
        },
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        receipt: {
          select: {
            receiptNumber: true,
          },
        },
      },
    } as Parameters<typeof prisma.payment.findMany>[0],
  )) as Array<{
    providerReference: string;
    amount: { toNumber?: () => number } | number;
    status: string;
    method: string;
    paidAt: Date | null;
    marketer: { fullName: string } | null;
    user: { firstName: string | null; lastName: string | null } | null;
    receipt: { receiptNumber: string } | null;
  }>;

  const csv = buildCsv(
    [
      "Reference",
      "Buyer",
      "Marketer",
      "Amount",
      "Status",
      "Method",
      "Paid at",
      "Receipt",
    ],
    payments.map((payment) => [
      payment.providerReference,
      `${payment.user?.firstName ?? ""} ${payment.user?.lastName ?? ""}`.trim() || "Buyer",
      payment.marketer?.fullName ?? "Unassigned",
      formatCurrency(typeof payment.amount === "number" ? payment.amount : payment.amount.toNumber?.() ?? Number(payment.amount)),
      payment.status,
      payment.method,
      payment.paidAt ? formatDate(payment.paidAt, "PPP p") : "",
      payment.receipt?.receiptNumber ?? "",
    ]),
  );

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="estateos-payments.csv"',
    },
  });
}
