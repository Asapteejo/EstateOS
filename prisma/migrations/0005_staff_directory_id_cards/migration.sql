ALTER TABLE "TeamMember"
ADD COLUMN "staffCode" TEXT,
ADD COLUMN "officeLocation" TEXT,
ADD COLUMN "socialLinks" JSONB;

CREATE UNIQUE INDEX "TeamMember_companyId_staffCode_key"
ON "TeamMember"("companyId", "staffCode")
WHERE "staffCode" IS NOT NULL;
