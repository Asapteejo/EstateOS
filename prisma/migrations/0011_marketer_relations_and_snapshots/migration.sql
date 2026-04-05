ALTER TABLE "StaffProfile"
ADD COLUMN "teamMemberId" TEXT;

CREATE UNIQUE INDEX "StaffProfile_teamMemberId_key" ON "StaffProfile"("teamMemberId");
CREATE INDEX "StaffProfile_teamMemberId_idx" ON "StaffProfile"("teamMemberId");

ALTER TABLE "StaffProfile"
ADD CONSTRAINT "StaffProfile_teamMemberId_fkey"
FOREIGN KEY ("teamMemberId") REFERENCES "TeamMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "MarketerRankingSnapshot" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "teamMemberId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "rank" INTEGER NOT NULL,
    "starRating" DECIMAL(3,1) NOT NULL,
    "snapshotDate" TIMESTAMP(3) NOT NULL,
    "wishlistAdds" INTEGER NOT NULL DEFAULT 0,
    "qualifiedInquiries" INTEGER NOT NULL DEFAULT 0,
    "inspectionsHandled" INTEGER NOT NULL DEFAULT 0,
    "reservations" INTEGER NOT NULL DEFAULT 0,
    "successfulPayments" INTEGER NOT NULL DEFAULT 0,
    "completedDeals" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketerRankingSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MarketerRankingSnapshot_companyId_teamMemberId_snapshotDate_key"
ON "MarketerRankingSnapshot"("companyId", "teamMemberId", "snapshotDate");

CREATE INDEX "MarketerRankingSnapshot_companyId_snapshotDate_rank_idx"
ON "MarketerRankingSnapshot"("companyId", "snapshotDate", "rank");

CREATE INDEX "MarketerRankingSnapshot_teamMemberId_snapshotDate_idx"
ON "MarketerRankingSnapshot"("teamMemberId", "snapshotDate");

ALTER TABLE "MarketerRankingSnapshot"
ADD CONSTRAINT "MarketerRankingSnapshot_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MarketerRankingSnapshot"
ADD CONSTRAINT "MarketerRankingSnapshot_teamMemberId_fkey"
FOREIGN KEY ("teamMemberId") REFERENCES "TeamMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

WITH email_matches AS (
    SELECT
        sp."id" AS "staffProfileId",
        tm."id" AS "teamMemberId",
        COUNT(*) OVER (PARTITION BY sp."id") AS "matchCount",
        ROW_NUMBER() OVER (PARTITION BY sp."id" ORDER BY tm."createdAt" ASC) AS "matchRank"
    FROM "StaffProfile" sp
    INNER JOIN "User" u
        ON u."id" = sp."userId"
    INNER JOIN "TeamMember" tm
        ON tm."companyId" = u."companyId"
    WHERE sp."teamMemberId" IS NULL
      AND tm."email" IS NOT NULL
      AND LOWER(BTRIM(tm."email")) = LOWER(BTRIM(u."email"))
)
UPDATE "StaffProfile" sp
SET "teamMemberId" = em."teamMemberId"
FROM email_matches em
WHERE sp."id" = em."staffProfileId"
  AND em."matchCount" = 1
  AND em."matchRank" = 1;

WITH staff_code_matches AS (
    SELECT
        sp."id" AS "staffProfileId",
        tm."id" AS "teamMemberId",
        COUNT(*) OVER (PARTITION BY sp."id") AS "matchCount",
        ROW_NUMBER() OVER (PARTITION BY sp."id" ORDER BY tm."createdAt" ASC) AS "matchRank"
    FROM "StaffProfile" sp
    INNER JOIN "User" u
        ON u."id" = sp."userId"
    INNER JOIN "TeamMember" tm
        ON tm."companyId" = u."companyId"
    WHERE sp."teamMemberId" IS NULL
      AND sp."staffCode" IS NOT NULL
      AND tm."staffCode" IS NOT NULL
      AND LOWER(BTRIM(sp."staffCode")) = LOWER(BTRIM(tm."staffCode"))
)
UPDATE "StaffProfile" sp
SET "teamMemberId" = sm."teamMemberId"
FROM staff_code_matches sm
WHERE sp."id" = sm."staffProfileId"
  AND sm."matchCount" = 1
  AND sm."matchRank" = 1;
