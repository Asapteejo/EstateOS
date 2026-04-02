import { env } from "@/lib/env";
import { fail, ok } from "@/lib/http";
import { runScheduledOperationalJobs } from "@/modules/automation/service";

export async function POST(request: Request) {
  const header = request.headers.get("x-cron-secret");
  if (!env.CRON_SECRET || header !== env.CRON_SECRET) {
    return fail("Unauthorized.", 401);
  }

  const json = (await request.json().catch(() => ({}))) as {
    companyId?: string;
    eventKey?: string;
  };

  const result = await runScheduledOperationalJobs({
    companyId: json.companyId,
    eventKey: json.eventKey ?? `cron-${new Date().toISOString().slice(0, 16)}`,
    source: "cron",
  });

  return ok(result);
}
