-- CreateEnum
CREATE TYPE "MessageSenderRole" AS ENUM ('BUYER', 'TEAM');

-- CreateTable
CREATE TABLE "MessageThread" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "buyerUserId" TEXT NOT NULL,
    "buyerName" TEXT,
    "subject" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastMessagePreview" TEXT,
    "lastMessageSenderRole" "MessageSenderRole",
    "buyerLastReadAt" TIMESTAMP(3),
    "teamLastReadAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "senderUserId" TEXT,
    "senderRole" "MessageSenderRole" NOT NULL,
    "senderName" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MessageThread_companyId_buyerUserId_lastMessageAt_idx" ON "MessageThread"("companyId", "buyerUserId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "MessageThread_companyId_lastMessageAt_idx" ON "MessageThread"("companyId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "Message_threadId_createdAt_idx" ON "Message"("threadId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_companyId_createdAt_idx" ON "Message"("companyId", "createdAt");

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "MessageThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
