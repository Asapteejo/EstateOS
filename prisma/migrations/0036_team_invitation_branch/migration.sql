-- Add optional branch locking for tenant team invitations.
ALTER TABLE "TeamMemberInvitation" ADD COLUMN "branchId" TEXT;

ALTER TABLE "TeamMemberInvitation"
  ADD CONSTRAINT "TeamMemberInvitation_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "TeamMemberInvitation_branchId_idx" ON "TeamMemberInvitation"("branchId");
