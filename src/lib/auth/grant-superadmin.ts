import { isSuperadminEmailAllowlisted } from "@/lib/auth/superadmin";

export function parseGrantSuperadminEmail(args: string[]) {
  const emailFlagIndex = args.indexOf("--email");
  const value =
    emailFlagIndex >= 0
      ? args[emailFlagIndex + 1]
      : args.find((arg) => arg.startsWith("--email="))?.slice("--email=".length);
  const email = value?.trim().toLowerCase();

  if (!email || !email.includes("@")) {
    throw new Error("Usage: npm run grant:superadmin -- --email owner@example.com");
  }

  return email;
}

export function assertAllowlistedSuperadminEmail(
  email: string,
  allowlist: string | undefined | null,
) {
  if (!isSuperadminEmailAllowlisted(email, allowlist)) {
    throw new Error(
      "Refusing to grant SUPER_ADMIN: the requested email is not present in SUPERADMIN_EMAILS.",
    );
  }
}

export function maskEmail(email: string) {
  const [localPart, domain] = email.split("@");
  if (!localPart || !domain) {
    return "[invalid-email]";
  }

  return `${localPart.slice(0, 1)}***@${domain}`;
}
