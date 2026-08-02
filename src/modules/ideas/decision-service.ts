import type { DecisionType, IdeaStatus, Prisma } from "@prisma/client";

import { prisma } from "@/server/db";
import { writeAudit, AUDIT } from "@/server/audit";
import type { AccessContext } from "@/server/access-context";
import {
  requirePermission,
  requireScope,
  effectiveScopes,
  supersedeDecisionInTransaction,
  reopenDecisionInTransaction,
} from "@/server/authorization";
import { decisionSchema, reasonSchema, supersedeSchema } from "./decision-schema";

export type DecisionErrorCode =
  | "VALIDATION"
  | "INVALID_TRANSITION"
  | "SELF_DECISION"
  | "NOT_FINALIZED"
  | "NOT_APPROVED"
  | "ALREADY_CONVERTED";

export class DecisionError extends Error {
  code: DecisionErrorCode;
  fieldErrors?: Record<string, string[]>;
  constructor(code: DecisionErrorCode, message?: string, fieldErrors?: Record<string, string[]>) {
    super(message ?? code);
    this.name = "DecisionError";
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

const DECIDE = "idea.decide" as const;
const VIEW = "idea.view" as const;

/** The author may never decide their own idea unless they hold PLATFORM scope. */
function assertNotSelf(actor: AccessContext, submittedById: string | null): void {
  if (submittedById === actor.userId && !effectiveScopes(actor).platform) {
    throw new DecisionError("SELF_DECISION", "لا يمكن اتخاذ قرار على فكرتك الخاصة");
  }
}

async function loadDecidable(actor: AccessContext, ideaId: string) {
  await requireScope(actor, "IDEA", ideaId); // NOT_FOUND / OUT_OF_SCOPE
  return prisma.idea.findUniqueOrThrow({
    where: { id: ideaId },
    select: { id: true, status: true, submittedById: true, departmentId: true },
  });
}

/** Create a FINALIZED decision + move the idea, atomically and audited. */
async function finalize(
  actor: AccessContext,
  idea: { id: string; status: IdeaStatus; departmentId: string | null },
  decision: DecisionType,
  newStatus: IdeaStatus,
  notes: string | undefined,
  action: string,
  summary: string,
): Promise<{ id: string }> {
  return prisma.$transaction(async (tx) => {
    const created = await tx.ideaDecision.create({
      data: {
        ideaId: idea.id,
        decidedById: actor.userId,
        decision,
        notes: notes?.trim() || null,
        finalizedAt: new Date(),
        finalizedById: actor.userId,
      },
      select: { id: true },
    });
    await tx.idea.update({ where: { id: idea.id }, data: { status: newStatus } });
    await writeAudit(
      {
        actorUserId: actor.userId,
        action,
        entityType: "IDEA",
        entityId: idea.id,
        departmentId: idea.departmentId,
        summary,
        before: { status: idea.status },
        after: { status: newStatus, decisionId: created.id },
      },
      tx,
    );
    return created;
  });
}

/** TECHNICAL_REVIEW → APPROVED_FOR_PILOT (finalized, immutable thereafter). */
export async function approveForPilot(actor: AccessContext, ideaId: string, raw: unknown = {}): Promise<{ id: string }> {
  requirePermission(actor, DECIDE);
  const idea = await loadDecidable(actor, ideaId);
  assertNotSelf(actor, idea.submittedById);
  const parsed = decisionSchema.safeParse(raw);
  if (!parsed.success) throw new DecisionError("VALIDATION", "invalid", parsed.error.flatten().fieldErrors);
  if (idea.status !== "TECHNICAL_REVIEW") throw new DecisionError("INVALID_TRANSITION", "الاعتماد متاح فقط من المراجعة الفنية");
  return finalize(actor, idea, "APPROVE_FOR_PILOT", "APPROVED_FOR_PILOT", parsed.data.notes, AUDIT.IDEA_DECISION_APPROVED, "اعتماد الفكرة للتجريب");
}

/** TECHNICAL_REVIEW → REJECTED (finalized, immutable thereafter). */
export async function rejectIdea(actor: AccessContext, ideaId: string, raw: unknown = {}): Promise<{ id: string }> {
  requirePermission(actor, DECIDE);
  const idea = await loadDecidable(actor, ideaId);
  assertNotSelf(actor, idea.submittedById);
  const parsed = decisionSchema.safeParse(raw);
  if (!parsed.success) throw new DecisionError("VALIDATION", "invalid", parsed.error.flatten().fieldErrors);
  if (idea.status !== "TECHNICAL_REVIEW") throw new DecisionError("INVALID_TRANSITION", "الرفض متاح فقط من المراجعة الفنية");
  return finalize(actor, idea, "REJECT", "REJECTED", parsed.data.notes, AUDIT.IDEA_DECISION_REJECTED, "رفض الفكرة");
}

/** Full decision history (newest first), including superseded/reopened entries. */
export async function getIdeaDecisionHistory(actor: AccessContext, ideaId: string) {
  requirePermission(actor, VIEW);
  await requireScope(actor, "IDEA", ideaId);
  return prisma.ideaDecision.findMany({
    where: { ideaId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      decision: true,
      notes: true,
      finalizedAt: true,
      supersedesId: true,
      reopenedAt: true,
      reopenReason: true,
      createdAt: true,
      decidedBy: { select: { name: true } },
    },
  });
}

async function loadFinalizedDecision(ideaId: string, decisionId: string) {
  const decision = await prisma.ideaDecision.findUnique({
    where: { id: decisionId },
    select: { id: true, ideaId: true, finalizedAt: true },
  });
  if (!decision || decision.ideaId !== ideaId) throw new DecisionError("INVALID_TRANSITION", "القرار غير مرتبط بهذه الفكرة");
  if (!decision.finalizedAt) throw new DecisionError("NOT_FINALIZED", "القرار غير نهائي");
  return decision;
}

/**
 * Documented reopening of a finalized decision — performed ONLY through the
 * Phase 2C immutability guard (`reopenDecision`), which clears finalization,
 * records who/why, and audits. Requires a reason. The idea returns to
 * TECHNICAL_REVIEW so it can be decided again.
 */
export async function reopenIdeaDecision(actor: AccessContext, ideaId: string, decisionId: string, raw: unknown): Promise<void> {
  requirePermission(actor, DECIDE);
  const idea = await loadDecidable(actor, ideaId);
  const parsed = reasonSchema.safeParse(raw);
  if (!parsed.success) throw new DecisionError("VALIDATION", "invalid", parsed.error.flatten().fieldErrors);
  if (idea.status === "CONVERTED_TO_SOLUTION") throw new DecisionError("ALREADY_CONVERTED", "لا يمكن إعادة الفتح بعد التحويل إلى حل");
  await loadFinalizedDecision(ideaId, decisionId);

  await prisma.$transaction(async (tx) => {
    const reopened = await reopenDecisionInTransaction(actor, decisionId, parsed.data.reason, tx);
    if (reopened.ideaId !== ideaId) {
      throw new DecisionError("INVALID_TRANSITION", "القرار غير مرتبط بهذه الفكرة");
    }
    await tx.idea.update({ where: { id: ideaId }, data: { status: "TECHNICAL_REVIEW" } });
  });
}

/**
 * Supersede a finalized decision with a corrected one — through the Phase 2C
 * guard (`supersedeDecision`), preserving the original. Requires a reason.
 */
export async function supersedeIdeaDecision(
  actor: AccessContext,
  ideaId: string,
  originalDecisionId: string,
  raw: unknown,
): Promise<{ id: string }> {
  requirePermission(actor, DECIDE);
  const idea = await loadDecidable(actor, ideaId);
  assertNotSelf(actor, idea.submittedById);
  const parsed = supersedeSchema.safeParse(raw);
  if (!parsed.success) throw new DecisionError("VALIDATION", "invalid", parsed.error.flatten().fieldErrors);
  if (idea.status === "CONVERTED_TO_SOLUTION") throw new DecisionError("ALREADY_CONVERTED", "لا يمكن التصحيح بعد التحويل إلى حل");
  await loadFinalizedDecision(ideaId, originalDecisionId);

  return prisma.$transaction(async (tx) => {
    const created = await supersedeDecisionInTransaction(
      actor,
      originalDecisionId,
      {
        decision: parsed.data.decision,
        notes: parsed.data.reason,
        finalize: true,
      },
      tx,
    );
    if (created.ideaId !== ideaId) {
      throw new DecisionError("INVALID_TRANSITION", "القرار غير مرتبط بهذه الفكرة");
    }
    const newStatus: IdeaStatus = parsed.data.decision === "APPROVE_FOR_PILOT" ? "APPROVED_FOR_PILOT" : "REJECTED";
    await tx.idea.update({ where: { id: ideaId }, data: { status: newStatus } });
    return { id: created.id };
  });
}

/** UI flags only — every action re-enforces server-side. */
export function computeDecisionFlags(
  actor: AccessContext,
  idea: { status: IdeaStatus; submittedById: string | null },
  perms: { decide: boolean; createSolution: boolean },
) {
  const platform = effectiveScopes(actor).platform;
  const isAuthor = idea.submittedById === actor.userId;
  const mayDecide = perms.decide && (!isAuthor || platform);
  const finalized = idea.status === "APPROVED_FOR_PILOT" || idea.status === "REJECTED";
  return {
    canApprove: mayDecide && idea.status === "TECHNICAL_REVIEW",
    canReject: mayDecide && idea.status === "TECHNICAL_REVIEW",
    canConvert: mayDecide && perms.createSolution && idea.status === "APPROVED_FOR_PILOT",
    canReopen: mayDecide && finalized,
    canSupersede: mayDecide && finalized,
  };
}

export type DecisionFlags = ReturnType<typeof computeDecisionFlags>;

/** Prisma type helper for the history rows (used by the UI component). */
export type DecisionHistoryRow = Prisma.PromiseReturnType<typeof getIdeaDecisionHistory>[number];
