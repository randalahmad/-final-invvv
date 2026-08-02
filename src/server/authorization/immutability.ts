import type { DecisionType, Prisma } from "@prisma/client";

import { prisma } from "@/server/db";
import { writeAudit, AUDIT } from "@/server/audit";
import { AuthorizationError } from "./errors";
import { requirePermission, type Principal } from "./permission";

/**
 * Layer 5 — immutability. A FINALIZED IdeaDecision and a VERIFIED
 * ImpactMeasurement are write-protected: no silent overwrite. Changes go only
 * through the sanctioned paths below (superseding record / documented
 * reopening), each of which preserves history and writes an AuditLog entry.
 */
export type ImmutableKind = "IDEA_DECISION" | "IMPACT_MEASUREMENT";

export function isFinalizedDecision(d: { finalizedAt: Date | null }): boolean {
  return d.finalizedAt != null;
}
export function isVerifiedMeasurement(m: { verificationStatus: string }): boolean {
  return m.verificationStatus === "VERIFIED";
}

/** Throw IMMUTABLE if the record is finalized/verified (blocks in-place edits). */
export function assertMutable(
  kind: ImmutableKind,
  record: { finalizedAt?: Date | null; verificationStatus?: string },
): void {
  if (kind === "IDEA_DECISION" && isFinalizedDecision({ finalizedAt: record.finalizedAt ?? null })) {
    throw new AuthorizationError("IMMUTABLE", "finalized decision cannot be edited in place");
  }
  if (kind === "IMPACT_MEASUREMENT" && isVerifiedMeasurement({ verificationStatus: record.verificationStatus ?? "" })) {
    throw new AuthorizationError("IMMUTABLE", "verified measurement cannot be edited in place");
  }
}

// ── Sanctioned change paths ────────────────────────────────────────────────

/** Supersede a finalized decision with a new one (original preserved, audited). */
export async function supersedeDecisionInTransaction(
  actor: Principal,
  originalId: string,
  data: { decision: DecisionType; notes?: string; finalize?: boolean },
  tx: Prisma.TransactionClient,
): Promise<{ id: string; ideaId: string }> {
  requirePermission(actor, "idea.decide");
  const original = await tx.ideaDecision.findUnique({
    where: { id: originalId },
    select: { id: true, ideaId: true },
  });
  if (!original) throw new AuthorizationError("NOT_FOUND");
  const created = await tx.ideaDecision.create({
    data: {
      ideaId: original.ideaId,
      decision: data.decision,
      notes: data.notes ?? null,
      supersedesId: original.id,
      decidedById: actor.userId,
      finalizedAt: data.finalize ? new Date() : null,
      finalizedById: data.finalize ? actor.userId : null,
    },
    select: { id: true },
  });
  await writeAudit(
    {
      actorUserId: actor.userId,
      action: AUDIT.DECISION_SUPERSEDED,
      entityType: "IDEA",
      entityId: original.ideaId,
      summary: "قرار جديد يَنسخ قرارًا سابقًا",
      metadata: { decisionId: created.id, supersedesDecisionId: original.id },
    },
    tx,
  );
  return { id: created.id, ideaId: original.ideaId };
}

export async function supersedeDecision(
  actor: Principal,
  originalId: string,
  data: { decision: DecisionType; notes?: string; finalize?: boolean },
): Promise<{ id: string }> {
  return prisma.$transaction(async (tx) => {
    const created = await supersedeDecisionInTransaction(actor, originalId, data, tx);
    return { id: created.id };
  });
}

/** Documented reopening of a finalized decision (clears finalization, audited). */
export async function reopenDecisionInTransaction(
  actor: Principal,
  decisionId: string,
  reason: string,
  tx: Prisma.TransactionClient,
): Promise<{ ideaId: string }> {
  requirePermission(actor, "idea.decide");
  const decision = await tx.ideaDecision.findUnique({
    where: { id: decisionId },
    select: { id: true, ideaId: true, finalizedAt: true },
  });
  if (!decision) throw new AuthorizationError("NOT_FOUND");
  await tx.ideaDecision.update({
    where: { id: decisionId },
    data: { finalizedAt: null, reopenedAt: new Date(), reopenedById: actor.userId, reopenReason: reason },
  });
  await writeAudit(
    {
      actorUserId: actor.userId,
      action: AUDIT.DECISION_REOPENED,
      entityType: "IDEA",
      entityId: decision.ideaId,
      summary: "إعادة فتح قرار",
      metadata: { decisionId, reason },
    },
    tx,
  );
  return { ideaId: decision.ideaId };
}

export async function reopenDecision(actor: Principal, decisionId: string, reason: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await reopenDecisionInTransaction(actor, decisionId, reason, tx);
  });
}

/** Supersede a verified measurement with a new one (original preserved, audited). */
export async function supersedeMeasurement(
  actor: Principal,
  originalId: string,
  data: { actualValue?: string; notes?: string },
): Promise<{ id: string }> {
  requirePermission(actor, "impact.verify");
  return prisma.$transaction(async (tx) => {
    const original = await tx.impactMeasurement.findUnique({
      where: { id: originalId },
      select: { id: true, indicatorId: true },
    });
    if (!original) throw new AuthorizationError("NOT_FOUND");
    const created = await tx.impactMeasurement.create({
      data: {
        indicatorId: original.indicatorId,
        actualValue: data.actualValue ?? null,
        notes: data.notes ?? null,
        supersedesId: original.id,
        verificationStatus: "UNVERIFIED",
      },
      select: { id: true },
    });
    await writeAudit(
      {
        actorUserId: actor.userId,
        action: AUDIT.MEASUREMENT_SUPERSEDED,
        entityType: "IMPACT_MEASUREMENT",
        entityId: original.id,
        summary: "قياس جديد يَنسخ قياسًا مُتحقّقًا",
        metadata: { measurementId: created.id, supersedesMeasurementId: original.id },
      },
      tx,
    );
    return created;
  });
}

/** Documented reopening of a verified measurement (back to PENDING, audited). */
export async function reopenMeasurement(actor: Principal, measurementId: string, reason: string): Promise<void> {
  requirePermission(actor, "impact.verify");
  await prisma.$transaction(async (tx) => {
    const m = await tx.impactMeasurement.findUnique({
      where: { id: measurementId },
      select: { id: true, verificationStatus: true },
    });
    if (!m) throw new AuthorizationError("NOT_FOUND");
    await tx.impactMeasurement.update({
      where: { id: measurementId },
      data: {
        verificationStatus: "PENDING",
        verifiedAt: null,
        verifiedById: null,
        reopenedAt: new Date(),
        reopenedById: actor.userId,
        reopenReason: reason,
      },
    });
    await writeAudit(
      {
        actorUserId: actor.userId,
        action: AUDIT.MEASUREMENT_REOPENED,
        entityType: "IMPACT_MEASUREMENT",
        entityId: measurementId,
        summary: "إعادة فتح قياس مُتحقّق",
        metadata: { measurementId, reason },
      },
      tx,
    );
  });
}
