-- Commit the TeamMember (companyId, staffCode) uniqueness that already exists in
-- schema.prisma but was never captured in a migration (the drift `prisma migrate
-- dev` kept warning about). staffCode is nullable, so NULL staff codes do not
-- collide. Idempotent via IF NOT EXISTS; the index name matches Prisma's default
-- so future `migrate dev` runs see no drift.
CREATE UNIQUE INDEX IF NOT EXISTS "TeamMember_companyId_staffCode_key"
ON "TeamMember"("companyId", "staffCode");
