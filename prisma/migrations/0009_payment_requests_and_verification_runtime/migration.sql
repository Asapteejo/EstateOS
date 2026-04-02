ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'AWAITING_INITIATION';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';

DO $$ BEGIN
  CREATE TYPE "PaymentRequestStatus" AS ENUM ('DRAFT', 'SENT', 'AWAITING_PAYMENT', 'PAID', 'EXPIRED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "PaymentRequestChannel" AS ENUM ('IN_APP', 'EMAIL', 'SHARE_LINK');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "PaymentRequestCollectionMethod" AS ENUM (
    'HOSTED_CHECKOUT',
    'BANK_TRANSFER_TEMP_ACCOUNT',
    'DEDICATED_VIRTUAL_ACCOUNT',
    'MANUAL_BANK_TRANSFER_REFERENCE',
    'CARD_LINK'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PAYMENT_REQUEST_SENT';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PAYMENT_REQUEST_PAID';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PAYMENT_REQUEST_EXPIRED';

ALTER TABLE "SiteSettings"
  ADD COLUMN IF NOT EXISTS "verificationFreshDays" INTEGER,
  ADD COLUMN IF NOT EXISTS "verificationStaleDays" INTEGER,
  ADD COLUMN IF NOT EXISTS "verificationHideDays" INTEGER,
  ADD COLUMN IF NOT EXISTS "verificationWarningReminderDays" INTEGER;

CREATE TABLE IF NOT EXISTS "PaymentRequest" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "reservationId" TEXT,
  "transactionId" TEXT,
  "installmentId" TEXT,
  "provider" "PaymentProviderCode" NOT NULL DEFAULT 'PAYSTACK',
  "channel" "PaymentRequestChannel" NOT NULL DEFAULT 'IN_APP',
  "collectionMethod" "PaymentRequestCollectionMethod" NOT NULL DEFAULT 'HOSTED_CHECKOUT',
  "status" "PaymentRequestStatus" NOT NULL DEFAULT 'DRAFT',
  "title" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'NGN',
  "dueAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "notes" TEXT,
  "providerReference" TEXT,
  "checkoutUrl" TEXT,
  "transferBankName" TEXT,
  "transferAccountNumber" TEXT,
  "transferAccountName" TEXT,
  "providerPayload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentRequest_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Payment"
  ADD COLUMN IF NOT EXISTS "paymentRequestId" TEXT;

CREATE INDEX IF NOT EXISTS "PaymentRequest_companyId_status_dueAt_idx"
  ON "PaymentRequest"("companyId", "status", "dueAt");
CREATE INDEX IF NOT EXISTS "PaymentRequest_companyId_userId_status_idx"
  ON "PaymentRequest"("companyId", "userId", "status");
CREATE INDEX IF NOT EXISTS "PaymentRequest_companyId_transactionId_idx"
  ON "PaymentRequest"("companyId", "transactionId");
CREATE UNIQUE INDEX IF NOT EXISTS "PaymentRequest_companyId_providerReference_key"
  ON "PaymentRequest"("companyId", "providerReference");
CREATE INDEX IF NOT EXISTS "Payment_companyId_paymentRequestId_idx"
  ON "Payment"("companyId", "paymentRequestId");

DO $$ BEGIN
  ALTER TABLE "PaymentRequest"
    ADD CONSTRAINT "PaymentRequest_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "PaymentRequest"
    ADD CONSTRAINT "PaymentRequest_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "PaymentRequest"
    ADD CONSTRAINT "PaymentRequest_reservationId_fkey"
    FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "PaymentRequest"
    ADD CONSTRAINT "PaymentRequest_transactionId_fkey"
    FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "PaymentRequest"
    ADD CONSTRAINT "PaymentRequest_installmentId_fkey"
    FOREIGN KEY ("installmentId") REFERENCES "Installment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Payment"
    ADD CONSTRAINT "Payment_paymentRequestId_fkey"
    FOREIGN KEY ("paymentRequestId") REFERENCES "PaymentRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
