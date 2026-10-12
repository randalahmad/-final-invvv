-- CreateEnum
CREATE TYPE "IdeaScreeningStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "IdeaScreeningRecommendation" AS ENUM ('PROCEED', 'NEEDS_INFO', 'REJECT');

-- CreateEnum
CREATE TYPE "IdeaScreeningVerdict" AS ENUM ('STRONG', 'ACCEPTABLE', 'WEAK', 'CONCERN');

-- CreateTable
CREATE TABLE "idea_screenings" (
    "id" TEXT NOT NULL,
    "ideaId" TEXT NOT NULL,
    "status" "IdeaScreeningStatus" NOT NULL DEFAULT 'QUEUED',
    "provider" TEXT,
    "model" TEXT,
    "promptVersion" TEXT,
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "error" TEXT,
    "score" INTEGER,
    "recommendation" "IdeaScreeningRecommendation",
    "summaryAr" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "idea_screenings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idea_screening_findings" (
    "id" TEXT NOT NULL,
    "screeningId" TEXT NOT NULL,
    "criterionKey" TEXT NOT NULL,
    "labelAr" TEXT NOT NULL,
    "verdict" "IdeaScreeningVerdict" NOT NULL,
    "noteAr" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idea_screening_findings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "idea_screenings_ideaId_key" ON "idea_screenings"("ideaId");

-- CreateIndex
CREATE INDEX "idea_screenings_status_idx" ON "idea_screenings"("status");

-- CreateIndex
CREATE INDEX "idea_screening_findings_screeningId_idx" ON "idea_screening_findings"("screeningId");

-- AddForeignKey
ALTER TABLE "idea_screenings" ADD CONSTRAINT "idea_screenings_ideaId_fkey" FOREIGN KEY ("ideaId") REFERENCES "ideas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idea_screening_findings" ADD CONSTRAINT "idea_screening_findings_screeningId_fkey" FOREIGN KEY ("screeningId") REFERENCES "idea_screenings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
