CREATE TYPE "TestimonialStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED', 'PUBLISHED', 'UNPUBLISHED', 'DELETED');
CREATE TYPE "TestimonialSource" AS ENUM ('BUYER_PORTAL', 'ADMIN_CREATED');

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TESTIMONIAL_SUBMITTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TESTIMONIAL_REVIEWED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TESTIMONIAL_PUBLISHED';

ALTER TABLE "Testimonial"
ADD COLUMN "buyerUserId" TEXT,
ADD COLUMN "propertyId" TEXT,
ADD COLUMN "reservationId" TEXT,
ADD COLUMN "transactionId" TEXT,
ADD COLUMN "displayName" TEXT,
ADD COLUMN "title" TEXT,
ADD COLUMN "rating" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN "status" "TestimonialStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
ADD COLUMN "source" "TestimonialSource" NOT NULL DEFAULT 'ADMIN_CREATED',
ADD COLUMN "rejectionReason" TEXT,
ADD COLUMN "adminNote" TEXT,
ADD COLUMN "isVerifiedBuyer" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "reviewedAt" TIMESTAMP(3),
ADD COLUMN "reviewedByUserId" TEXT,
ADD COLUMN "publishedAt" TIMESTAMP(3),
ADD COLUMN "unpublishedAt" TIMESTAMP(3),
ADD COLUMN "deletedAt" TIMESTAMP(3);

UPDATE "Testimonial"
SET
  "displayName" = "fullName",
  "status" = CASE WHEN "isPublished" THEN 'PUBLISHED'::"TestimonialStatus" ELSE 'UNPUBLISHED'::"TestimonialStatus" END,
  "publishedAt" = CASE WHEN "isPublished" THEN "createdAt" ELSE NULL END
WHERE "displayName" IS NULL;

ALTER TABLE "Testimonial" ALTER COLUMN "displayName" SET NOT NULL;

ALTER TABLE "Testimonial"
ADD CONSTRAINT "Testimonial_buyerUserId_fkey" FOREIGN KEY ("buyerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
ADD CONSTRAINT "Testimonial_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE,
ADD CONSTRAINT "Testimonial_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE,
ADD CONSTRAINT "Testimonial_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE,
ADD CONSTRAINT "Testimonial_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Testimonial_companyId_status_publishedAt_idx" ON "Testimonial"("companyId", "status", "publishedAt");
CREATE INDEX "Testimonial_companyId_buyerUserId_createdAt_idx" ON "Testimonial"("companyId", "buyerUserId", "createdAt");
CREATE INDEX "Testimonial_companyId_propertyId_status_idx" ON "Testimonial"("companyId", "propertyId", "status");
CREATE INDEX "Testimonial_companyId_deletedAt_idx" ON "Testimonial"("companyId", "deletedAt");
