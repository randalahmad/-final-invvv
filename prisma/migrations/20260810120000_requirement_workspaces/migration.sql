-- Phase 2 operational requirement workspaces. Additive only; existing data is preserved.
CREATE TYPE "RequirementOperationalStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'AWAITING_EVIDENCE', 'COMPLETED');

ALTER TYPE "LinkedEntityType" ADD VALUE 'REQUIREMENT_ASSIGNMENT';

ALTER TABLE "compliance_requirement_assignments"
  ADD COLUMN "workspaceData" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "operationalStatus" "RequirementOperationalStatus" NOT NULL DEFAULT 'NOT_STARTED',
  ADD COLUMN "responsibleUserId" TEXT,
  ADD COLUMN "lastSavedById" TEXT;
