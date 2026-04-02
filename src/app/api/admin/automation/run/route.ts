import { requireAdminSession } from "@/lib/auth/guards";
import { ok } from "@/lib/http";
import { runScheduledOperationalJobs } from "@/modules/automation/service";

export async function POST() {
  const tenant = await requireAdminSession(["ADMIN"]);
  const result = await runScheduledOperationalJobs({
    companyId: tenant.companyId ?? undefined,
    source: "manual",
  });
  return ok(result);
}
