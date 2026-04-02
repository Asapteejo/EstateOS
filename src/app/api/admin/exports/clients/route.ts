import { requireAdminSession } from "@/lib/auth/guards";
import { buildCsv } from "@/lib/exports/csv";
import { getAdminClientList } from "@/modules/clients/queries";

export async function GET() {
  const tenant = await requireAdminSession(["ADMIN"]);
  const clients = await getAdminClientList(tenant);

  const csv = buildCsv(
    [
      "Client",
      "Email",
      "Phone",
      "KYC",
      "Current stage",
      "Wishlist items",
      "Reservations",
      "Payments",
      "Outstanding balance",
      "Last activity",
    ],
    clients.map((client) => [
      client.name,
      client.email,
      client.phone,
      client.kycStatus,
      client.currentStage,
      client.wishlistCount,
      client.reservationCount,
      client.paymentCount,
      client.outstandingBalance,
      client.lastActivityAt,
    ]),
  );

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="estateos-clients.csv"',
    },
  });
}
