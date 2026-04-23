ALTER TABLE "ObservedIncident"
ADD COLUMN "recentWindowOccurrenceCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "recentWindowCompanyCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "recentWindowCalculatedAt" TIMESTAMP(3),
ADD COLUMN "lastLinearSyncSummaryHash" TEXT,
ADD COLUMN "lastLinearSeveritySynced" TEXT,
ADD COLUMN "lastLinearAffectedCompanyCountSynced" INTEGER,
ADD COLUMN "lastLinearUpdateAt" TIMESTAMP(3);
