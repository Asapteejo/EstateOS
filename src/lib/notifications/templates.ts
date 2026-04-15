/**
 * Transactional email templates for EstateOS.
 *
 * All templates accept pre-formatted strings (amounts, dates) so this
 * module has no side-effects and no external dependencies.
 *
 * Buyer-facing functions return { subject, html }.
 * Operator-facing functions return (recipientName: string) => string
 * so they slot directly into the `emailHtml` param of notifyManyUsers().
 */

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function shell(companyName: string, body: string): string {
  const co = esc(companyName);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${co}</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f3f4f6;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="background-color:#09090b;padding:22px 32px;">
              <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;color:#ffffff;letter-spacing:0.02em;">${co}</span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background-color:#ffffff;padding:36px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
              ${body}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f9fafb;padding:18px 32px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#9ca3af;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;line-height:1.5;">
                This is an automated message from ${co}. Please do not reply to this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function h1(text: string): string {
  return `<h1 style="margin:0 0 4px;font-size:21px;font-weight:700;color:#09090b;line-height:1.3;">${esc(text)}</h1>`;
}

function p(html: string): string {
  return `<p style="margin:16px 0 0;font-size:15px;color:#374151;line-height:1.65;">${html}</p>`;
}

function badge(text: string, variant: "success" | "warning" | "error" | "neutral"): string {
  const colors: Record<typeof variant, string> = {
    success: "background:#dcfce7;color:#15803d;",
    warning: "background:#fef9c3;color:#a16207;",
    error:   "background:#fee2e2;color:#b91c1c;",
    neutral: "background:#f3f4f6;color:#374151;",
  };
  return `<span style="display:inline-block;padding:4px 10px;border-radius:9999px;font-size:13px;font-weight:600;${colors[variant]}">${esc(text)}</span>`;
}

function detailTable(rows: Array<[string, string]>): string {
  const cells = rows
    .map(
      ([label, value]) => `
      <tr>
        <td style="padding:10px 0;font-size:14px;color:#6b7280;border-bottom:1px solid #f3f4f6;white-space:nowrap;">${esc(label)}</td>
        <td style="padding:10px 0 10px 16px;font-size:14px;color:#09090b;font-weight:500;border-bottom:1px solid #f3f4f6;text-align:right;">${esc(value)}</td>
      </tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:24px;border-top:1px solid #e5e7eb;">${cells}</table>`;
}

function cta(text: string, href: string): string {
  return `<a href="${esc(href)}" style="display:inline-block;margin-top:28px;background-color:#09090b;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-size:14px;font-weight:600;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">${esc(text)}</a>`;
}

function divider(): string {
  return `<hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0 0;">`;
}

function note(text: string): string {
  return `<p style="margin:16px 0 0;font-size:13px;color:#6b7280;line-height:1.5;">${esc(text)}</p>`;
}

// ---------------------------------------------------------------------------
// Buyer-facing templates
// ---------------------------------------------------------------------------

/**
 * Sent to the buyer when a payment is successfully reconciled.
 */
export function renderPaymentConfirmedEmail(data: {
  buyerName: string;
  reference: string;
  amount: string;
  companyName: string;
}): { subject: string; html: string } {
  const subject = "Payment confirmed — receipt issued";
  const body = [
    h1("Payment confirmed"),
    p(`Hi <strong>${esc(data.buyerName)}</strong>, your payment has been received and confirmed.`),
    detailTable([
      ["Reference",  data.reference],
      ["Amount",     data.amount],
      ["Status",     "Confirmed"],
    ]),
    divider(),
    note("Your receipt has been generated and is available in your buyer portal."),
  ].join("");

  return { subject, html: shell(data.companyName, body) };
}

/**
 * Sent to the buyer when an admin reviews their KYC submission.
 */
export function renderKycStatusEmail(data: {
  buyerName: string;
  status: string;
  notes?: string | null;
  companyName: string;
}): { subject: string; html: string } {
  const statusMap: Record<string, { label: string; variant: "success" | "warning" | "error" | "neutral"; subject: string; message: string }> = {
    APPROVED: {
      label:   "Approved",
      variant: "success",
      subject: "Identity verification approved",
      message: "Your identity verification was successful. You can now proceed with your transaction.",
    },
    REJECTED: {
      label:   "Rejected",
      variant: "error",
      subject: "Action required: KYC document rejected",
      message: "Unfortunately, your submitted document was not accepted. Please log in to your portal to review the reason and submit a replacement.",
    },
    RESUBMIT_REQUIRED: {
      label:   "Resubmission required",
      variant: "warning",
      subject: "Action required: KYC resubmission needed",
      message: "Your document requires a correction before we can proceed. Please check the notes below and resubmit.",
    },
  };

  const meta = statusMap[data.status] ?? {
    label:   data.status.toLowerCase().replaceAll("_", " "),
    variant: "neutral" as const,
    subject: "KYC status update",
    message: `Your KYC document status has been updated to ${data.status.toLowerCase().replaceAll("_", " ")}.`,
  };

  const body = [
    h1("KYC status update"),
    p(`Hi <strong>${esc(data.buyerName)}</strong>,`),
    `<p style="margin:16px 0 0;font-size:15px;color:#374151;line-height:1.65;">${esc(meta.message)}</p>`,
    `<p style="margin:16px 0 0;">Status: ${badge(meta.label, meta.variant)}</p>`,
    data.notes
      ? [
          divider(),
          `<p style="margin:16px 0 4px;font-size:13px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Reviewer note</p>`,
          `<p style="margin:0;font-size:14px;color:#374151;line-height:1.6;background:#f9fafb;border-left:3px solid #e5e7eb;padding:12px 16px;border-radius:0 4px 4px 0;">${esc(data.notes)}</p>`,
        ].join("")
      : "",
  ].join("");

  return { subject: meta.subject, html: shell(data.companyName, body) };
}

/**
 * Sent to the prospect/buyer when their inspection request is received.
 */
export function renderInspectionBookedEmail(data: {
  fullName: string;
  propertyTitle: string;
  companyName: string;
}): { subject: string; html: string } {
  const subject = `Inspection request received — ${data.propertyTitle}`;
  const body = [
    h1("Inspection request received"),
    p(`Hi <strong>${esc(data.fullName)}</strong>, we've received your request to inspect <strong>${esc(data.propertyTitle)}</strong>.`),
    p("Our team will review your request and reach out shortly to confirm a date and time."),
    divider(),
    note("If you have any questions in the meantime, please contact the sales team directly."),
  ].join("");

  return { subject, html: shell(data.companyName, body) };
}

/**
 * Sent to the prospect when their inquiry is received.
 */
export function renderInquiryReceivedEmail(data: {
  fullName: string;
  propertyTitle?: string | null;
  companyName: string;
}): { subject: string; html: string } {
  const subject = data.propertyTitle
    ? `Inquiry received — ${data.propertyTitle}`
    : "We received your inquiry";

  const context = data.propertyTitle
    ? ` regarding <strong>${esc(data.propertyTitle)}</strong>`
    : "";

  const body = [
    h1("Inquiry received"),
    p(`Hi <strong>${esc(data.fullName)}</strong>, thank you for your inquiry${context}.`),
    p("A member of our sales team will be in touch with you shortly."),
    divider(),
    note("This is an automated acknowledgement. Our team reviews all inquiries within 24 hours."),
  ].join("");

  return { subject, html: shell(data.companyName, body) };
}

/**
 * Sent to the buyer when a payment is detected as overdue.
 */
export function renderPaymentOverdueEmail(data: {
  buyerName: string;
  reservationRef: string;
  outstandingBalance: string;
  companyName: string;
}): { subject: string; html: string } {
  const subject = "Payment overdue — action required";
  const body = [
    h1("Payment overdue"),
    p(`Hi <strong>${esc(data.buyerName)}</strong>, a payment on your reservation is now overdue.`),
    detailTable([
      ["Reservation",          data.reservationRef],
      ["Outstanding balance",  data.outstandingBalance],
      ["Status",               "Overdue"],
    ]),
    divider(),
    p("Please log in to your buyer portal to make a payment and keep your reservation active."),
    note("If you believe this is an error or need to discuss a payment arrangement, please contact us."),
  ].join("");

  return { subject, html: shell(data.companyName, body) };
}

// ---------------------------------------------------------------------------
// Operator / staff-facing templates
// These return (recipientName: string) => string to match the
// emailHtml signature expected by notifyManyUsers().
// ---------------------------------------------------------------------------

/**
 * Notifies staff that a new inquiry was submitted.
 */
export function renderOperatorInquiryAlert(data: {
  buyerName: string;
  propertyTitle?: string | null;
  companyName: string;
}): (recipientName: string) => string {
  const context = data.propertyTitle ? ` for <strong>${esc(data.propertyTitle)}</strong>` : "";
  return (recipientName: string) =>
    shell(
      data.companyName,
      [
        h1("New inquiry received"),
        p(`Hi <strong>${esc(recipientName)}</strong>,`),
        p(`<strong>${esc(data.buyerName)}</strong> has submitted a new inquiry${context}.`),
        p("Log in to the admin dashboard to review and follow up."),
        cta("View inquiry", "/admin/leads"),
      ].join(""),
    );
}

/**
 * Notifies staff that a new inspection was requested.
 */
export function renderOperatorInspectionAlert(data: {
  buyerName: string;
  propertyTitle: string;
  companyName: string;
}): (recipientName: string) => string {
  return (recipientName: string) =>
    shell(
      data.companyName,
      [
        h1("New inspection request"),
        p(`Hi <strong>${esc(recipientName)}</strong>,`),
        p(`<strong>${esc(data.buyerName)}</strong> has requested a site inspection for <strong>${esc(data.propertyTitle)}</strong>.`),
        p("Log in to confirm a date and assign a team member."),
        cta("View booking", "/admin/bookings"),
      ].join(""),
    );
}

/**
 * Notifies staff that a payment is overdue on a transaction.
 */
export function renderOperatorPaymentOverdueAlert(data: {
  reservationRef: string;
  outstandingBalance: string;
  companyName: string;
}): (recipientName: string) => string {
  return (recipientName: string) =>
    shell(
      data.companyName,
      [
        h1("Payment overdue"),
        p(`Hi <strong>${esc(recipientName)}</strong>,`),
        p(`Reservation <strong>${esc(data.reservationRef)}</strong> has an overdue balance of <strong>${esc(data.outstandingBalance)}</strong>.`),
        p("Review the transaction and follow up with the client."),
        cta("View payments", "/admin/payments"),
      ].join(""),
    );
}

/**
 * Sent to the buyer when their saved property interest is nearing expiry.
 */
export function renderWishlistReminderEmail(data: {
  buyerName: string;
  propertyTitle: string;
  expiryDate: string;
  propertyUrl: string;
  companyName: string;
}): { subject: string; html: string } {
  const subject = `Your saved interest in ${data.propertyTitle} expires soon`;
  const body = [
    h1("Your wishlist item is expiring soon"),
    p(`Hi <strong>${esc(data.buyerName)}</strong>,`),
    p(
      `Your saved interest in <strong>${esc(data.propertyTitle)}</strong> will expire on <strong>${esc(data.expiryDate)}</strong>.`,
    ),
    p("Log in to your buyer portal to continue your purchase journey or renew your interest."),
    cta("View property", data.propertyUrl),
    divider(),
    note(
      "If you no longer wish to pursue this property, no action is needed — your interest will expire automatically.",
    ),
  ].join("");

  return { subject, html: shell(data.companyName, body) };
}

// ---------------------------------------------------------------------------
// Revenue recovery templates
// ---------------------------------------------------------------------------

/**
 * Sent to the buyer at each overdue escalation stage (day 1, 3, 7, 14).
 * Urgency text adapts based on daysOverdue.
 */
export function renderOverdueBuyerEmail(data: {
  buyerName: string;
  reservationRef: string;
  outstandingBalance: string;
  daysOverdue: number;
  portalUrl: string;
  companyName: string;
}): { subject: string; html: string } {
  const urgent = data.daysOverdue >= 7;
  const subject = urgent
    ? `Urgent: Payment overdue ${data.daysOverdue} days — ${data.reservationRef}`
    : `Reminder: Payment overdue — ${data.reservationRef}`;

  const intro = data.daysOverdue === 1
    ? "This is a friendly reminder that a payment on your reservation was due yesterday."
    : data.daysOverdue <= 3
      ? `Your payment is now <strong>${data.daysOverdue} days overdue</strong>. Please act to avoid delays to your transaction.`
      : `Your payment is now <strong>${data.daysOverdue} days overdue</strong>. This requires your immediate attention to protect your reservation.`;

  const body = [
    h1(urgent ? "Urgent: Payment overdue" : "Payment reminder"),
    p(`Hi <strong>${esc(data.buyerName)}</strong>,`),
    p(intro),
    detailTable([
      ["Reservation",          data.reservationRef],
      ["Outstanding balance",  data.outstandingBalance],
      ["Days overdue",         `${data.daysOverdue} day${data.daysOverdue === 1 ? "" : "s"}`],
    ]),
    cta("Make a payment", data.portalUrl),
    divider(),
    note("If you have already made this payment or need assistance, please contact your assigned agent directly."),
  ].join("");

  return { subject, html: shell(data.companyName, body) };
}

/**
 * Sent to the assigned marketer when a deal escalates to the day-7 stage.
 * Includes a WhatsApp deep-link for one-tap outreach.
 */
export function renderMarketerEscalationEmail(data: {
  marketerName: string;
  buyerName: string;
  reservationRef: string;
  outstandingBalance: string;
  daysOverdue: number;
  whatsAppHref: string | null;
  companyName: string;
}): { subject: string; html: string } {
  const subject = `Action required: ${data.buyerName} — ${data.reservationRef} overdue ${data.daysOverdue} days`;
  const body = [
    h1("Deal escalated to you"),
    p(`Hi <strong>${esc(data.marketerName)}</strong>,`),
    p(`The deal below has been automatically escalated to you after <strong>${data.daysOverdue} days</strong> without payment. Please reach out to the client immediately.`),
    detailTable([
      ["Client",               data.buyerName],
      ["Reservation",          data.reservationRef],
      ["Outstanding balance",  data.outstandingBalance],
      ["Days overdue",         `${data.daysOverdue} days`],
    ]),
    data.whatsAppHref
      ? `<a href="${esc(data.whatsAppHref)}" style="display:inline-block;margin-top:28px;background-color:#16a34a;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-size:14px;font-weight:600;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">Message client on WhatsApp</a>`
      : "",
    cta("View deal in dashboard", "/admin/payments"),
    divider(),
    note("This escalation was triggered automatically. Update the deal status once you have spoken with the client."),
  ].join("");

  return { subject, html: shell(data.companyName, body) };
}

/**
 * Sent to company ADMIN users when a deal reaches the day-14 escalation stage.
 */
export function renderOwnerEscalationEmail(data: {
  ownerName: string;
  buyerName: string;
  reservationRef: string;
  outstandingBalance: string;
  daysOverdue: number;
  assignedMarketerName: string | null;
  companyName: string;
}): { subject: string; html: string } {
  const subject = `Revenue at risk: ${data.reservationRef} overdue ${data.daysOverdue} days`;
  const rows: Array<[string, string]> = [
    ["Client",               data.buyerName],
    ["Reservation",          data.reservationRef],
    ["Outstanding balance",  data.outstandingBalance],
    ["Days overdue",         `${data.daysOverdue} days`],
  ];
  if (data.assignedMarketerName) {
    rows.push(["Assigned to", data.assignedMarketerName]);
  }

  const body = [
    h1("Revenue at risk — immediate attention needed"),
    p(`Hi <strong>${esc(data.ownerName)}</strong>,`),
    p(`The following deal has been overdue for <strong>${data.daysOverdue} days</strong> and has not been resolved. Your direct intervention may be required.`),
    detailTable(rows),
    cta("Review deal", "/admin/payments"),
    divider(),
    note("This is an automated alert generated after all earlier escalation attempts were unsuccessful."),
  ].join("");

  return { subject, html: shell(data.companyName, body) };
}

// ---------------------------------------------------------------------------
// Morning briefing template
// ---------------------------------------------------------------------------

interface BriefingOverdueRow  { reservationRef: string; buyerName: string; outstandingBalance: string; daysOverdue: number }
interface BriefingInspection  { fullName: string; propertyTitle: string; scheduledAt: string }
interface BriefingStalledRow  { reservationRef: string; buyerName: string; currentStage: string; daysSinceActivity: number }

function sectionHeading(text: string): string {
  return `<p style="margin:28px 0 8px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">${esc(text)}</p>`;
}

function statGrid(stats: Array<[string, string, string]>): string {
  // Each stat: [value, label, colour class]
  const colours: Record<string, string> = {
    red:    "background:#fee2e2;color:#b91c1c;",
    amber:  "background:#fef9c3;color:#a16207;",
    blue:   "background:#dbeafe;color:#1d4ed8;",
    neutral:"background:#f3f4f6;color:#374151;",
  };
  const cells = stats
    .map(([value, label, colour]) =>
      `<td style="width:25%;padding:0 6px 0 0;">
        <div style="${colours[colour] ?? colours.neutral}border-radius:6px;padding:14px 16px;">
          <div style="font-size:22px;font-weight:700;line-height:1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">${esc(value)}</div>
          <div style="margin-top:4px;font-size:12px;line-height:1.4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">${esc(label)}</div>
        </div>
      </td>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:20px;table-layout:fixed;"><tr>${cells}</tr></table>`;
}

function briefingTable(headers: string[], rows: string[][]): string {
  if (rows.length === 0) {
    return `<p style="margin:8px 0 0;font-size:14px;color:#9ca3af;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-style:italic;">Nothing to show today.</p>`;
  }
  const thead = headers
    .map(
      (h) =>
        `<th style="padding:8px 12px 8px 0;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;text-align:left;border-bottom:1px solid #e5e7eb;white-space:nowrap;">${esc(h)}</th>`,
    )
    .join("");
  const tbody = rows
    .map(
      (cells) =>
        `<tr>${cells
          .map(
            (cell, i) =>
              `<td style="padding:10px 12px 10px 0;font-size:13px;color:${i === 0 ? "#09090b" : "#374151"};border-bottom:1px solid #f3f4f6;vertical-align:top;">${esc(cell)}</td>`,
          )
          .join("")}</tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:8px;"><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>`;
}

/**
 * Daily morning briefing digest sent to company ADMIN users at 08:00 UTC.
 */
export function renderMorningBriefingEmail(data: {
  recipientName: string;
  date: string;
  companyName: string;
  // overdue
  overdueCount: number;
  overdueTotalAtRisk: string;
  overdueRows: BriefingOverdueRow[];
  // inspections
  inspectionCount: number;
  inspectionRows: BriefingInspection[];
  // stalled
  stalledCount: number;
  stalledRows: BriefingStalledRow[];
  // alerts
  hiddenProperties: number;
  pendingKyc: number;
}): { subject: string; html: string } {
  const hasUrgent = data.overdueCount > 0 || data.stalledCount > 0 || data.hiddenProperties > 0;
  const subject = hasUrgent
    ? `Morning briefing — ${data.overdueCount} overdue, ${data.stalledCount} stalled — ${data.date}`
    : `Morning briefing — ${data.date}`;

  const alertRows: string[][] = [];
  if (data.overdueCount > 0) alertRows.push([`${data.overdueCount} overdue payment${data.overdueCount === 1 ? "" : "s"}`, `${data.overdueTotalAtRisk} at risk`]);
  if (data.stalledCount > 0) alertRows.push([`${data.stalledCount} deal${data.stalledCount === 1 ? "" : "s"} stalled 7+ days`, "Needs follow-up"]);
  if (data.hiddenProperties > 0) alertRows.push([`${data.hiddenProperties} hidden or unverified propert${data.hiddenProperties === 1 ? "y" : "ies"}`, "Review listings"]);
  if (data.pendingKyc > 0) alertRows.push([`${data.pendingKyc} KYC submission${data.pendingKyc === 1 ? "" : "s"} pending review`, "Action required"]);

  const body = [
    h1("Daily briefing"),
    p(`Good morning <strong>${esc(data.recipientName)}</strong> — here's your summary for <strong>${esc(data.date)}</strong>.`),

    // Stat cards
    statGrid([
      [String(data.overdueCount),      "Overdue payments",    data.overdueCount > 0 ? "red" : "neutral"],
      [data.overdueTotalAtRisk,         "Total at risk",       data.overdueCount > 0 ? "amber" : "neutral"],
      [String(data.inspectionCount),    "Today's inspections", data.inspectionCount > 0 ? "blue" : "neutral"],
      [String(data.stalledCount),       "Stalled deals",       data.stalledCount > 0 ? "amber" : "neutral"],
    ]),

    // Urgent alerts section
    alertRows.length > 0
      ? [
          sectionHeading("Urgent alerts"),
          briefingTable(["Alert", "Detail"], alertRows),
        ].join("")
      : "",

    // Today's inspections
    sectionHeading("Today's inspections"),
    briefingTable(
      ["Client", "Property", "Time"],
      data.inspectionRows.map((r) => [r.fullName, r.propertyTitle, r.scheduledAt]),
    ),

    // Overdue payments
    sectionHeading("Overdue payments"),
    briefingTable(
      ["Reference", "Buyer", "Outstanding", "Days overdue"],
      data.overdueRows.map((r) => [
        r.reservationRef,
        r.buyerName,
        r.outstandingBalance,
        `${r.daysOverdue}d`,
      ]),
    ),

    // Stalled deals
    sectionHeading("Deals stalled 7+ days"),
    briefingTable(
      ["Reference", "Buyer", "Stage", "Inactive"],
      data.stalledRows.map((r) => [
        r.reservationRef,
        r.buyerName,
        r.currentStage,
        `${r.daysSinceActivity}d`,
      ]),
    ),

    divider(),
    cta("Open admin dashboard", "/admin"),
    note("This briefing is generated automatically each morning. Data reflects the state of your pipeline at 08:00 UTC."),
  ].join("");

  return { subject, html: shell(data.companyName, body) };
}

/**
 * Notifies a staff member that an inquiry or inspection has been assigned to them.
 */
export function renderOperatorAssignmentAlert(data: {
  entityLabel: string;
  companyName: string;
}): (recipientName: string) => string {
  return (recipientName: string) =>
    shell(
      data.companyName,
      [
        h1(`${esc(data.entityLabel)} assigned to you`),
        p(`Hi <strong>${esc(recipientName)}</strong>,`),
        p(`A ${data.entityLabel.toLowerCase()} has been assigned to your queue in the admin dashboard.`),
        cta("View dashboard", "/admin"),
      ].join(""),
    );
}
