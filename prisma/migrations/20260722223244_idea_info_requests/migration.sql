-- CreateEnum
CREATE TYPE "InfoRequestStatus" AS ENUM ('OPEN', 'ANSWERED');

-- CreateTable
CREATE TABLE "idea_info_requests" (
    "id" TEXT NOT NULL,
    "ideaId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "requestedInfo" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responseText" TEXT,
    "respondedById" TEXT,
    "respondedAt" TIMESTAMP(3),
    "status" "InfoRequestStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "idea_info_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idea_info_requests_ideaId_status_idx" ON "idea_info_requests"("ideaId", "status");

-- AddForeignKey
ALTER TABLE "idea_info_requests" ADD CONSTRAINT "idea_info_requests_ideaId_fkey" FOREIGN KEY ("ideaId") REFERENCES "ideas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
