import assert from "node:assert/strict";
import test from "node:test";

import { buildTenantSupportNotification } from "@/modules/support/service";

test("buyer support notification is tenant-admin oriented, not superadmin escalation", () => {
  const notification = buildTenantSupportNotification({
    companyName: "Blueprint Urban Residences",
    requestId: "support_1",
    category: "question",
    subject: "Need help with my allocation",
    message: "Please help me confirm the next step.",
    reporterName: "Ada Buyer",
    reporterEmail: "buyer@example.com",
    pageUrl: "/portal/documents",
  });

  assert.equal(notification.type, "SYSTEM");
  assert.equal(notification.title, "Buyer support request");
  assert.match(notification.body, /Ada Buyer/);
  assert.match(notification.emailHtml("Admin User"), /Blueprint Urban Residences/);
  assert.doesNotMatch(notification.emailHtml("Admin User"), /superadmin/i);
  assert.doesNotMatch(notification.emailHtml("Admin User"), /Linear/i);
});
