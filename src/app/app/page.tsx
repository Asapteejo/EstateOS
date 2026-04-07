import { redirect } from "next/navigation";

import { getAppSession } from "@/lib/auth/session";
import { resolveAppLandingPath } from "@/modules/onboarding/navigation";

export default async function AppEntryPage() {
  const session = await getAppSession("admin");
  redirect(resolveAppLandingPath(session));
}
