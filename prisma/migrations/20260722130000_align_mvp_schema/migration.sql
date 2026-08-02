-- Migration: align_mvp_schema
-- Generated OFFLINE via 'prisma migrate diff' (no dev database reachable at localhost:5433).
-- NOT APPLIED. Incremental from the 20260722005753_init baseline to the Phase 2A aligned schema.
-- WARNING: drops Evidence.status/fileType and ComplianceRequirement.requiredFields/requiredEvidenceTypes/sectionCode-as-column;
-- zero live data at risk (no database has ever been provisioned).
--
-- RESOLVED PostgreSQL enum/default caveat: verified on PostgreSQL 16.14, this
-- migration's "ADD VALUE 'DRAFT'" + "SET DEFAULT 'DRAFT'" in one transaction
-- failed with 55P04 ("unsafe use of new value"). The SET DEFAULT was split into
-- the follow-up migration 20260722130001_ideas_status_default_draft so the new
-- enum value is committed first. See phase-2a-schema-alignment.md §Live PostgreSQL Verification.

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "FileProcessingStatus" AS ENUM ('UPLOADED', 'PROCESSING', 'EXTRACTION_READY', 'PROCESSING_FAILED');

-- CreateEnum
CREATE TYPE "EvidenceReviewStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "DocumentAnalysisStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "DocumentFormat" AS ENUM ('PDF', 'DOCX', 'XLSX');

-- CreateEnum
CREATE TYPE "AnalysisSuggestionKind" AS ENUM ('FIELD', 'REQUIREMENT_MAP', 'IMPACT_ROW');

-- CreateEnum
CREATE TYPE "SuggestionReviewOutcome" AS ENUM ('PENDING', 'ACCEPTED', 'EDITED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ComplianceNAState" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'REVOKED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "IdeaStatus" ADD VALUE 'DRAFT';
ALTER TYPE "IdeaStatus" ADD VALUE 'WITHDRAWN';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedById" TEXT,
ADD COLUMN     "registrationStatus" "RegistrationStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "requestedRoleKey" TEXT;

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "archivedById" TEXT;

-- AlterTable
ALTER TABLE "departments" ADD COLUMN     "archivedById" TEXT;

-- AlterTable
ALTER TABLE "strategic_objectives" ADD COLUMN     "archivedById" TEXT,
ADD COLUMN     "responsibleUserId" TEXT;

-- AlterTable
ALTER TABLE "innovation_activities" ADD COLUMN     "archivedById" TEXT,
ADD COLUMN     "challenge" TEXT;

-- AlterTable
-- NOTE: the "ideas.status SET DEFAULT 'DRAFT'" statement was intentionally
-- MOVED to the following migration (20260722130001_ideas_status_default_draft)
-- so the new "DRAFT" enum value is committed before it is used, avoiding
-- PostgreSQL error 55P04 ("unsafe use of new value ... of enum type"). The
-- ADD VALUE statements above remain here and commit with this migration.
ALTER TABLE "ideas" ADD COLUMN     "archivedById" TEXT;

-- AlterTable
ALTER TABLE "idea_decisions" ADD COLUMN     "correctionReason" TEXT,
ADD COLUMN     "finalizedAt" TIMESTAMP(3),
ADD COLUMN     "finalizedById" TEXT,
ADD COLUMN     "reopenReason" TEXT,
ADD COLUMN     "reopenedAt" TIMESTAMP(3),
ADD COLUMN     "reopenedById" TEXT,
ADD COLUMN     "supersedesId" TEXT;

-- AlterTable
ALTER TABLE "innovation_solutions" ADD COLUMN     "archivedById" TEXT,
ADD COLUMN     "durationMonths" INTEGER;

-- AlterTable
ALTER TABLE "impact_measurements" ADD COLUMN     "reopenReason" TEXT,
ADD COLUMN     "reopenedAt" TIMESTAMP(3),
ADD COLUMN     "reopenedById" TEXT,
ADD COLUMN     "supersedesId" TEXT,
ADD COLUMN     "verifiedAt" TIMESTAMP(3),
ADD COLUMN     "verifiedById" TEXT;

-- AlterTable
ALTER TABLE "cooperation_agreements" ADD COLUMN     "archivedById" TEXT;

-- AlterTable
ALTER TABLE "agreement_meetings" ADD COLUMN     "attendanceConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "attendanceConfirmedById" TEXT;

-- AlterTable
ALTER TABLE "compliance_requirements" DROP COLUMN "requiredEvidenceTypes",
DROP COLUMN "requiredFields",
ADD COLUMN     "allowNA" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "entityType" "LinkedEntityType",
ADD COLUMN     "gateCeiling" INTEGER NOT NULL DEFAULT 69,
ADD COLUMN     "isEstimated" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "requirementWeight" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "sectionId" TEXT,
ALTER COLUMN "sectionCode" DROP NOT NULL;

-- AlterTable
ALTER TABLE "evidence" DROP COLUMN "fileType",
DROP COLUMN "status",
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedById" TEXT,
ADD COLUMN     "archivedById" TEXT,
ADD COLUMN     "classification" TEXT,
ADD COLUMN     "fileProcessingStatus" "FileProcessingStatus" NOT NULL DEFAULT 'UPLOADED',
ADD COLUMN     "mimeType" TEXT,
ADD COLUMN     "reviewStatus" "EvidenceReviewStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT,
ADD COLUMN     "sizeBytes" INTEGER;

-- AlterTable
ALTER TABLE "alerts" ADD COLUMN     "acknowledgedAt" TIMESTAMP(3),
ADD COLUMN     "dismissedAt" TIMESTAMP(3),
ADD COLUMN     "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "source" TEXT;

-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "afterData" JSONB,
ADD COLUMN     "beforeData" JSONB,
ADD COLUMN     "departmentId" TEXT,
ADD COLUMN     "ipAddress" TEXT,
ADD COLUMN     "organizationId" TEXT,
ADD COLUMN     "userAgent" TEXT;

-- DropEnum
DROP TYPE "EvidenceStatus";

-- CreateTable
CREATE TABLE "resource_shares" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entityType" "LinkedEntityType" NOT NULL,
    "solutionId" TEXT,
    "agreementId" TEXT,
    "allowedActions" TEXT[],
    "allowedFields" TEXT[],
    "grantedById" TEXT NOT NULL,
    "revokedById" TEXT,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resource_shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_organizations" (
    "activityId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" TEXT,

    CONSTRAINT "activity_organizations_pkey" PRIMARY KEY ("activityId","organizationId")
);

