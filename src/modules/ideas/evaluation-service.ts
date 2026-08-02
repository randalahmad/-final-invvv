import type { IdeaStatus } from "@prisma/client";

import { prisma } from "@/server/db";
import { writeAudit, AUDIT } from "@/server/audit";
import type { AccessContext } from "@/server/access-context";
import { requirePermission, requireScope, effectiveScopes, AuthorizationError } from "@/server/authorization";
import { evaluationSchema, infoRequestSchema, infoResponseSchema } from "./evaluation-schema";

/** Business-rule failures for the review workflow (authz uses AuthorizationError). */
export type EvalErrorCode =
  | "VALIDATION"
  | "INVALID_TRANSITION"
  | "INVALID_STAGE"
  | "SELF_EVALUATION"
  | "NOT_AUTHOR"
  | "NO_OPEN_REQUEST";
export class EvaluationError extends Error {
  code: EvalErrorCode;
  fieldErrors?: Record<string, string[]>;
  constructor(code: EvalErrorCode, message?: string, fieldErrors?: Record<string, string[]>) {
    super(message ?? code);
    this.name = "EvaluationError";
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

const IDEA_EVALUATE = "idea.evaluate" as const;
const IDEA_VIEW = "idea.view" as const;

function isPlatform(ctx: AccessContext): boolean {
  return effectiveScopes(ctx).platform;
}

/**
 * Load an idea for a REVIEWER action: requires idea.evaluate, in-scope, and the
 * caller is NOT the author (separation of duties) unless platform-authorized.
 */
async function loadForReview(actor: AccessContext, ideaId: string) {
  requirePermission(actor, IDEA_EVALUATE);
  await requireScope(actor, "IDEA", ideaId);
  const idea = await prisma.idea.findUniqueOrThrow({
    where: { id: ideaId },
    select: { id: true, status: true, submittedById: true, departmentId: true },
  });
  if (idea.submittedById === actor.userId && !isPlatform(actor)) {
    throw new EvaluationError("SELF_EVALUATION", "لا يمكن لصاحب الفكرة تقييم فكرته");
  }
  return idea;
}

async function setStatus(actor: AccessContext, ideaId: string, from: IdeaStatus, to: IdeaStatus, action: string, summary: string) {
  await prisma.$transaction(async (tx) => {
    await tx.idea.update({ where: { id: ideaId }, data: { status: to } });
    await writeAudit(
      { actorUserId: actor.userId, action, entityType: "IDEA", entityId: ideaId, summary, before: { status: from }, after: { status: to } },
      tx,
    );
  });
}

/** SUBMITTED → INITIAL_REVIEW. */
export async function startInitialReview(actor: AccessContext, ideaId: string): Promise<void> {
  const idea = await loadForReview(actor, ideaId);
  if (idea.status !== "SUBMITTED") throw new EvaluationError("INVALID_TRANSITION", "لا يمكن بدء المراجعة من الحالة الحالية");
  await setStatus(actor, ideaId, "SUBMITTED", "INITIAL_REVIEW", AUDIT.IDEA_REVIEW_STARTED, "بدء المراجعة الأولية");
}

/** Record an INITIAL-stage evaluation (append-only; status unchanged). */
export async function submitInitialEvaluation(actor: AccessContext, ideaId: string, raw: unknown): Promise<{ id: string }> {
  const idea = await loadForReview(actor, ideaId);
  if (idea.status !== "INITIAL_REVIEW") throw new EvaluationError("INVALID_STAGE", "التقييم الأولي متاح فقط في مرحلة المراجعة الأولية");
  return recordEvaluation(actor, ideaId, "INITIAL", raw);
}

/** INITIAL_REVIEW → TECHNICAL_REVIEW. */
export async function advanceToTechnicalReview(actor: AccessContext, ideaId: string): Promise<void> {
  const idea = await loadForReview(actor, ideaId);
  if (idea.status !== "INITIAL_REVIEW") throw new EvaluationError("INVALID_TRANSITION", "الانتقال للمراجعة الفنية متاح فقط من المراجعة الأولية");
  await setStatus(actor, ideaId, "INITIAL_REVIEW", "TECHNICAL_REVIEW", AUDIT.IDEA_ADVANCED_TO_TECHNICAL, "الانتقال للمراجعة الفنية");
}

/** Record a TECHNICAL-stage evaluation (append-only; status unchanged). */
export async function submitTechnicalEvaluation(actor: AccessContext, ideaId: string, raw: unknown): Promise<{ id: string }> {
  const idea = await loadForReview(actor, ideaId);
  if (idea.status !== "TECHNICAL_REVIEW") throw new EvaluationError("INVALID_STAGE", "التقييم الفني متاح فقط في مرحلة المراجعة الفنية");
  return recordEvaluation(actor, ideaId, "TECHNICAL", raw);
}

async function recordEvaluation(actor: AccessContext, ideaId: string, stage: "INITIAL" | "TECHNICAL", raw: unknown) {
  const parsed = evaluationSchema.safeParse(raw);
  if (!parsed.success) throw new EvaluationError("VALIDATION", "invalid", parsed.error.flatten().fieldErrors);
  const { comments, score } = parsed.data;
  return prisma.$transaction(async (tx) => {
    const created = await tx.ideaEvaluation.create({
      data: { ideaId, evaluatorId: actor.userId, stage, notes: comments, score: score ?? null },
      select: { id: true },
    });
    await writeAudit(
      {
        actorUserId: actor.userId,
        action: AUDIT.IDEA_EVALUATION_SUBMITTED,
        entityType: "IDEA",
        entityId: ideaId,
        summary: "تسجيل تقييم",
        metadata: { stage, evaluationId: created.id },
      },
      tx,
    );
    return created;
  });
}

/** INITIAL_REVIEW | TECHNICAL_REVIEW → MORE_INFO_REQUESTED (stores requester + requestedAt). */
export async function requestMoreInformation(actor: AccessContext, ideaId: string, raw: unknown): Promise<{ id: string }> {
  const idea = await loadForReview(actor, ideaId);
  if (idea.status !== "INITIAL_REVIEW" && idea.status !== "TECHNICAL_REVIEW") {
    throw new EvaluationError("INVALID_TRANSITION", "طلب معلومات متاح فقط أثناء المراجعة");
  }
  const parsed = infoRequestSchema.safeParse(raw);
  if (!parsed.success) throw new EvaluationError("VALIDATION", "invalid", parsed.error.flatten().fieldErrors);

  return prisma.$transaction(async (tx) => {
    const req = await tx.ideaInfoRequest.create({
      data: { ideaId, requestedById: actor.userId, requestedInfo: parsed.data.requestedInfo, status: "OPEN" },
      select: { id: true },
    });
    await tx.idea.update({ where: { id: ideaId }, data: { status: "MORE_INFO_REQUESTED" } });
    await writeAudit(
      {
        actorUserId: actor.userId,
        action: AUDIT.IDEA_MORE_INFO_REQUESTED,
        entityType: "IDEA",
        entityId: ideaId,
        summary: "طلب معلومات إضافية",
        before: { status: idea.status },
        after: { status: "MORE_INFO_REQUESTED" },
        metadata: { infoRequestId: req.id },
      },
      tx,
    );
    return req;
  });
}

/**
 * Author responds to the open info request and returns the idea to review.
 * Only the requested-information RESPONSE is stored — the submitted idea is not
 * overwritten. MORE_INFO_REQUESTED → INITIAL_REVIEW (re-enters review).
 */
export async function resubmitRequestedInformation(actor: AccessContext, ideaId: string, raw: unknown): Promise<void> {
  requirePermission(actor, IDEA_VIEW);
  await requireScope(actor, "IDEA", ideaId);
  const idea = await prisma.idea.findUniqueOrThrow({ where: { id: ideaId }, select: { id: true, status: true, submittedById: true } });
  if (idea.submittedById !== actor.userId && !isPlatform(actor)) throw new EvaluationError("NOT_AUTHOR", "الرد من صلاحية صاحب الفكرة");
  if (idea.status !== "MORE_INFO_REQUESTED") throw new EvaluationError("INVALID_TRANSITION", "لا يوجد طلب معلومات مفتوح");

  const parsed = infoResponseSchema.safeParse(raw);
  if (!parsed.success) throw new EvaluationError("VALIDATION", "invalid", parsed.error.flatten().fieldErrors);

  const open = await prisma.ideaInfoRequest.findFirst({ where: { ideaId, status: "OPEN" }, orderBy: { requestedAt: "desc" }, select: { id: true } });
  if (!open) throw new EvaluationError("NO_OPEN_REQUEST", "لا يوجد طلب معلومات مفتوح");

  await prisma.$transaction(async (tx) => {
    await tx.ideaInfoRequest.update({
      where: { id: open.id },
      data: { responseText: parsed.data.responseText, respondedById: actor.userId, respondedAt: new Date(), status: "ANSWERED" },
    });
    await tx.idea.update({ where: { id: ideaId }, data: { status: "INITIAL_REVIEW" } });
    await writeAudit(
      {
        actorUserId: actor.userId,
        action: AUDIT.IDEA_INFO_RESUBMITTED,
        entityType: "IDEA",
        entityId: ideaId,
        summary: "رد صاحب الفكرة على طلب المعلومات",
        before: { status: "MORE_INFO_REQUESTED" },
        after: { status: "INITIAL_REVIEW" },
        metadata: { infoRequestId: open.id },
      },
      tx,
    );
  });
}

// ── Reads ──────────────────────────────────────────────────────────────────

/** All evaluations for an idea (scope-enforced). Append-only history, newest first. */
export async function listIdeaEvaluations(actor: AccessContext, ideaId: string) {
  requirePermission(actor, IDEA_VIEW);
  await requireScope(actor, "IDEA", ideaId);
  return prisma.ideaEvaluation.findMany({
    where: { ideaId },
    orderBy: { createdAt: "desc" },
    select: { id: true, stage: true, score: true, notes: true, createdAt: true, evaluator: { select: { name: true } } },
  });
}

/** All info requests + responses for an idea (scope-enforced). */
export async function listInfoRequests(actor: AccessContext, ideaId: string) {
  requirePermission(actor, IDEA_VIEW);
  await requireScope(actor, "IDEA", ideaId);
  return prisma.ideaInfoRequest.findMany({
    where: { ideaId },
    orderBy: { requestedAt: "desc" },
    select: { id: true, requestedInfo: true, requestedAt: true, responseText: true, respondedAt: true, status: true },
  });
}

/** Details of a single evaluation (scope-enforced via its idea). */
export async function getEvaluationDetails(actor: AccessContext, evaluationId: string) {
  requirePermission(actor, IDEA_VIEW);
  const evaluation = await prisma.ideaEvaluation.findUnique({
    where: { id: evaluationId },
    select: { id: true, ideaId: true, stage: true, score: true, notes: true, createdAt: true, evaluator: { select: { name: true } } },
  });
  if (!evaluation) throw new AuthorizationError("NOT_FOUND");
  await requireScope(actor, "IDEA", evaluation.ideaId);
  return evaluation;
}

/** UI flags for the review panel (display only; every action re-enforces server-side). */
export function computeReviewFlags(
  actor: AccessContext,
  idea: { status: IdeaStatus; submittedById: string | null },
  hasEvaluate: boolean,
) {
  const platform = isPlatform(actor);
  const isAuthor = idea.submittedById === actor.userId;
  const canReview = hasEvaluate && (!isAuthor || platform); // reviewer, not the author (unless admin)
  const s = idea.status;
  return {
    canStartInitial: canReview && s === "SUBMITTED",
    canSubmitInitial: canReview && s === "INITIAL_REVIEW",
    canAdvanceTechnical: canReview && s === "INITIAL_REVIEW",
    canSubmitTechnical: canReview && s === "TECHNICAL_REVIEW",
    canRequestInfo: canReview && (s === "INITIAL_REVIEW" || s === "TECHNICAL_REVIEW"),
    canRespondInfo: s === "MORE_INFO_REQUESTED" && (isAuthor || platform),
  };
}
