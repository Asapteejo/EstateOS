CREATE TYPE "DealPaymentStatus" AS ENUM ('PENDING', 'PARTIAL', 'COMPLETED', 'OVERDUE');

ALTER TABLE "InspectionBooking"
ADD COLUMN "reminderSentAt" TIMESTAMP(3);

ALTER TABLE "Transaction"
ADD COLUMN "paymentStatus" "DealPaymentStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "nextPaymentDueAt" TIMESTAMP(3),
ADD COLUMN "lastPaymentAt" TIMESTAMP(3),
ADD COLUMN "lastPaymentReminderAt" TIMESTAMP(3);

UPDATE "Transaction"
SET "paymentStatus" = CASE
  WHEN COALESCE("outstandingBalance", 0) <= 0 THEN 'COMPLETED'::"DealPaymentStatus"
  WHEN COALESCE("outstandingBalance", 0) < COALESCE("totalValue", 0) THEN 'PARTIAL'::"DealPaymentStatus"
  ELSE 'PENDING'::"DealPaymentStatus"
END;

CREATE INDEX "Transaction_companyId_paymentStatus_nextPaymentDueAt_idx"
ON "Transaction"("companyId", "paymentStatus", "nextPaymentDueAt");
