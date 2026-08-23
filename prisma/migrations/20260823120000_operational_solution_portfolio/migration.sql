-- Additive 5.24.1 operational portfolio extension. Existing solution rows are preserved.
CREATE TYPE "SolutionPortfolioStatus" AS ENUM ('RECEIVED', 'NEEDS_COMPLETION', 'UNDER_REVIEW', 'ACCEPTED', 'IN_PROGRESS', 'OPERATIONAL', 'ON_HOLD', 'ARCHIVED', 'REJECTED');
CREATE TYPE "SolutionIntakeStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'NEEDS_AMENDMENT', 'POSSIBLE_DUPLICATE', 'ACCEPTED', 'LINKED_TO_EXISTING', 'REJECTED');

ALTER TABLE "innovation_solutions"
  ADD COLUMN "portfolioStatus" "SolutionPortfolioStatus" NOT NULL DEFAULT 'NEEDS_COMPLETION',
  ADD COLUMN "externalReferenceId" TEXT,
  ADD COLUMN "intakeFingerprint" TEXT,
  ADD COLUMN "solutionType" TEXT,
  ADD COLUMN "domain" TEXT,
  ADD COLUMN "executingEntity" TEXT,
  ADD COLUMN "operationalOwner" TEXT,
  ADD COLUMN "currentResponsibleUserId" TEXT,
  ADD COLUMN "nextAction" TEXT,
  ADD COLUMN "nextActionDueDate" TIMESTAMP(3),
  ADD COLUMN "expectedImpact" TEXT,
  ADD COLUMN "achievedImpact" TEXT,
  ADD COLUMN "costReductionValue" DECIMAL(14,2),
  ADD COLUMN "costReductionPct" DECIMAL(7,2),
  ADD COLUMN "costReductionDescription" TEXT,
  ADD COLUMN "satisfactionMeasurementSource" TEXT,
  ADD COLUMN "satisfactionMeasurementDate" TIMESTAMP(3),
  ADD COLUMN "usageStartDate" TIMESTAMP(3),
  ADD COLUMN "stillInUse" BOOLEAN,
  ADD COLUMN "usingDepartmentName" TEXT,
  ADD COLUMN "operationNotes" TEXT,
  ADD COLUMN "methodologyApplicationId" TEXT,
  ADD COLUMN "sourceRecordType" TEXT,
  ADD COLUMN "sourceRecordId" TEXT,
  ADD COLUMN "sourceTraceability" JSONB,
  ADD COLUMN "digitalTransformationObjective" TEXT,
  ADD COLUMN "innovationObjective" TEXT,
  ADD COLUMN "linkedInitiative" TEXT,
  ADD COLUMN "beneficiaryGroups" JSONB,
  ADD COLUMN "technologyTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "supportingArtifacts" JSONB,
  ADD COLUMN "implementationJourney" JSONB,
  ADD COLUMN "readinessDetails" JSONB,
  ADD COLUMN "duplicateOfId" TEXT,
  ADD COLUMN "duplicateReason" TEXT;

CREATE UNIQUE INDEX "innovation_solutions_intakeFingerprint_key" ON "innovation_solutions"("intakeFingerprint");
CREATE INDEX "innovation_solutions_portfolioStatus_idx" ON "innovation_solutions"("portfolioStatus");
CREATE INDEX "innovation_solutions_sourceRecordType_sourceRecordId_idx" ON "innovation_solutions"("sourceRecordType", "sourceRecordId");
CREATE INDEX "innovation_solutions_duplicateOfId_idx" ON "innovation_solutions"("duplicateOfId");
ALTER TABLE "innovation_solutions" ADD CONSTRAINT "innovation_solutions_duplicateOfId_fkey" FOREIGN KEY ("duplicateOfId") REFERENCES "innovation_solutions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "solution_intake_links" (
  "id" TEXT NOT NULL, "tokenHash" TEXT NOT NULL, "tokenLast4" TEXT NOT NULL,
  "nameAr" TEXT NOT NULL, "purpose" TEXT NOT NULL, "targetDepartmentId" TEXT,
  "ownerUserId" TEXT NOT NULL, "startsAt" TIMESTAMP(3) NOT NULL, "closesAt" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true, "instructions" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  "archivedAt" TIMESTAMP(3), CONSTRAINT "solution_intake_links_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "solution_intake_links_tokenHash_key" ON "solution_intake_links"("tokenHash");
CREATE INDEX "solution_intake_links_targetDepartmentId_isActive_idx" ON "solution_intake_links"("targetDepartmentId", "isActive");

CREATE TABLE "solution_intake_submissions" (
  "id" TEXT NOT NULL, "intakeLinkId" TEXT, "solutionId" TEXT, "linkedSolutionId" TEXT,
  "importBatchKey" TEXT, "sourceKind" TEXT NOT NULL, "submitterName" TEXT NOT NULL,
  "submitterEmail" TEXT, "departmentName" TEXT, "payload" JSONB NOT NULL, "fingerprint" TEXT NOT NULL,
  "status" "SolutionIntakeStatus" NOT NULL DEFAULT 'SUBMITTED', "reviewerUserId" TEXT,
  "reviewerNotes" TEXT, "amendmentDueDate" TIMESTAMP(3), "duplicateReason" TEXT,
  "continuationReason" TEXT, "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "solution_intake_submissions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "solution_intake_submissions_importBatchKey_key" ON "solution_intake_submissions"("importBatchKey");
CREATE INDEX "solution_intake_submissions_intakeLinkId_status_idx" ON "solution_intake_submissions"("intakeLinkId", "status");
CREATE INDEX "solution_intake_submissions_fingerprint_idx" ON "solution_intake_submissions"("fingerprint");
CREATE INDEX "solution_intake_submissions_linkedSolutionId_idx" ON "solution_intake_submissions"("linkedSolutionId");
ALTER TABLE "solution_intake_submissions" ADD CONSTRAINT "solution_intake_submissions_intakeLinkId_fkey" FOREIGN KEY ("intakeLinkId") REFERENCES "solution_intake_links"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "solution_intake_submissions" ADD CONSTRAINT "solution_intake_submissions_solutionId_fkey" FOREIGN KEY ("solutionId") REFERENCES "innovation_solutions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
