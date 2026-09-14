-- Human-triggered idea pre-screening only. The result is intentionally kept
-- outside official evaluations and decisions, so it cannot alter governance
-- state without a reviewer acting through the existing workflow.
CREATE TABLE "idea_analysis_suggestions" (
  "id" TEXT NOT NULL,
  "ideaId" TEXT NOT NULL,
  "score" INTEGER NOT NULL,
  "flags" JSONB NOT NULL,
  "provider" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "requestedById" TEXT,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "idea_analysis_suggestions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "idea_analysis_suggestions_ideaId_key" ON "idea_analysis_suggestions"("ideaId");
CREATE INDEX "idea_analysis_suggestions_generatedAt_idx" ON "idea_analysis_suggestions"("generatedAt");
ALTER TABLE "idea_analysis_suggestions"
  ADD CONSTRAINT "idea_analysis_suggestions_ideaId_fkey"
  FOREIGN KEY ("ideaId") REFERENCES "ideas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
