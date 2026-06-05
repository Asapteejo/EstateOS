import { requireAdminSession } from "@/lib/auth/guards";
import { buildCsv } from "@/lib/exports/csv";
import { getAdminClientList } from "@/modules/clients/queries";
import {
  adminMutationRateLimit,
  enforceRateLimit,
  getClientIp,
} from "@/lib/rate-limit";

export async function GET(request: Request) {
  const tenant = await requireAdminSession(["ADMIN"]);

  const rateLimited = await enforceRateLimit(
    adminMutationRateLimit,
    [`ip:${getClientIp(request)}`, `user:${tenant.userId ?? "admin"}`],
    "Too many requests. Please slow down and try again.",
  );
  if (rateLimited) return rateLimited;

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
