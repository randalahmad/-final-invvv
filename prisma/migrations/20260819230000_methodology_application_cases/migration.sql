CREATE TABLE "methodology_applications" (
  "id" TEXT NOT NULL,
  "assignmentId" TEXT NOT NULL,
  "sourceKey" TEXT NOT NULL,
  "nameAr" TEXT NOT NULL,
  "challengeAr" TEXT,
  "methodologyAr" TEXT,
  "owningDepartmentName" TEXT,
  "responsibleUserId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "startDate" TIMESTAMP(3),
  "endDate" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "archivedAt" TIMESTAMP(3),
  CONSTRAINT "methodology_applications_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "methodology_applications_sourceKey_key" ON "methodology_applications"("sourceKey");
CREATE INDEX "methodology_applications_assignmentId_status_idx" ON "methodology_applications"("assignmentId", "status");
ALTER TABLE "methodology_applications" ADD CONSTRAINT "methodology_applications_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "compliance_requirement_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "requirement_tasks" ADD COLUMN "methodologyApplicationId" TEXT;
CREATE INDEX "requirement_tasks_methodologyApplicationId_status_dueDate_idx" ON "requirement_tasks"("methodologyApplicationId", "status", "dueDate");
ALTER TABLE "requirement_tasks" ADD CONSTRAINT "requirement_tasks_methodologyApplicationId_fkey" FOREIGN KEY ("methodologyApplicationId") REFERENCES "methodology_applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;
