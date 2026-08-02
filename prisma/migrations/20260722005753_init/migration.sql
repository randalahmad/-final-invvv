-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "ScopeType" AS ENUM ('PLATFORM', 'ORGANIZATION', 'DEPARTMENT', 'AGREEMENT', 'SOLUTION', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "OrganizationType" AS ENUM ('OWNER', 'INTERNAL', 'PARTNER', 'UNIVERSITY', 'COMPANY', 'GOVERNMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "InnovationActivityType" AS ENUM ('HACKATHON', 'INNOVATION_CAMP', 'WORKSHOP', 'CHALLENGE', 'INTERNAL_IDEATION', 'OPEN_INNOVATION', 'COMPETITION', 'OTHER');

-- CreateEnum
CREATE TYPE "ActivityStatus" AS ENUM ('PLANNED', 'ONGOING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "IdeaStatus" AS ENUM ('SUBMITTED', 'INITIAL_REVIEW', 'TECHNICAL_REVIEW', 'MORE_INFO_REQUESTED', 'APPROVED_FOR_PILOT', 'REJECTED', 'CONVERTED_TO_SOLUTION', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EvaluationStage" AS ENUM ('INITIAL', 'TECHNICAL', 'COMMITTEE');

-- CreateEnum
CREATE TYPE "DecisionType" AS ENUM ('APPROVE_FOR_PILOT', 'REJECT', 'REQUEST_MORE_INFO', 'CONVERT_TO_SOLUTION', 'DEFER');

-- CreateEnum
CREATE TYPE "SolutionSource" AS ENUM ('ACTIVITY', 'INTERNAL_PROPOSAL', 'EXTERNAL_PARTNERSHIP');

-- CreateEnum
CREATE TYPE "MaturityStage" AS ENUM ('CONCEPT', 'PROTOTYPE', 'POC', 'PILOT', 'OPERATIONAL');

-- CreateEnum
CREATE TYPE "ImplementationStatus" AS ENUM ('PLANNING', 'IN_PROGRESS', 'OPERATING', 'ON_HOLD', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RecordStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ImpactType" AS ENUM ('FINANCIAL', 'OPERATIONAL', 'BENEFICIARY', 'TIME_REDUCTION', 'COST_REDUCTION', 'QUALITY', 'PRODUCTIVITY', 'SATISFACTION', 'ENVIRONMENTAL');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AgreementType" AS ENUM ('MOU', 'PARTNERSHIP', 'RESEARCH', 'SERVICE', 'OTHER');

-- CreateEnum
CREATE TYPE "AgreementStatus" AS ENUM ('DRAFT', 'ACTIVE', 'EXPIRED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "RenewalStatus" AS ENUM ('NOT_DUE', 'DUE_SOON', 'IN_PROGRESS', 'RENEWED', 'LAPSED');

-- CreateEnum
CREATE TYPE "MeetingStatus" AS ENUM ('SCHEDULED', 'HELD', 'MISSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EvidenceStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "LinkedEntityType" AS ENUM ('COMPLIANCE_REQUIREMENT', 'STRATEGIC_OBJECTIVE', 'INNOVATION_ACTIVITY', 'IDEA', 'INNOVATION_SOLUTION', 'IMPACT_MEASUREMENT', 'COOPERATION_AGREEMENT', 'AGREEMENT_MEETING', 'REPORT');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('MEETING_OVERDUE', 'MEETING_UPCOMING', 'AGREEMENT_EXPIRY', 'AGREEMENT_RENEWAL', 'MISSING_EVIDENCE', 'INCOMPLETE_SOLUTION', 'IMPACT_WINDOW', 'EVALUATION_DEADLINE', 'APPROVAL_TASK');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('INFO', 'SUCCESS', 'WARNING', 'DANGER');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "passwordHash" TEXT,
    "image" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "jobTitle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "scopeType" "ScopeType" NOT NULL DEFAULT 'PLATFORM',
    "scopeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "type" "OrganizationType" NOT NULL DEFAULT 'INTERNAL',
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_memberships" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT,
    "departmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "strategic_objectives" (
    "id" TEXT NOT NULL,
    "code" TEXT,
    "titleAr" TEXT NOT NULL,
    "description" TEXT,
    "departmentId" TEXT,
    "kpi" TEXT,
    "targetValue" TEXT,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "strategic_objectives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "innovation_activities" (
    "id" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "type" "InnovationActivityType" NOT NULL DEFAULT 'OTHER',
    "description" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "organizerDepartmentId" TEXT,
    "status" "ActivityStatus" NOT NULL DEFAULT 'PLANNED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "innovation_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ideas" (
    "id" TEXT NOT NULL,
    "titleAr" TEXT NOT NULL,
    "description" TEXT,
    "activityId" TEXT,
    "submittedById" TEXT,
    "departmentId" TEXT,
    "status" "IdeaStatus" NOT NULL DEFAULT 'SUBMITTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "ideas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idea_evaluations" (
    "id" TEXT NOT NULL,
    "ideaId" TEXT NOT NULL,
    "evaluatorId" TEXT,
    "stage" "EvaluationStage" NOT NULL DEFAULT 'INITIAL',
    "score" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idea_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idea_decisions" (
    "id" TEXT NOT NULL,
    "ideaId" TEXT NOT NULL,
    "decidedById" TEXT,
    "decision" "DecisionType" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idea_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "innovation_solutions" (
    "id" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "description" TEXT,
    "problemStatement" TEXT,
    "source" "SolutionSource" NOT NULL DEFAULT 'INTERNAL_PROPOSAL',
    "activityId" TEXT,
    "ideaId" TEXT,
    "owningDepartmentId" TEXT,
    "strategicObjectiveId" TEXT,
    "ownerUserId" TEXT,
    "maturityStage" "MaturityStage" NOT NULL DEFAULT 'CONCEPT',
    "implementationStatus" "ImplementationStatus" NOT NULL DEFAULT 'PLANNING',
    "startDate" TIMESTAMP(3),
    "targetEndDate" TIMESTAMP(3),
    "actualEndDate" TIMESTAMP(3),
    "cost" DECIMAL(14,2),
    "targetBeneficiaries" TEXT,
    "technologies" TEXT,
    "completionPct" INTEGER NOT NULL DEFAULT 0,
    "evidenceReadinessPct" INTEGER NOT NULL DEFAULT 0,
    "risks" TEXT,
    "notes" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "innovation_solutions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solution_organizations" (
    "solutionId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "solution_organizations_pkey" PRIMARY KEY ("solutionId","organizationId")
);

-- CreateTable
CREATE TABLE "impact_indicators" (
    "id" TEXT NOT NULL,
    "solutionId" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "type" "ImpactType" NOT NULL DEFAULT 'OPERATIONAL',
    "unit" TEXT,
    "baselineValue" DECIMAL(16,4),
    "targetValue" DECIMAL(16,4),
    "measurementMethod" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "impact_indicators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "impact_measurements" (
    "id" TEXT NOT NULL,
    "indicatorId" TEXT NOT NULL,
    "actualValue" DECIMAL(16,4),
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "measuredAt" TIMESTAMP(3),
    "dataSource" TEXT,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "impact_measurements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cooperation_agreements" (
    "id" TEXT NOT NULL,
    "partnerOrgId" TEXT NOT NULL,
    "titleAr" TEXT NOT NULL,
    "type" "AgreementType" NOT NULL DEFAULT 'MOU',
    "effectiveDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "renewalStatus" "RenewalStatus" NOT NULL DEFAULT 'NOT_DUE',
    "status" "AgreementStatus" NOT NULL DEFAULT 'DRAFT',
    "responsibleUserId" TEXT,
    "externalContact" TEXT,
    "meetingFrequencyMonths" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "cooperation_agreements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agreement_meetings" (
    "id" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "scheduledDate" TIMESTAMP(3),
    "actualDate" TIMESTAMP(3),
    "status" "MeetingStatus" NOT NULL DEFAULT 'SCHEDULED',
    "minutes" TEXT,
    "decisions" TEXT,
    "nextMeetingDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agreement_meetings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_requirements" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "sectionCode" TEXT NOT NULL,
    "titleAr" TEXT NOT NULL,
    "description" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "parentId" TEXT,
    "requiredFields" JSONB,
    "requiredEvidenceTypes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compliance_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "fileName" TEXT,
    "fileType" TEXT,
    "storagePath" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "uploadedById" TEXT,
    "status" "EvidenceStatus" NOT NULL DEFAULT 'DRAFT',
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "checksum" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence_links" (
    "id" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "entityType" "LinkedEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "requirementId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL,
    "type" "AlertType" NOT NULL,
    "severity" "AlertSeverity" NOT NULL DEFAULT 'WARNING',
    "status" "AlertStatus" NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "message" TEXT,
    "entityType" "LinkedEntityType",
    "entityId" TEXT,
    "assignedToUserId" TEXT,
    "dueDate" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT,
    "type" "NotificationType" NOT NULL DEFAULT 'INFO',
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" "LinkedEntityType",
    "entityId" TEXT,
    "summary" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "roles_key_key" ON "roles"("key");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_key_key" ON "permissions"("key");

-- CreateIndex
CREATE INDEX "user_roles_scopeType_scopeId_idx" ON "user_roles"("scopeType", "scopeId");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_userId_roleId_scopeType_scopeId_key" ON "user_roles"("userId", "roleId", "scopeType", "scopeId");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "user_memberships_userId_organizationId_departmentId_key" ON "user_memberships"("userId", "organizationId", "departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "innovation_solutions_ideaId_key" ON "innovation_solutions"("ideaId");

-- CreateIndex
CREATE INDEX "innovation_solutions_owningDepartmentId_idx" ON "innovation_solutions"("owningDepartmentId");

-- CreateIndex
CREATE INDEX "innovation_solutions_maturityStage_idx" ON "innovation_solutions"("maturityStage");

-- CreateIndex
CREATE INDEX "impact_indicators_solutionId_idx" ON "impact_indicators"("solutionId");

-- CreateIndex
CREATE INDEX "impact_measurements_indicatorId_idx" ON "impact_measurements"("indicatorId");

-- CreateIndex
CREATE INDEX "cooperation_agreements_partnerOrgId_idx" ON "cooperation_agreements"("partnerOrgId");

-- CreateIndex
CREATE INDEX "agreement_meetings_agreementId_idx" ON "agreement_meetings"("agreementId");

-- CreateIndex
CREATE UNIQUE INDEX "compliance_requirements_code_key" ON "compliance_requirements"("code");

-- CreateIndex
CREATE INDEX "compliance_requirements_sectionCode_idx" ON "compliance_requirements"("sectionCode");

-- CreateIndex
CREATE INDEX "evidence_links_entityType_entityId_idx" ON "evidence_links"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "evidence_links_evidenceId_entityType_entityId_key" ON "evidence_links"("evidenceId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "alerts_status_severity_idx" ON "alerts"("status", "severity");

-- CreateIndex
CREATE INDEX "alerts_entityType_entityId_idx" ON "alerts"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "notifications_userId_read_idx" ON "notifications"("userId", "read");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_actorUserId_idx" ON "audit_logs"("actorUserId");

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_memberships" ADD CONSTRAINT "user_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_memberships" ADD CONSTRAINT "user_memberships_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_memberships" ADD CONSTRAINT "user_memberships_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "strategic_objectives" ADD CONSTRAINT "strategic_objectives_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "innovation_activities" ADD CONSTRAINT "innovation_activities_organizerDepartmentId_fkey" FOREIGN KEY ("organizerDepartmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ideas" ADD CONSTRAINT "ideas_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "innovation_activities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ideas" ADD CONSTRAINT "ideas_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idea_evaluations" ADD CONSTRAINT "idea_evaluations_ideaId_fkey" FOREIGN KEY ("ideaId") REFERENCES "ideas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idea_evaluations" ADD CONSTRAINT "idea_evaluations_evaluatorId_fkey" FOREIGN KEY ("evaluatorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idea_decisions" ADD CONSTRAINT "idea_decisions_ideaId_fkey" FOREIGN KEY ("ideaId") REFERENCES "ideas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idea_decisions" ADD CONSTRAINT "idea_decisions_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "innovation_solutions" ADD CONSTRAINT "innovation_solutions_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "innovation_activities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "innovation_solutions" ADD CONSTRAINT "innovation_solutions_ideaId_fkey" FOREIGN KEY ("ideaId") REFERENCES "ideas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "innovation_solutions" ADD CONSTRAINT "innovation_solutions_owningDepartmentId_fkey" FOREIGN KEY ("owningDepartmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "innovation_solutions" ADD CONSTRAINT "innovation_solutions_strategicObjectiveId_fkey" FOREIGN KEY ("strategicObjectiveId") REFERENCES "strategic_objectives"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "innovation_solutions" ADD CONSTRAINT "innovation_solutions_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solution_organizations" ADD CONSTRAINT "solution_organizations_solutionId_fkey" FOREIGN KEY ("solutionId") REFERENCES "innovation_solutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solution_organizations" ADD CONSTRAINT "solution_organizations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "impact_indicators" ADD CONSTRAINT "impact_indicators_solutionId_fkey" FOREIGN KEY ("solutionId") REFERENCES "innovation_solutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "impact_measurements" ADD CONSTRAINT "impact_measurements_indicatorId_fkey" FOREIGN KEY ("indicatorId") REFERENCES "impact_indicators"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cooperation_agreements" ADD CONSTRAINT "cooperation_agreements_partnerOrgId_fkey" FOREIGN KEY ("partnerOrgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cooperation_agreements" ADD CONSTRAINT "cooperation_agreements_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agreement_meetings" ADD CONSTRAINT "agreement_meetings_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "cooperation_agreements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_requirements" ADD CONSTRAINT "compliance_requirements_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "compliance_requirements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_links" ADD CONSTRAINT "evidence_links_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "evidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_links" ADD CONSTRAINT "evidence_links_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "compliance_requirements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
