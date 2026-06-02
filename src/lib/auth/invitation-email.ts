export type ClerkEmailAddress = {
  emailAddress: string;
  verification?: {
    status?: string | null;
  } | null;
};

export function normalizeInvitationEmail(email: string) {
  return email.trim().toLowerCase();
}

export function hasMatchingVerifiedInvitationEmail(
  invitationEmail: string,
  emailAddresses: ClerkEmailAddress[],
) {
  const expected = normalizeInvitationEmail(invitationEmail);
  return emailAddresses.some(
    (address) =>
      address.verification?.status === "verified" &&
      normalizeInvitationEmail(address.emailAddress) === expected,
  );
}

export function getInvitationAcceptanceFailure(input: {
  role: string;
  status: string;
  expiresAt: Date;
  now?: Date;
}) {
  if (input.role === "SUPER_ADMIN") {
    return { message: "This invitation is not valid.", status: 403 };
  }
  if (input.status !== "PENDING") {
    return {
      message:
        input.status === "ACCEPTED"
          ? "This invitation has already been accepted."
          : "This invitation is no longer valid.",
      status: 409,
    };
  }
  if (input.expiresAt < (input.now ?? new Date())) {
    return { message: "This invitation has expired.", status: 410 };
  }
  return null;
}
