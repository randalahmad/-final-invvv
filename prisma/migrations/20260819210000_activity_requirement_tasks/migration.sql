-- Link the existing requirement task system to annual-plan activities.
-- Additive only: no existing task or activity data is changed.
ALTER TABLE "requirement_tasks" ADD COLUMN "activityId" TEXT;
ALTER TABLE "requirement_tasks" ADD COLUMN "sourceKey" TEXT;

CREATE UNIQUE INDEX "requirement_tasks_sourceKey_key" ON "requirement_tasks"("sourceKey");
CREATE INDEX "requirement_tasks_activityId_status_dueDate_idx" ON "requirement_tasks"("activityId", "status", "dueDate");

ALTER TABLE "requirement_tasks" ADD CONSTRAINT "requirement_tasks_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "innovation_activities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
