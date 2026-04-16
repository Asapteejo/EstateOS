import type { AppRole } from "@prisma/client";

const ROLE_LABELS: Record<AppRole, string> = {
  BUYER: "Buyer",
  STAFF: "Staff",
  ADMIN: "Admin",
  LEGAL: "Legal",
  FINANCE: "Finance",
  SUPER_ADMIN: "Super Admin",
};

export function buildTeamInvitationEmail(input: {
  inviteeName: string;
  companyName: string;
  inviterName: string;
  role: AppRole;
  acceptUrl: string;
  expiresAt: Date;
}) {
  const roleLabel = ROLE_LABELS[input.role] ?? input.role;
  const expiryText = input.expiresAt.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const subject = `You're invited to join ${input.companyName} on EstateOS`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f0;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="background:#1a1a18;border-radius:16px 16px 0 0;padding:32px 40px;">
              <p style="margin:0;font-size:13px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#a89f8c;">EstateOS</p>
              <h1 style="margin:12px 0 0;font-size:22px;font-weight:600;color:#faf9f7;line-height:1.3;">
                You've been invited to join ${input.companyName}
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:36px 40px;">
              <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#3a3830;">
                Hi ${input.inviteeName},
              </p>
              <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#3a3830;">
                <strong>${input.inviterName}</strong> has invited you to join
                <strong>${input.companyName}</strong> on EstateOS as a
                <strong>${roleLabel}</strong>.
              </p>
              <p style="margin:0 0 28px;font-size:15px;line-height:1.6;color:#3a3830;">
                Click the button below to accept your invitation and set up your account.
              </p>

              <!-- CTA -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="background:#1a1a18;border-radius:10px;">
                    <a href="${input.acceptUrl}"
                       style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#faf9f7;text-decoration:none;letter-spacing:0.01em;">
                      Accept invitation
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Details -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f7f3;border-radius:10px;margin-bottom:24px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:5px 0;font-size:13px;color:#6b6558;width:40%;">Company</td>
                        <td style="padding:5px 0;font-size:13px;font-weight:600;color:#1a1a18;">${input.companyName}</td>
                      </tr>
                      <tr>
                        <td style="padding:5px 0;font-size:13px;color:#6b6558;">Role</td>
                        <td style="padding:5px 0;font-size:13px;font-weight:600;color:#1a1a18;">${roleLabel}</td>
                      </tr>
                      <tr>
                        <td style="padding:5px 0;font-size:13px;color:#6b6558;">Invited by</td>
                        <td style="padding:5px 0;font-size:13px;font-weight:600;color:#1a1a18;">${input.inviterName}</td>
                      </tr>
                      <tr>
                        <td style="padding:5px 0;font-size:13px;color:#6b6558;">Expires</td>
                        <td style="padding:5px 0;font-size:13px;font-weight:600;color:#1a1a18;">${expiryText}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:13px;line-height:1.6;color:#9b9488;">
                Or copy this link into your browser:<br />
                <a href="${input.acceptUrl}" style="color:#6b6558;word-break:break-all;">${input.acceptUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f0ede6;border-radius:0 0 16px 16px;padding:20px 40px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9b9488;">
                If you didn't expect this invitation, you can safely ignore this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html };
}
