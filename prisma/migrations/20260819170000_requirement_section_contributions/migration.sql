CREATE TYPE "SectionContributionStatus" AS ENUM ('NOT_SENT','INVITATION_SENT','OPENED','IN_PROGRESS','SUBMITTED','UNDER_REVIEW','NEEDS_AMENDMENT','COMPLETED','OVERDUE','CANCELLED');
CREATE TYPE "SectionContributorRole" AS ENUM ('RESPONSIBLE','SUPPORTING');
CREATE TYPE "InvitationDeliveryStatus" AS ENUM ('PREPARED','SENT','FAILED','NOT_REQUIRED');

CREATE TABLE "requirement_section_contributions" (
  "id" TEXT PRIMARY KEY,
  "assignmentId" TEXT NOT NULL,
  "sectionKey" TEXT NOT NULL,
  "contributorRole" "SectionContributorRole" NOT NULL DEFAULT 'RESPONSIBLE',
  "contributorUserId" TEXT,
  "contributorName" TEXT NOT NULL,
  "contributorEmail" TEXT NOT NULL,
  "jobTitle" TEXT,
  "departmentName" TEXT,
  "assignedById" TEXT NOT NULL,
  "reviewerUserId" TEXT,
  "dueDate" TIMESTAMP(3),
  "priority" "WorkPriority" NOT NULL DEFAULT 'MEDIUM',
  "requesterNote" TEXT,
  "status" "SectionContributionStatus" NOT NULL DEFAULT 'NOT_SENT',
  "invitationDelivery" "InvitationDeliveryStatus" NOT NULL DEFAULT 'PREPARED',
  "invitationTokenHash" TEXT,
  "invitationTokenLast4" TEXT,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "invitationSentAt" TIMESTAMP(3),
  "openedAt" TIMESTAMP(3),
  "submittedAt" TIMESTAMP(3),
  "reviewedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "taskId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "requirement_section_contributions_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "compliance_requirement_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "requirement_section_contributions_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "requirement_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "requirement_section_contributions_invitationTokenHash_key" ON "requirement_section_contributions"("invitationTokenHash");
CREATE UNIQUE INDEX "requirement_section_contributions_taskId_key" ON "requirement_section_contributions"("taskId");
CREATE INDEX "requirement_section_contributions_assignmentId_sectionKey_status_idx" ON "requirement_section_contributions"("assignmentId","sectionKey","status");
CREATE INDEX "requirement_section_contributions_contributorUserId_status_dueDate_idx" ON "requirement_section_contributions"("contributorUserId","status","dueDate");
CREATE INDEX "requirement_section_contributions_contributorEmail_idx" ON "requirement_section_contributions"("contributorEmail");

CREATE TABLE "requirement_section_submissions" (
  "id" TEXT PRIMARY KEY,
  "contributionId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "data" JSONB NOT NULL,
  "submittedById" TEXT,
  "submitterEmail" TEXT,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewDecision" TEXT,
  "reviewNotes" TEXT,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  CONSTRAINT "requirement_section_submissions_contributionId_fkey" FOREIGN KEY ("contributionId") REFERENCES "requirement_section_contributions"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "requirement_section_submissions_contributionId_version_key" ON "requirement_section_submissions"("contributionId","version");
