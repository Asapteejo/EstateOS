CREATE TYPE "PaymentPlanKind" AS ENUM ('ONE_TIME', 'FIXED', 'CUSTOM');

ALTER TABLE "Reservation"
ADD COLUMN "marketerId" TEXT,
ADD COLUMN "paymentPlanId" TEXT;

ALTER TABLE "Transaction"
ADD COLUMN "marketerId" TEXT,
ADD COLUMN "paymentPlanId" TEXT;

ALTER TABLE "PaymentPlan"
ADD COLUMN "propertyUnitId" TEXT,
ADD COLUMN "kind" "PaymentPlanKind" NOT NULL DEFAULT 'FIXED',
ADD COLUMN "scheduleDescription" TEXT,
ADD COLUMN "installmentCount" INTEGER,
ADD COLUMN "downPaymentAmount" DECIMAL(12,2);

ALTER TABLE "Installment"
ADD COLUMN "scheduleLabel" TEXT;

ALTER TABLE "Payment"
ADD COLUMN "marketerId" TEXT;

ALTER TABLE "Receipt"
ADD COLUMN "renderData" JSONB;

ALTER TABLE "TeamMember"
ADD COLUMN "whatsappNumber" TEXT,
ADD COLUMN "resumeDocumentId" TEXT,
ADD COLUMN "profileHighlights" JSONB,
ADD COLUMN "portfolioText" TEXT,
ADD COLUMN "portfolioLinks" JSONB,
ADD COLUMN "specialties" JSONB,
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "Reservation_companyId_marketerId_idx" ON "Reservation"("companyId", "marketerId");
CREATE INDEX "Transaction_companyId_marketerId_idx" ON "Transaction"("companyId", "marketerId");
CREATE INDEX "PaymentPlan_companyId_propertyUnitId_isActive_idx" ON "PaymentPlan"("companyId", "propertyUnitId", "isActive");
CREATE INDEX "Payment_companyId_marketerId_idx" ON "Payment"("companyId", "marketerId");
CREATE INDEX "TeamMember_companyId_isPublished_isActive_sortOrder_idx" ON "TeamMember"("companyId", "isPublished", "isActive", "sortOrder");

ALTER TABLE "Reservation"
ADD CONSTRAINT "Reservation_marketerId_fkey" FOREIGN KEY ("marketerId") REFERENCES "TeamMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Reservation"
ADD CONSTRAINT "Reservation_paymentPlanId_fkey" FOREIGN KEY ("paymentPlanId") REFERENCES "PaymentPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Transaction"
ADD CONSTRAINT "Transaction_marketerId_fkey" FOREIGN KEY ("marketerId") REFERENCES "TeamMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Transaction"
ADD CONSTRAINT "Transaction_paymentPlanId_fkey" FOREIGN KEY ("paymentPlanId") REFERENCES "PaymentPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PaymentPlan"
ADD CONSTRAINT "PaymentPlan_propertyUnitId_fkey" FOREIGN KEY ("propertyUnitId") REFERENCES "PropertyUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Payment"
ADD CONSTRAINT "Payment_marketerId_fkey" FOREIGN KEY ("marketerId") REFERENCES "TeamMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;