-- CreateTable
CREATE TABLE "agreement_solutions" (
    "agreementId" TEXT NOT NULL,
    "solutionId" TEXT NOT NULL,

    CONSTRAINT "agreement_solutions_pkey" PRIMARY KEY ("agreementId","solutionId")
);

-- CreateTable
CREATE TABLE "agreement_activities" (
    "agreementId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,

    CONSTRAINT "agreement_activities_pkey" PRIMARY KEY ("agreementId","activityId")
);

-- CreateTable
CREATE TABLE "compliance_sections" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "titleAr" TEXT NOT NULL,
    "description" TEXT,
    "sectionWeight" INTEGER NOT NULL DEFAULT 1,
    "orderIndex" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compliance_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requirement_field_rules" (
    "id" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "labelAr" TEXT,
    "rule" TEXT NOT NULL DEFAULT 'required',
    "weight" INTEGER NOT NULL DEFAULT 1,
    "mandatoryGate" BOOLEAN NOT NULL DEFAULT false,
    "optional" BOOLEAN NOT NULL DEFAULT false,
    "orderIndex" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "requirement_field_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requirement_evidence_rules" (
    "id" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "evidenceTypeKey" TEXT NOT NULL,
    "labelAr" TEXT,
    "minCount" INTEGER NOT NULL DEFAULT 1,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "mandatoryGate" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "requirement_evidence_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_requirement_versions" (
    "id" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compliance_requirement_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_nas" (
    "id" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "state" "ComplianceNAState" NOT NULL DEFAULT 'REQUESTED',
    "scopeRef" JSONB,
    "requestedById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "revokedById" TEXT,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compliance_nas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_analyses" (
    "id" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "format" "DocumentFormat" NOT NULL,
    "status" "DocumentAnalysisStatus" NOT NULL DEFAULT 'QUEUED',
    "provider" TEXT,
    "model" TEXT,
    "extractorVersion" TEXT,
    "promptVersion" TEXT,
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "error" TEXT,
    "extractedTextMeta" JSONB,
    "sourceRefs" JSONB,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analysis_suggestions" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "kind" "AnalysisSuggestionKind" NOT NULL,
    "fieldKey" TEXT,
    "suggestedValue" JSONB,
    "targetEntityType" "LinkedEntityType",
    "targetEntityId" TEXT,
    "suggestedRequirementId" TEXT,
    "confidence" DOUBLE PRECISION,
    "sourcePage" INTEGER,
    "sourceSection" TEXT,
    "sourceCell" TEXT,
    "sourceExcerpt" TEXT,
    "sourceRef" JSONB,
    "reviewOutcome" "SuggestionReviewOutcome" NOT NULL DEFAULT 'PENDING',
    "reviewedValue" JSONB,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analysis_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "resource_shares_userId_idx" ON "resource_shares"("userId");

-- CreateIndex
CREATE INDEX "resource_shares_entityType_solutionId_agreementId_idx" ON "resource_shares"("entityType", "solutionId", "agreementId");

-- CreateIndex
CREATE UNIQUE INDEX "compliance_sections_code_key" ON "compliance_sections"("code");

-- CreateIndex
CREATE UNIQUE INDEX "requirement_field_rules_requirementId_fieldKey_key" ON "requirement_field_rules"("requirementId", "fieldKey");

-- CreateIndex
CREATE UNIQUE INDEX "requirement_evidence_rules_requirementId_evidenceTypeKey_key" ON "requirement_evidence_rules"("requirementId", "evidenceTypeKey");

-- CreateIndex
CREATE UNIQUE INDEX "compliance_requirement_versions_requirementId_version_key" ON "compliance_requirement_versions"("requirementId", "version");

-- CreateIndex
CREATE INDEX "compliance_nas_requirementId_state_idx" ON "compliance_nas"("requirementId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "document_analyses_evidenceId_key" ON "document_analyses"("evidenceId");

-- CreateIndex
CREATE INDEX "document_analyses_status_idx" ON "document_analyses"("status");

-- CreateIndex
CREATE INDEX "analysis_suggestions_analysisId_idx" ON "analysis_suggestions"("analysisId");

-- CreateIndex
CREATE INDEX "analysis_suggestions_reviewOutcome_idx" ON "analysis_suggestions"("reviewOutcome");

-- CreateIndex
CREATE INDEX "users_registrationStatus_idx" ON "users"("registrationStatus");

-- CreateIndex
CREATE INDEX "departments_organizationId_idx" ON "departments"("organizationId");

-- CreateIndex
CREATE INDEX "ideas_status_idx" ON "ideas"("status");

-- CreateIndex
CREATE INDEX "ideas_departmentId_idx" ON "ideas"("departmentId");

-- CreateIndex
CREATE INDEX "idea_evaluations_ideaId_idx" ON "idea_evaluations"("ideaId");

-- CreateIndex
CREATE INDEX "idea_decisions_ideaId_idx" ON "idea_decisions"("ideaId");

-- CreateIndex
CREATE INDEX "evidence_fileProcessingStatus_idx" ON "evidence"("fileProcessingStatus");

-- CreateIndex
CREATE INDEX "evidence_reviewStatus_idx" ON "evidence"("reviewStatus");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_shares" ADD CONSTRAINT "resource_shares_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_shares" ADD CONSTRAINT "resource_shares_solutionId_fkey" FOREIGN KEY ("solutionId") REFERENCES "innovation_solutions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_shares" ADD CONSTRAINT "resource_shares_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "cooperation_agreements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_organizations" ADD CONSTRAINT "activity_organizations_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "innovation_activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_organizations" ADD CONSTRAINT "activity_organizations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idea_decisions" ADD CONSTRAINT "idea_decisions_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "idea_decisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "impact_measurements" ADD CONSTRAINT "impact_measurements_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "impact_measurements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agreement_solutions" ADD CONSTRAINT "agreement_solutions_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "cooperation_agreements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agreement_solutions" ADD CONSTRAINT "agreement_solutions_solutionId_fkey" FOREIGN KEY ("solutionId") REFERENCES "innovation_solutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agreement_activities" ADD CONSTRAINT "agreement_activities_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "cooperation_agreements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agreement_activities" ADD CONSTRAINT "agreement_activities_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "innovation_activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_requirements" ADD CONSTRAINT "compliance_requirements_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "compliance_sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_field_rules" ADD CONSTRAINT "requirement_field_rules_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "compliance_requirements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_evidence_rules" ADD CONSTRAINT "requirement_evidence_rules_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "compliance_requirements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_requirement_versions" ADD CONSTRAINT "compliance_requirement_versions_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "compliance_requirements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_nas" ADD CONSTRAINT "compliance_nas_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "compliance_requirements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_analyses" ADD CONSTRAINT "document_analyses_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "evidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analysis_suggestions" ADD CONSTRAINT "analysis_suggestions_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "document_analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analysis_suggestions" ADD CONSTRAINT "analysis_suggestions_suggestedRequirementId_fkey" FOREIGN KEY ("suggestedRequirementId") REFERENCES "compliance_requirements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

