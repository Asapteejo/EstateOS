DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'FeasibilityDecisionStatus'
  ) THEN
    CREATE TYPE "FeasibilityDecisionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
  END IF;
END $$;

ALTER TABLE "DevelopmentCalculation"
ADD COLUMN IF NOT EXISTS "decisionStatus" "FeasibilityDecisionStatus" NOT NULL DEFAULT 'PENDING';
