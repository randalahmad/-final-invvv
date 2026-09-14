import type { Prisma } from "@prisma/client";

import type { AccessContext } from "@/server/access-context";
import { requirePermission, requireScope, effectiveScopes } from "@/server/authorization";
import { prisma } from "@/server/db";
import { writeAudit, AUDIT } from "@/server/audit";
import { getIdeaAnalysisProvider } from "./provider";

const IDEA_EVALUATE = "idea.evaluate" as const;

export class IdeaAnalysisError extends Error {
  constructor(readonly code: "NOT_FOUND" | "SELF_EVALUATION", message?: string) {
    super(message ?? code);
    this.name = "IdeaAnalysisError";
  }
}

async function loadForAnalysis(actor: AccessContext, ideaId: string) {
  requirePermission(actor, IDEA_EVALUATE);
  await requireScope(actor, "IDEA", ideaId);
  const idea = await prisma.idea.findUniqueOrThrow({
    where: { id: ideaId },
    select: { id: true, titleAr: true, description: true, activityId: true, departmentId: true, submittedById: true },
  });
  if (idea.submittedById === actor.userId && !effectiveScopes(actor).platform) {
    throw new IdeaAnalysisError("SELF_EVALUATION", "لا يمكن لصاحب الفكرة طلب تحليل لفكرته");
  }
  return idea;
}

/** Generates a separate, human-review-only pre-screening suggestion. */
export async function runIdeaAnalysis(actor: AccessContext, ideaId: string) {
  const idea = await loadForAnalysis(actor, ideaId);
  const [comparableIdeas, evidenceCount] = await Promise.all([
    idea.departmentId
      ? prisma.idea.findMany({
          where: { departmentId: idea.departmentId, id: { not: idea.id }, status: { not: "ARCHIVED" } },
          select: { id: true, titleAr: true, description: true },
          take: 100,
        })
      : Promise.resolve([]),
    prisma.evidenceLink.count({ where: { entityType: "IDEA", entityId: idea.id, evidence: { archivedAt: null } } }),
  ]);
  const provider = getIdeaAnalysisProvider();
  const output = await provider.analyze({ idea, comparableIdeas, evidenceCount });

  return prisma.$transaction(async (tx) => {
    const suggestion = await tx.ideaAnalysisSuggestion.upsert({
      where: { ideaId: idea.id },
      create: { ideaId: idea.id, score: output.score, flags: output.flags as Prisma.InputJsonValue, provider: provider.name, model: provider.model, requestedById: actor.userId },
      update: { score: output.score, flags: output.flags as Prisma.InputJsonValue, provider: provider.name, model: provider.model, requestedById: actor.userId, generatedAt: new Date() },
      select: { id: true, score: true, flags: true, provider: true, model: true, generatedAt: true },
    });
    await writeAudit({
      actorUserId: actor.userId,
      action: AUDIT.IDEA_ANALYSIS_GENERATED,
      entityType: "IDEA",
      entityId: idea.id,
      departmentId: idea.departmentId,
      summary: "إنشاء تحليل أولي مساعد للفكرة",
      metadata: { suggestionId: suggestion.id, provider: provider.name, model: provider.model, score: output.score, flags: output.flags.length },
    }, tx);
    return suggestion;
  });
}

export async function getIdeaAnalysis(actor: AccessContext, ideaId: string) {
  await loadForAnalysis(actor, ideaId);
  return prisma.ideaAnalysisSuggestion.findUnique({
    where: { ideaId },
    select: { id: true, score: true, flags: true, provider: true, model: true, generatedAt: true },
  });
}
