CREATE TYPE "WishlistStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REMOVED');

CREATE TYPE "FollowUpStatus" AS ENUM ('NONE', 'PENDING_CALL', 'CONTACTED', 'FOLLOW_UP_SCHEDULED', 'CLOSED');

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'WISHLIST_ADDED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'WISHLIST_EXPIRING';

ALTER TABLE "Property"
ADD COLUMN "wishlistDurationDays" INTEGER,
ADD COLUMN "wishlistReminderEnabled" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "SavedProperty"
ADD COLUMN "propertyUnitId" TEXT,
ADD COLUMN "selectedMarketerId" TEXT,
ADD COLUMN "assignedStaffId" TEXT,
ADD COLUMN "status" "WishlistStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN "expiresAt" TIMESTAMP(3),
ADD COLUMN "reminderSentAt" TIMESTAMP(3),
ADD COLUMN "followUpStatus" "FollowUpStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN "followUpNote" TEXT,
ADD COLUMN "removedAt" TIMESTAMP(3),
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "SavedProperty_companyId_propertyId_status_idx" ON "SavedProperty"("companyId", "propertyId", "status");
CREATE INDEX "SavedProperty_companyId_userId_status_idx" ON "SavedProperty"("companyId", "userId", "status");
CREATE INDEX "SavedProperty_companyId_expiresAt_status_idx" ON "SavedProperty"("companyId", "expiresAt", "status");
CREATE INDEX "SavedProperty_companyId_assignedStaffId_followUpStatus_idx" ON "SavedProperty"("companyId", "assignedStaffId", "followUpStatus");

ALTER TABLE "SavedProperty"
ADD CONSTRAINT "SavedProperty_propertyUnitId_fkey" FOREIGN KEY ("propertyUnitId") REFERENCES "PropertyUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SavedProperty"
ADD CONSTRAINT "SavedProperty_selectedMarketerId_fkey" FOREIGN KEY ("selectedMarketerId") REFERENCES "TeamMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SavedProperty"
ADD CONSTRAINT "SavedProperty_assignedStaffId_fkey" FOREIGN KEY ("assignedStaffId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
