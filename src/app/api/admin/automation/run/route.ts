import { requireAdminSession } from "@/lib/auth/guards";
import { ok } from "@/lib/http";
import { runScheduledOperationalJobs } from "@/modules/automation/service";
import {
  adminMutationRateLimit,
  enforceRateLimit,
  getClientIp,
} from "@/lib/rate-limit";

export async function POST(request: Request) {
  const tenant = await requireAdminSession(["ADMIN"]);

  const rateLimited = await enforceRateLimit(
    adminMutationRateLimit,
    [`ip:${getClientIp(request)}`, `user:${tenant.userId ?? "admin"}`],
    "Too many requests. Please slow down and try again.",
  );
  if (rateLimited) return rateLimited;

  const result = await runScheduledOperationalJobs({
    companyId: tenant.companyId ?? undefined,
    source: "manual",
  });
  return ok(result);
}
