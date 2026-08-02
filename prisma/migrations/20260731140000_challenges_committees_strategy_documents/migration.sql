-- Migration: challenges_committees_strategy_documents
--
-- Adds: Challenge / ChallengeSolution, Committee / CommitteeMember /
-- CommitteeMeeting, ComplianceRequirementAssignment / StrategyDocument
-- (final Schema-Freeze design: Assignment is the SOLE source of truth for
-- requirement/department/objective — StrategyDocument only carries
-- assignmentId), plus two nullable columns on InnovationActivity and
-- additive enum values on InnovationActivityType and LinkedEntityType.
--
-- Fully additive: no existing column, table, or constraint is altered or
-- dropped. No DML (no INSERT/UPDATE/DELETE) — zero impact on existing rows,
-- no backfill required.
--
-- NOTE: this file was authored by hand to match Prisma's SQL conventions,
-- because this sandbox cannot reach binaries.prisma.sh to run the official
-- `prisma migrate diff` engine. Re-generate and diff against the official
-- tool before applying (see chat message).
--
-- NOT APPLIED to any database. No DATABASE_URL / Neon connection was used or
-- available in this session.

-- CreateEnum
CREATE TYPE "ChallengeStatus" AS ENUM ('NEW', 'UNDER_REVIEW', 'SOLUTION_PROPOSED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED_WITHOUT_SOLUTION');

-- CreateEnum
CREATE TYPE "CommitteeStatus" AS ENUM ('PROPOSED', 'ACTIVE', 'DISSOLVED');

