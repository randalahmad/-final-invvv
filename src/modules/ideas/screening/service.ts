import type { Prisma } from "@prisma/client";

import { prisma } from "@/server/db";
import { writeAudit, AUDIT } from "@/server/audit";
import type { AccessContext } from "@/server/access-context";
import { requirePermission, requireScope } from "@/server/authorization";
import { getIdeaScreeningProvider, IdeaScreeningProviderError, type IdeaScreeningContext } from "./provider";

const IDEA_VIEW = "idea.view" as const;

/**
 * Create (or reset) the QUEUED screening record for a submitted idea. Safe to
 * call inside the submit transaction -- mirrors
 * modules/document-analysis/service.ts's enqueueAnalysisRecord.
 */
export async function enqueueIdeaScreening(db: Prisma.TransactionClient, ideaId: string, actorUserId?: string | null) {
  await db.ideaScreening.upsert({
    where: { ideaId },
    update: { status: "QUEUED", queuedAt: new Date(), startedAt: null, completedAt: null, failedAt: null, error: null },
    create: { ideaId, status: "QUEUED" },
  });
  await writeAudit(
    { actorUserId: actorUserId ?? null, action: AUDIT.IDEA_SCREENING_QUEUED, entityType: "IDEA", entityId: ideaId, summary: "إدراج مهمة فحص آلي أولي" },
    db,
  );
}

async function buildScreeningContext(ideaId: string): Promise<IdeaScreeningContext> {
  const idea = await prisma.idea.findUniqueOrThrow({
    where: { id: ideaId },
    select: {
      id: true,
      titleAr: true,
      description: true,
      departmentId: true,
      department: { select: { id: true, nameAr: true } },
      activity: { select: { id: true, nameAr: true, type: true } },
    },
  });

  const siblings = idea.departmentId
    ? await prisma.idea.findMany({
        where: { departmentId: idea.departmentId, id: { not: ideaId }, archivedAt: null },
        select: { titleAr: true },
        take: 20,
        orderBy: { createdAt: "desc" },
      })
    : [];

  return {
    idea: { id: idea.id, titleAr: idea.titleAr, description: idea.description },
    department: idea.department,
    activity: idea.activity,
    siblingIdeaTitles: siblings.map((s) => s.titleAr),
  };
}

/**
 * Run the AI initial-screening pipeline for one idea.
 * QUEUED -> PROCESSING -> COMPLETED | FAILED. Never touches Idea.status, never
 * writes an IdeaEvaluation/IdeaDecision -- purely advisory (see
 * provider/types.ts's doc comment). A FAILED run (missing API key, network
 * error, malformed model output, ...) is expected and non-fatal: the idea
 * stays SUBMITTED and a human evaluator proceeds without an AI opinion.
 *
 * Called automatically right after submitIdea() commits -- not gated by a
 * separate permission check, since it runs as a side effect of an already-
 * authorized submission, attributed to that same actor for audit purposes.
 */
export async function runIdeaScreening(ideaId: string, actorUserId: string | null): Promise<{ status: "COMPLETED" | "FAILED" }> {
  const provider = getIdeaScreeningProvider();

  await prisma.$transaction(async (tx) => {
    await tx.ideaScreening.upsert({
      where: { ideaId },
      update: { status: "PROCESSING", startedAt: new Date(), provider: provider.name, model: provider.model, promptVersion: provider.promptVersion ?? null },
      create: { ideaId, status: "PROCESSING", startedAt: new Date(), provider: provider.name, model: provider.model, promptVersion: provider.promptVersion ?? null },
    });
    await writeAudit({ actorUserId, action: AUDIT.IDEA_SCREENING_STARTED, entityType: "IDEA", entityId: ideaId, summary: "بدء الفحص الآلي الأولي" }, tx);
  });

  try {
    const context = await buildScreeningContext(ideaId);
    const output = await provider.screen(context);

    await prisma.$transaction(async (tx) => {
      const screening = await tx.ideaScreening.findUniqueOrThrow({ where: { ideaId }, select: { id: true } });
      await tx.ideaScreeningFinding.deleteMany({ where: { screeningId: screening.id } });
      for (const f of output.findings) {
        await tx.ideaScreeningFinding.create({
          data: { screeningId: screening.id, criterionKey: f.criterionKey, labelAr: f.labelAr, verdict: f.verdict, noteAr: f.noteAr ?? null },
        });
      }
      await tx.ideaScreening.update({
        where: { ideaId },
        data: { status: "COMPLETED", completedAt: new Date(), score: output.score, recommendation: output.recommendation, summaryAr: output.summaryAr },
      });
      await writeAudit(
        {
          actorUserId,
          action: AUDIT.IDEA_SCREENING_COMPLETED,
          entityType: "IDEA",
          entityId: ideaId,
          summary: "اكتمل الفحص الآلي الأولي — توصية استشارية جاهزة للمراجعة",
          metadata: { recommendation: output.recommendation, score: output.score, provider: provider.name },
        },
        tx,
      );
    });
    return { status: "COMPLETED" };
  } catch (e) {
    const reason = e instanceof IdeaScreeningProviderError ? e.message : ((e as Error).message?.slice(0, 300) ?? "FAILED");
    await prisma.$transaction(async (tx) => {
      await tx.ideaScreening.update({ where: { ideaId }, data: { status: "FAILED", failedAt: new Date(), error: reason } });
      await writeAudit({ actorUserId, action: AUDIT.IDEA_SCREENING_FAILED, entityType: "IDEA", entityId: ideaId, summary: "فشل الفحص الآلي الأولي", metadata: { reason } }, tx);
    });
    return { status: "FAILED" };
  }
}

/** Read for the idea-detail/review UI. Same idea.view + scope gate as the rest of the idea surface. */
export async function getIdeaScreening(actor: AccessContext, ideaId: string) {
  requirePermission(actor, IDEA_VIEW);
  await requireScope(actor, "IDEA", ideaId);
  return prisma.ideaScreening.findUnique({
    where: { ideaId },
    include: { findings: { orderBy: { createdAt: "asc" } } },
  });
}

/** Evaluator acknowledgment -- purely informational (reviewedById/reviewedAt), never changes the recommendation or the idea. */
export async function markIdeaScreeningReviewed(actor: AccessContext, ideaId: string): Promise<void> {
  requirePermission(actor, "idea.evaluate");
  await requireScope(actor, "IDEA", ideaId);
  await prisma.$transaction(async (tx) => {
    const screening = await tx.ideaScreening.findUnique({ where: { ideaId }, select: { id: true } });
    if (!screening) return;
    await tx.ideaScreening.update({ where: { ideaId }, data: { reviewedById: actor.userId, reviewedAt: new Date() } });
    await writeAudit({ actorUserId: actor.userId, action: AUDIT.IDEA_SCREENING_REVIEWED, entityType: "IDEA", entityId: ideaId, summary: "تأكيد اطّلاع المُقيّم على نتيجة الفحص الآلي" }, tx);
  });
}
