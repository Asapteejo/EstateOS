-- Restore the base tenant team invitation table before branch/version migrations.
DO $$
BEGIN
  CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "TeamMemberInvitation" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "role" "AppRole" NOT NULL DEFAULT 'STAFF',
  "token" TEXT NOT NULL,
  "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
  "invitedById" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TeamMemberInvitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TeamMemberInvitation_token_key"
ON "TeamMemberInvitation"("token");

CREATE INDEX IF NOT EXISTS "TeamMemberInvitation_companyId_status_idx"
ON "TeamMemberInvitation"("companyId", "status");

DO $$
BEGIN
  ALTER TABLE "TeamMemberInvitation"
    ADD CONSTRAINT "TeamMemberInvitation_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
