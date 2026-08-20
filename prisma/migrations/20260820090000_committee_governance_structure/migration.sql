-- 5.23.3 Requirement 01 (تشكيل وحدة أو لجنة للابتكار) — extends the existing
-- "committees" table (frozen in 20260731140000_challenges_committees_strategy_documents)
-- with the full governance-structure/formation-decision/member fields the
-- approved requirement needs, plus a committeeId link on requirement_tasks
-- so delegated committee tasks deep-link from "مهامي" into the exact
-- committee. Additive only — no existing column is dropped or renamed.

-- Enums -----------------------------------------------------------------

CREATE TYPE "CommitteeType" AS ENUM ('UNIT', 'COMMITTEE');

CREATE TYPE "CommitteeMemberCategory" AS ENUM (
  'EMPLOYEE',
  'DEPARTMENT_REPRESENTATIVE',
  'EXPERT',
  'EXTERNAL_MEMBER',
  'STUDENT',
  'STUDENT_VOLUNTEER',
  'VOLUNTEER',
  'OTHER'
);

CREATE TYPE "CommitteeMemberStatus" AS ENUM ('ACTIVE', 'ENDED', 'SUSPENDED');

-- committees --------------------------------------------------------------

ALTER TABLE "committees"
  ADD COLUMN "type" "CommitteeType" NOT NULL DEFAULT 'COMMITTEE',
  ADD COLUMN "purpose" TEXT,
  ADD COLUMN "mandateDescription" TEXT,
  ADD COLUMN "relatedDepartmentName" TEXT,
  ADD COLUMN "chairName" TEXT,
  ADD COLUMN "secretaryName" TEXT,
  ADD COLUMN "formationDate" TIMESTAMP(3),
  ADD COLUMN "operationStartDate" TIMESTAMP(3),
  ADD COLUMN "meetingFrequency" TEXT,
  ADD COLUMN "notes" TEXT,
  ADD COLUMN "decisionApprovingAuthority" TEXT,
  ADD COLUMN "decisionEffectiveDate" TIMESTAMP(3),
  ADD COLUMN "decisionNotes" TEXT,
  ADD COLUMN "sourceKey" TEXT;

CREATE UNIQUE INDEX "committees_sourceKey_key" ON "committees"("sourceKey");

-- committee_members ---------------------------------------------------------

ALTER TABLE "committee_members"
  ADD COLUMN "category" "CommitteeMemberCategory" NOT NULL DEFAULT 'EMPLOYEE',
  ADD COLUMN "affiliation" TEXT,
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "roleInCommittee" TEXT,
  ADD COLUMN "responsibilities" TEXT,
  ADD COLUMN "responsibilityScope" TEXT,
  ADD COLUMN "isPrimaryResponsible" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "delegateName" TEXT,
  ADD COLUMN "membershipEndDate" TIMESTAMP(3),
  ADD COLUMN "status" "CommitteeMemberStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "notes" TEXT,
  ADD COLUMN "sourceKey" TEXT;

CREATE UNIQUE INDEX "committee_members_sourceKey_key" ON "committee_members"("sourceKey");

-- requirement_tasks — optional committee deep-link ------------------------

ALTER TABLE "requirement_tasks" ADD COLUMN "committeeId" TEXT;

CREATE INDEX "requirement_tasks_committeeId_status_dueDate_idx"
  ON "requirement_tasks"("committeeId", "status", "dueDate");

ALTER TABLE "requirement_tasks"
  ADD CONSTRAINT "requirement_tasks_committeeId_fkey"
  FOREIGN KEY ("committeeId") REFERENCES "committees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
