-- CreateEnum
CREATE TYPE "VisitorStatus" AS ENUM ('CHECKED_IN', 'CHECKED_OUT');

-- CreateEnum
CREATE TYPE "CallDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateTable
CREATE TABLE "Visitor" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "purpose" TEXT,
    "hostName" TEXT,
    "status" "VisitorStatus" NOT NULL DEFAULT 'CHECKED_IN',
    "checkedInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkedOutAt" TIMESTAMP(3),
    "loggedById" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Visitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "callerName" TEXT NOT NULL,
    "phone" TEXT,
    "direction" "CallDirection" NOT NULL DEFAULT 'INBOUND',
    "purpose" TEXT,
    "outcome" TEXT,
    "loggedById" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Visitor_companyId_checkedInAt_idx" ON "Visitor"("companyId", "checkedInAt");

-- CreateIndex
CREATE INDEX "Visitor_companyId_status_idx" ON "Visitor"("companyId", "status");

-- CreateIndex
CREATE INDEX "CallLog_companyId_createdAt_idx" ON "CallLog"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "CallLog_companyId_direction_createdAt_idx" ON "CallLog"("companyId", "direction", "createdAt");