-- CreateEnum
CREATE TYPE "CommitteeMeetingStatus" AS ENUM ('SCHEDULED', 'HELD', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DocumentApprovalStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED');

-- AlterEnum
-- New values are not referenced as a DEFAULT or in any DML in this same
-- migration, so they are safe to add within one transaction (PostgreSQL 12+).
ALTER TYPE "InnovationActivityType" ADD VALUE 'MEETING';
ALTER TYPE "InnovationActivityType" ADD VALUE 'PROGRAM';
ALTER TYPE "InnovationActivityType" ADD VALUE 'INITIATIVE';

-- AlterEnum
ALTER TYPE "LinkedEntityType" ADD VALUE 'CHALLENGE';
ALTER TYPE "LinkedEntityType" ADD VALUE 'COMMITTEE';
ALTER TYPE "LinkedEntityType" ADD VALUE 'COMMITTEE_MEETING';
ALTER TYPE "LinkedEntityType" ADD VALUE 'STRATEGY_DOCUMENT';

-- AlterTable
ALTER TABLE "innovation_activities" ADD COLUMN "objectivesAr" TEXT,
ADD COLUMN "eventUrl" TEXT;

-- CreateTable
-- Sole source of truth for requirement×department (×objective) assignment.
-- "Active" uniqueness (one live assignment per requirement×department) is a
-- PARTIAL unique index below (WHERE archivedAt IS NULL), not a plain
-- UNIQUE constraint, so a requirement can be reassigned to the same
-- department in a later planning cycle once the prior assignment is archived.
CREATE TABLE "compliance_requirement_assignments" (
    "id" TEXT NOT NULL,
    "complianceRequirementId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "strategicObjectiveId" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedById" TEXT,
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "archivedById" TEXT,

    CONSTRAINT "compliance_requirement_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
-- Deliberately does NOT repeat complianceRequirementId / departmentId /
-- strategicObjectiveId — always read via assignment.*. "Active" 1:1 with
-- its assignment is a PARTIAL unique index below (WHERE archivedAt IS
-- NULL), not a plain UNIQUE constraint, so a mistakenly-archived document
-- can be replaced without breaking history.
CREATE TABLE "strategy_documents" (
    "id" TEXT NOT NULL,
    "titleAr" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "description" TEXT,
    "assignmentId" TEXT NOT NULL,
    "documentDate" TIMESTAMP(3),
    "approvalStatus" "DocumentApprovalStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "uploadedById" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "archivedById" TEXT,

    CONSTRAINT "strategy_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "committees" (
    "id" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "category" TEXT,
    "organizationId" TEXT NOT NULL,
    "decisionNumber" TEXT,
    "decisionDate" TIMESTAMP(3),
    "status" "CommitteeStatus" NOT NULL DEFAULT 'PROPOSED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "archivedById" TEXT,

    CONSTRAINT "committees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "committee_members" (
    "id" TEXT NOT NULL,
    "committeeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "email" TEXT,
    "userId" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "committee_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "committee_meetings" (
    "id" TEXT NOT NULL,
    "committeeId" TEXT NOT NULL,
    "sequenceNumber" INTEGER NOT NULL,
    "meetingDate" TIMESTAMP(3) NOT NULL,
    "agenda" TEXT,
    "topicsDiscussed" TEXT,
    "decisionsAndRecommendations" TEXT,
    "status" "CommitteeMeetingStatus" NOT NULL DEFAULT 'SCHEDULED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "archivedById" TEXT,

    CONSTRAINT "committee_meetings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "challenges" (
    "id" TEXT NOT NULL,
    "titleAr" TEXT NOT NULL,
    "description" TEXT,
    "departmentId" TEXT NOT NULL,
    "category" TEXT,
    "submittedById" TEXT,
    "status" "ChallengeStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "archivedById" TEXT,

    CONSTRAINT "challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "challenge_solutions" (
    "challengeId" TEXT NOT NULL,
    "solutionId" TEXT NOT NULL,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "linkedById" TEXT,

    CONSTRAINT "challenge_solutions_pkey" PRIMARY KEY ("challengeId","solutionId")
);

-- CreateIndex
CREATE INDEX "compliance_requirement_assignments_complianceRequirementId_departmentId_idx" ON "compliance_requirement_assignments"("complianceRequirementId", "departmentId");

-- CreateIndex
CREATE INDEX "compliance_requirement_assignments_departmentId_idx" ON "compliance_requirement_assignments"("departmentId");

-- CreateIndex
CREATE INDEX "compliance_requirement_assignments_strategicObjectiveId_idx" ON "compliance_requirement_assignments"("strategicObjectiveId");

-- CreateIndex (PARTIAL — enforces "one ACTIVE assignment per requirement×department",
-- while allowing reassignment after the prior one is archived)
CREATE UNIQUE INDEX "compliance_requirement_assignments_active_pair_key"
  ON "compliance_requirement_assignments" ("complianceRequirementId", "departmentId")
  WHERE "archivedAt" IS NULL;

-- CreateIndex (PARTIAL — enforces "one ACTIVE document per assignment" = 1:1 in
-- practice, while allowing a replacement document after the prior one is archived)
CREATE UNIQUE INDEX "strategy_documents_active_assignment_key"
  ON "strategy_documents" ("assignmentId")
  WHERE "archivedAt" IS NULL;

-- CreateIndex
CREATE INDEX "committees_organizationId_idx" ON "committees"("organizationId");

-- CreateIndex
CREATE INDEX "committee_members_committeeId_idx" ON "committee_members"("committeeId");

-- CreateIndex
CREATE UNIQUE INDEX "committee_meetings_committeeId_sequenceNumber_key" ON "committee_meetings"("committeeId", "sequenceNumber");

-- CreateIndex
CREATE INDEX "challenges_departmentId_idx" ON "challenges"("departmentId");

-- CreateIndex
CREATE INDEX "challenges_status_idx" ON "challenges"("status");

-- AddForeignKey
ALTER TABLE "compliance_requirement_assignments" ADD CONSTRAINT "compliance_requirement_assignments_complianceRequirementId_fkey" FOREIGN KEY ("complianceRequirementId") REFERENCES "compliance_requirements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_requirement_assignments" ADD CONSTRAINT "compliance_requirement_assignments_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_requirement_assignments" ADD CONSTRAINT "compliance_requirement_assignments_strategicObjectiveId_fkey" FOREIGN KEY ("strategicObjectiveId") REFERENCES "strategic_objectives"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "strategy_documents" ADD CONSTRAINT "strategy_documents_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "compliance_requirement_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "committees" ADD CONSTRAINT "committees_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "committee_members" ADD CONSTRAINT "committee_members_committeeId_fkey" FOREIGN KEY ("committeeId") REFERENCES "committees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "committee_meetings" ADD CONSTRAINT "committee_meetings_committeeId_fkey" FOREIGN KEY ("committeeId") REFERENCES "committees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge_solutions" ADD CONSTRAINT "challenge_solutions_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "challenges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge_solutions" ADD CONSTRAINT "challenge_solutions_solutionId_fkey" FOREIGN KEY ("solutionId") REFERENCES "innovation_solutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
