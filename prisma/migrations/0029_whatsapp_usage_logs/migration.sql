-- Phase 1 WhatsApp observability: tenant-scoped Twilio usage attempts.
CREATE TYPE "CommunicationChannel" AS ENUM ('WHATSAPP');

CREATE TYPE "CommunicationUsageStatus" AS ENUM ('SENT', 'FAILED', 'SKIPPED');

CREATE TABLE "CommunicationUsageLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "channel" "CommunicationChannel" NOT NULL DEFAULT 'WHATSAPP',
    "trigger" TEXT NOT NULL,
    "recipientPhone" TEXT,
    "status" "CommunicationUsageStatus" NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'TWILIO',
    "providerSid" TEXT,
    "error" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunicationUsageLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CommunicationUsageLog_companyId_channel_createdAt_idx" ON "CommunicationUsageLog"("companyId", "channel", "createdAt");
CREATE INDEX "CommunicationUsageLog_companyId_trigger_createdAt_idx" ON "CommunicationUsageLog"("companyId", "trigger", "createdAt");
CREATE INDEX "CommunicationUsageLog_provider_providerSid_idx" ON "CommunicationUsageLog"("provider", "providerSid");

ALTER TABLE "CommunicationUsageLog" ADD CONSTRAINT "CommunicationUsageLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
