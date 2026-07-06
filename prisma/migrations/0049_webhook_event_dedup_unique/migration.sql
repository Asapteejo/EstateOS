-- Webhook idempotency hardening.
--
-- Before creating the unique index, remove any historical duplicate rows
-- (keep the OLDEST row per (companyId, provider, providerEventId) group —
-- the one whose side effects actually ran first). Rows with NULL
-- providerEventId are untouched: Postgres unique indexes permit multiple
-- NULLs, and legacy rows may legitimately lack an event id.
DELETE FROM "WebhookEvent" w
USING "WebhookEvent" keeper
WHERE w."providerEventId" IS NOT NULL
  AND keeper."providerEventId" IS NOT NULL
  AND w."companyId" IS NOT DISTINCT FROM keeper."companyId"
  AND w."provider" = keeper."provider"
  AND w."providerEventId" = keeper."providerEventId"
  AND keeper."createdAt" < w."createdAt";

-- Hard idempotency guarantee: the same provider event can only be recorded
-- once per tenant. Reconciliation inserts this row inside the same DB
-- transaction as the balance/receipt mutations, so a concurrent duplicate
-- delivery aborts atomically with a unique violation.
CREATE UNIQUE INDEX "WebhookEvent_companyId_provider_providerEventId_key"
  ON "WebhookEvent"("companyId", "provider", "providerEventId");
