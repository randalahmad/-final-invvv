import type { ImplementationStatus, MaturityStage, RecordStatus } from "@prisma/client";

import { prisma } from "@/server/db";
import { writeAudit, AUDIT } from "@/server/audit";
import type { AccessContext } from "@/server/access-context";
import { requirePermission, requireScope } from "@/server/authorization";
import { SolutionError } from "./service";

const UPDATE = "solution.update" as const;

/**
 * Record lifecycle (status-definitions.md §3): DRAFT → ACTIVE → ARCHIVED,
 * DRAFT → ARCHIVED. ARCHIVED is terminal (archiving itself lives in
 * `archiveSolution`, which also withdraws publication).
 */
export const RECORD_TRANSITIONS: Record<RecordStatus, RecordStatus[]> = {
  DRAFT: ["ACTIVE", "ARCHIVED"],
  ACTIVE: ["ARCHIVED"],
  ARCHIVED: [],
};

/**
 * Implementation lifecycle (§8): PLANNING → IN_PROGRESS → OPERATING →
 * COMPLETED; any active → ON_HOLD / CANCELLED; ON_HOLD → IN_PROGRESS.
 * COMPLETED and CANCELLED are terminal.
 */
export const IMPLEMENTATION_TRANSITIONS: Record<ImplementationStatus, ImplementationStatus[]> = {
  PLANNING: ["IN_PROGRESS", "ON_HOLD", "CANCELLED"],
  IN_PROGRESS: ["OPERATING", "ON_HOLD", "CANCELLED"],
  OPERATING: ["COMPLETED", "ON_HOLD", "CANCELLED"],
  ON_HOLD: ["IN_PROGRESS", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

/** Maturity ladder (§7). Forward one step only; regression needs a reason. */
export const MATURITY_ORDER: MaturityStage[] = ["CONCEPT", "PROTOTYPE", "POC", "PILOT", "OPERATIONAL"];

/** Fields that must be present before a solution may be published. */
export const PUBLISH_REQUIRED_FIELDS: { key: string; label: string }[] = [
  { key: "nameAr", label: "اسم الحل" },
  { key: "description", label: "الوصف" },
  { key: "problemStatement", label: "وصف المشكلة" },
  { key: "owningDepartmentId", label: "الإدارة المالكة" },
  { key: "ownerUserId", label: "المسؤول عن الحل" },
];

async function loadForLifecycle(actor: AccessContext, solutionId: string) {
  requirePermission(actor, UPDATE);
  await requireScope(actor, "INNOVATION_SOLUTION", solutionId);
  return prisma.innovationSolution.findUniqueOrThrow({
    where: { id: solutionId },
    select: {
      id: true, status: true, maturityStage: true, implementationStatus: true, publishedAt: true,
      owningDepartmentId: true, nameAr: true, description: true, problemStatement: true, ownerUserId: true,
    },
  });
}

/** ARCHIVED records are write-protected for every lifecycle change. */
function assertNotArchived(status: RecordStatus) {
  if (status === "ARCHIVED") throw new SolutionError("INVALID_TRANSITION", "السجل مؤرشف ولا يقبل التغيير");
}

// ── Record status ──────────────────────────────────────────────────────────

export async function changeRecordStatus(actor: AccessContext, solutionId: string, to: RecordStatus): Promise<void> {
  const s = await loadForLifecycle(actor, solutionId);
  assertNotArchived(s.status);
  if (!RECORD_TRANSITIONS[s.status].includes(to)) {
    throw new SolutionError("INVALID_TRANSITION", "انتقال غير مسموح لحالة السجل");
  }
  await prisma.$transaction(async (tx) => {
    await tx.innovationSolution.update({
      where: { id: solutionId },
      // Leaving ACTIVE always withdraws publication.
      data: to === "ARCHIVED" ? { status: to, archivedAt: new Date(), archivedById: actor.userId, publishedAt: null } : { status: to },
    });
    await writeAudit(
      {
        actorUserId: actor.userId,
        action: AUDIT.SOLUTION_STATUS_CHANGED,
        entityType: "INNOVATION_SOLUTION",
        entityId: solutionId,
        departmentId: s.owningDepartmentId,
        summary: "تغيير حالة سجل الحل",
        before: { status: s.status },
        after: { status: to },
      },
      tx,
    );
  });
}

// ── Implementation status ──────────────────────────────────────────────────

export async function changeImplementationStatus(
  actor: AccessContext,
  solutionId: string,
  to: ImplementationStatus,
): Promise<void> {
  const s = await loadForLifecycle(actor, solutionId);
  assertNotArchived(s.status);
  if (!IMPLEMENTATION_TRANSITIONS[s.implementationStatus].includes(to)) {
    throw new SolutionError("INVALID_TRANSITION", "انتقال غير مسموح لحالة التنفيذ");
  }
  await prisma.$transaction(async (tx) => {
    await tx.innovationSolution.update({ where: { id: solutionId }, data: { implementationStatus: to } });
    await writeAudit(
      {
        actorUserId: actor.userId,
        action: AUDIT.SOLUTION_IMPLEMENTATION_CHANGED,
        entityType: "INNOVATION_SOLUTION",
        entityId: solutionId,
        departmentId: s.owningDepartmentId,
        summary: "تغيير حالة التنفيذ",
        before: { implementationStatus: s.implementationStatus },
        after: { implementationStatus: to },
      },
      tx,
    );
  });
}

// ── Maturity stage ─────────────────────────────────────────────────────────

/**
 * Advance one step, or regress with a documented reason (§7: "regression
 * allowed with audit note"). Arbitrary forward jumps are rejected.
 */
export async function changeMaturityStage(
  actor: AccessContext,
  solutionId: string,
  to: MaturityStage,
  reason?: string,
): Promise<void> {
  const s = await loadForLifecycle(actor, solutionId);
  assertNotArchived(s.status);

  const from = s.maturityStage;
  const fromIdx = MATURITY_ORDER.indexOf(from);
  const toIdx = MATURITY_ORDER.indexOf(to);
  if (toIdx < 0 || toIdx === fromIdx) throw new SolutionError("INVALID_TRANSITION", "مرحلة النضج غير صالحة");

  const isRegression = toIdx < fromIdx;
  if (!isRegression && toIdx !== fromIdx + 1) {
    throw new SolutionError("INVALID_TRANSITION", "لا يمكن تخطي مراحل النضج");
  }
  const note = reason?.trim();
  if (isRegression && (!note || note.length < 5)) {
    throw new SolutionError("REASON_REQUIRED", "التراجع في مرحلة النضج يتطلب سببًا موثّقًا");
  }

  await prisma.$transaction(async (tx) => {
    await tx.innovationSolution.update({ where: { id: solutionId }, data: { maturityStage: to } });
    await writeAudit(
      {
        actorUserId: actor.userId,
        action: AUDIT.SOLUTION_MATURITY_CHANGED,
        entityType: "INNOVATION_SOLUTION",
        entityId: solutionId,
        departmentId: s.owningDepartmentId,
        summary: isRegression ? "تراجع في مرحلة النضج (موثّق)" : "تقدّم في مرحلة النضج",
        before: { maturityStage: from },
        after: { maturityStage: to },
        metadata: isRegression ? { regression: true, reason: note } : undefined,
      },
      tx,
    );
  });
}

// ── Publishing ─────────────────────────────────────────────────────────────

/** Which publish-required fields are still missing on this record. */
export function missingPublishFields(solution: Record<string, unknown>) {
  return PUBLISH_REQUIRED_FIELDS.filter((f) => {
    const v = solution[f.key];
    return v === null || v === undefined || (typeof v === "string" && v.trim() === "");
  });
}

/**
 * Publish a solution so PUBLISHED-scope readers (Viewers) can see it.
 * Requires an ACTIVE record with the minimum fields filled. This is an
 * explicit visibility act — it makes no compliance/DGA readiness claim.
 */
export async function publishSolution(actor: AccessContext, solutionId: string): Promise<void> {
  const s = await loadForLifecycle(actor, solutionId);
  assertNotArchived(s.status);
  if (s.status !== "ACTIVE") throw new SolutionError("INVALID_TRANSITION", "يجب تفعيل الحل قبل نشره");
  if (s.publishedAt) throw new SolutionError("INVALID_STATE", "الحل منشور بالفعل");

  const missing = missingPublishFields(s as unknown as Record<string, unknown>);
  if (missing.length > 0) {
    throw new SolutionError("PUBLISH_INCOMPLETE", `حقول مطلوبة للنشر: ${missing.map((m) => m.label).join("، ")}`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.innovationSolution.update({ where: { id: solutionId }, data: { publishedAt: new Date() } });
    await writeAudit(
      {
        actorUserId: actor.userId,
        action: AUDIT.SOLUTION_PUBLISHED,
        entityType: "INNOVATION_SOLUTION",
        entityId: solutionId,
        departmentId: s.owningDepartmentId,
        summary: "نشر الحل للاطّلاع العام (لا يمثل مؤشر امتثال)",
        after: { published: true },
      },
      tx,
    );
  });
}

/** Withdraw publication — Viewer visibility ends immediately. */
export async function unpublishSolution(actor: AccessContext, solutionId: string): Promise<void> {
  const s = await loadForLifecycle(actor, solutionId);
  if (!s.publishedAt) throw new SolutionError("INVALID_STATE", "الحل غير منشور");

  await prisma.$transaction(async (tx) => {
    await tx.innovationSolution.update({ where: { id: solutionId }, data: { publishedAt: null } });
    await writeAudit(
      {
        actorUserId: actor.userId,
        action: AUDIT.SOLUTION_UNPUBLISHED,
        entityType: "INNOVATION_SOLUTION",
        entityId: solutionId,
        departmentId: s.owningDepartmentId,
        summary: "إلغاء نشر الحل",
        after: { published: false },
      },
      tx,
    );
  });
}

/** UI flags — the services re-enforce everything server-side. */
export function computeLifecycleFlags(
  solution: { status: RecordStatus; maturityStage: MaturityStage; implementationStatus: ImplementationStatus; publishedAt: Date | null },
  canUpdate: boolean,
) {
  const archived = solution.status === "ARCHIVED";
  const idx = MATURITY_ORDER.indexOf(solution.maturityStage);
  return {
    canUpdate: canUpdate && !archived,
    recordTargets: archived || !canUpdate ? [] : RECORD_TRANSITIONS[solution.status],
    implementationTargets: archived || !canUpdate ? [] : IMPLEMENTATION_TRANSITIONS[solution.implementationStatus],
    nextMaturity: !archived && canUpdate && idx < MATURITY_ORDER.length - 1 ? MATURITY_ORDER[idx + 1] : null,
    previousMaturity: !archived && canUpdate && idx > 0 ? MATURITY_ORDER[idx - 1] : null,
    canPublish: canUpdate && !archived && solution.status === "ACTIVE" && !solution.publishedAt,
    canUnpublish: canUpdate && !!solution.publishedAt,
  };
}
