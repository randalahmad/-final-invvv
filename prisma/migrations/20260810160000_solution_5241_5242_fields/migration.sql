-- Additive-only migration for official 5.24.1 / 5.24.2 fields discovered via
-- "وثيقة المعايير الأساسية للتحول الرقمي — معيار الابتكار 2026" (2026-08-10 audit).
-- Every column is nullable (or has a safe default); nothing existing is dropped,
-- renamed, or made NOT NULL. No data is modified. Offline (no dev DB in this
-- environment) — apply against the real database with `prisma migrate deploy`
-- (or review and run manually) before relying on these fields.

ALTER TABLE "innovation_solutions"
  ADD COLUMN "launchDate" TIMESTAMP(3),
  ADD COLUMN "beneficiaryCount" INTEGER,
  ADD COLUMN "achievedOrExpectedImpact" TEXT,
  ADD COLUMN "beneficiarySatisfactionPct" INTEGER,
  ADD COLUMN "previouslySubmittedForMeasurement" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "significantChangeNote" TEXT,
  ADD COLUMN "innovationMethodologySource" TEXT,
  ADD COLUMN "digitalTransformationPlanLink" TEXT,
  ADD COLUMN "isSustained" BOOLEAN,
  ADD COLUMN "sustainabilityOwner" TEXT,
  ADD COLUMN "sustainabilityPlan" TEXT;

CREATE TYPE "AwardLevel" AS ENUM ('LOCAL', 'REGIONAL', 'INTERNATIONAL');

CREATE TABLE "solution_awards" (
  "id" TEXT PRIMARY KEY,
  "solutionId" TEXT NOT NULL,
  "nameAr" TEXT NOT NULL,
  "level" "AwardLevel" NOT NULL,
  "awardedAt" TIMESTAMP(3),
  "evidenceNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "archivedAt" TIMESTAMP(3)
);

ALTER TABLE "solution_awards"
  ADD CONSTRAINT "solution_awards_solutionId_fkey"
  FOREIGN KEY ("solutionId") REFERENCES "innovation_solutions"("id") ON DELETE CASCADE;

CREATE INDEX "solution_awards_solutionId_idx" ON "solution_awards"("solutionId");
