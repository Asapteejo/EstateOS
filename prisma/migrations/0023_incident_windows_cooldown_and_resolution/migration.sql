ALTER TYPE "IncidentEscalationStatus" ADD VALUE IF NOT EXISTS 'RESOLVED';
ALTER TYPE "IncidentEscalationStatus" ADD VALUE IF NOT EXISTS 'REOPENED';

ALTER TABLE "ObservedIncident"
ADD COLUMN "nextEligibleEscalationAt" TIMESTAMP(3);

CREATE TABLE "ObservedIncidentOccurrence" (
  "id" TEXT NOT NULL,
  "incidentId" TEXT NOT NULL,
  "companyId" TEXT,
  "seenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ObservedIncidentOccurrence_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ObservedIncidentOccurrence_incidentId_seenAt_idx"
ON "ObservedIncidentOccurrence"("incidentId", "seenAt");

CREATE INDEX "ObservedIncidentOccurrence_companyId_seenAt_idx"
ON "ObservedIncidentOccurrence"("companyId", "seenAt");

ALTER TABLE "ObservedIncidentOccurrence"
ADD CONSTRAINT "ObservedIncidentOccurrence_incidentId_fkey"
FOREIGN KEY ("incidentId") REFERENCES "ObservedIncident"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ObservedIncidentOccurrence"
ADD CONSTRAINT "ObservedIncidentOccurrence_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
