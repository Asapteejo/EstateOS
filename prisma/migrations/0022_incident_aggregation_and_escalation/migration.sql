CREATE TYPE "IncidentEscalationStatus" AS ENUM (
  'PENDING',
  'ESCALATED',
  'SUPPRESSED',
  'IGNORED'
);

CREATE TABLE "ObservedIncident" (
  "id" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "fingerprintType" TEXT NOT NULL,
  "eventGroup" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "environment" TEXT NOT NULL,
  "eventVersion" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "firstSeenAt" TIMESTAMP(3) NOT NULL,
  "lastSeenAt" TIMESTAMP(3) NOT NULL,
  "occurrenceCount" INTEGER NOT NULL DEFAULT 1,
  "affectedCompanyCount" INTEGER NOT NULL DEFAULT 0,
  "lastCompanyId" TEXT,
  "lastUserId" TEXT,
  "lastRoute" TEXT,
  "supportRequestId" TEXT,
  "linearIssueId" TEXT,
  "linearIssueIdentifier" TEXT,
  "linearIssueUrl" TEXT,
  "escalationStatus" "IncidentEscalationStatus" NOT NULL DEFAULT 'PENDING',
  "escalatedAt" TIMESTAMP(3),
  "lastEscalationReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ObservedIncident_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ObservedIncidentCompany" (
  "incidentId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ObservedIncidentCompany_pkey" PRIMARY KEY ("incidentId","companyId")
);

CREATE UNIQUE INDEX "ObservedIncident_fingerprint_environment_key"
ON "ObservedIncident"("fingerprint", "environment");

CREATE INDEX "ObservedIncident_escalationStatus_lastSeenAt_idx"
ON "ObservedIncident"("escalationStatus", "lastSeenAt");

CREATE INDEX "ObservedIncident_severity_source_lastSeenAt_idx"
ON "ObservedIncident"("severity", "source", "lastSeenAt");

CREATE INDEX "ObservedIncident_lastSeenAt_idx"
ON "ObservedIncident"("lastSeenAt");

CREATE INDEX "ObservedIncidentCompany_companyId_firstSeenAt_idx"
ON "ObservedIncidentCompany"("companyId", "firstSeenAt");

ALTER TABLE "ObservedIncidentCompany"
ADD CONSTRAINT "ObservedIncidentCompany_incidentId_fkey"
FOREIGN KEY ("incidentId") REFERENCES "ObservedIncident"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ObservedIncidentCompany"
ADD CONSTRAINT "ObservedIncidentCompany_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
