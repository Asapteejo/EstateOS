-- Align production invitation ownership metadata with the Prisma schema.
ALTER TABLE "TeamMemberInvitation" ADD COLUMN "invitedByUserId" TEXT;

UPDATE "TeamMemberInvitation"
SET "invitedByUserId" = "invitedById"
WHERE "invitedByUserId" IS NULL
  AND "invitedById" IS NOT NULL;

CREATE INDEX "TeamMemberInvitation_email_status_idx" ON "TeamMemberInvitation"("email", "status");
