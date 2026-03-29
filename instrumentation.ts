import { initializeSentry } from "@/lib/sentry";

export async function register() {
  initializeSentry();
}
