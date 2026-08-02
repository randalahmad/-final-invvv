import type { IdeaStatus } from "@prisma/client";

import { prisma } from "@/server/db";
import { writeAudit, AUDIT } from "@/server/audit";
import type { AccessContext } from "@/server/access-context";
import {
  requirePermission,
  requireScope,
  requireDepartmentScope,
  ideaScopeWhere,
  effectiveScopes,
} from "@/server/authorization";
import { createIdeaSchema, updateIdeaSchema } from "./schema";

/** Business-rule failures (authorization failures use AuthorizationError). */
export type IdeaErrorCode = "VALIDATION" | "NOT_DRAFT" | "INVALID_TRANSITION" | "NOT_AUTHOR" | "BAD_ACTIVITY" | "RESTORE_UNAVAILABLE";
export class IdeaError extends Error {
  code: IdeaErrorCode;
  fieldErrors?: Record<string, string[]>;
  constructor(code: IdeaErrorCode, message?: string, fieldErrors?: Record<string, string[]>) {
    super(message ?? code);
    this.name = "IdeaError";
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

// Author may withdraw only before a final decision (status-definitions.md §4.1).
const WITHDRAWABLE_FROM: IdeaStatus[] = ["DRAFT", "SUBMITTED", "INITIAL_REVIEW", "TECHNICAL_REVIEW", "MORE_INFO_REQUESTED"];
// Terminal states that may be archived (never hard-deleted).
const ARCHIVABLE_FROM: IdeaStatus[] = ["WITHDRAWN", "REJECTED", "CONVERTED_TO_SOLUTION"];

const IDEA_VIEW = "idea.view" as const;

function isAuthorOrPlatform(ctx: AccessContext, submittedById: string | null): boolean {
  return submittedById === ctx.userId || effectiveScopes(ctx).platform;
}

/** Ensure any provided activity id references a real activity. */
async function normalizeActivityId(activityId?: string): Promise<string | null> {
  const id = activityId?.trim();
  if (!id) return null;
  const found = await prisma.innovationActivity.findUnique({ where: { id }, select: { id: true } });
  if (!found) throw new IdeaError("BAD_ACTIVITY", "النشاط المرتبط غير موجود");
  return id;
}

/** Create a DRAFT idea owned by a department in the caller's scope. */
export async function createIdea(actor: AccessContext, raw: unknown): Promise<{ id: string }> {
  requirePermission(actor, IDEA_VIEW);
  const parsed = createIdeaSchema.safeParse(raw);
  if (!parsed.success) throw new IdeaError("VALIDATION", "invalid", parsed.error.flatten().fieldErrors);
  const input = parsed.data;
  await requireDepartmentScope(actor, input.departmentId); // cannot create for another department
  const activityId = await normalizeActivityId(input.activityId);

  return prisma.$transaction(async (tx) => {
    const created = await tx.idea.create({
      data: {
        titleAr: input.titleAr,
        description: input.description?.trim() || null,
        departmentId: input.departmentId,
        activityId,
        submittedById: actor.userId,
        status: "DRAFT",
      },
      select: { id: true },
    });
    await writeAudit(
      {
        actorUserId: actor.userId,
        action: AUDIT.IDEA_CREATED,
        entityType: "IDEA",
        entityId: created.id,
        departmentId: input.departmentId,
        summary: "إنشاء فكرة (مسودة)",
        after: { status: "DRAFT" },
      },
      tx,
    );
    return created;
  });
}

async function loadInScope(actor: AccessContext, ideaId: string) {
  await requireScope(actor, "IDEA", ideaId); // throws NOT_FOUND / OUT_OF_SCOPE
  return prisma.idea.findUniqueOrThrow({
    where: { id: ideaId },
    select: { id: true, status: true, submittedById: true, departmentId: true, archivedAt: true },
  });
}

/** Edit a DRAFT idea (author or an authorized scoped user). Only DRAFT is editable. */
export async function updateDraftIdea(actor: AccessContext, ideaId: string, raw: unknown): Promise<void> {
  requirePermission(actor, IDEA_VIEW);
  const idea = await loadInScope(actor, ideaId);
  if (idea.status !== "DRAFT") throw new IdeaError("NOT_DRAFT", "لا يمكن تعديل فكرة بعد تقديمها");

  const parsed = updateIdeaSchema.safeParse(raw);
  if (!parsed.success) throw new IdeaError("VALIDATION", "invalid", parsed.error.flatten().fieldErrors);
  const input = parsed.data;
  if (input.departmentId !== idea.departmentId) await requireDepartmentScope(actor, input.departmentId);
  const activityId = await normalizeActivityId(input.activityId);

  await prisma.$transaction(async (tx) => {
    await tx.idea.update({
      where: { id: ideaId },
      data: {
        titleAr: input.titleAr,
        description: input.description?.trim() || null,
        departmentId: input.departmentId,
        activityId,
      },
    });
    await writeAudit(
      { actorUserId: actor.userId, action: AUDIT.IDEA_UPDATED, entityType: "IDEA", entityId: ideaId, summary: "تحديث مسودة فكرة" },
      tx,
    );
  });
}

/** DRAFT → SUBMITTED (author-initiated). */
export async function submitIdea(actor: AccessContext, ideaId: string): Promise<void> {
  requirePermission(actor, IDEA_VIEW);
  const idea = await loadInScope(actor, ideaId);
  if (!isAuthorOrPlatform(actor, idea.submittedById)) throw new IdeaError("NOT_AUTHOR", "التقديم من صلاحية صاحب الفكرة");
  if (idea.status !== "DRAFT") throw new IdeaError("INVALID_TRANSITION", "لا يمكن تقديم الفكرة من حالتها الحالية");

  await prisma.$transaction(async (tx) => {
    await tx.idea.update({ where: { id: ideaId }, data: { status: "SUBMITTED" } });
    await writeAudit(
      {
        actorUserId: actor.userId,
        action: AUDIT.IDEA_SUBMITTED,
        entityType: "IDEA",
        entityId: ideaId,
        summary: "تقديم فكرة",
        before: { status: "DRAFT" },
        after: { status: "SUBMITTED" },
      },
      tx,
    );
  });
}

/** → WITHDRAWN (author-initiated, only before a final decision). */
export async function withdrawIdea(actor: AccessContext, ideaId: string): Promise<void> {
  requirePermission(actor, IDEA_VIEW);
  const idea = await loadInScope(actor, ideaId);
  if (!isAuthorOrPlatform(actor, idea.submittedById)) throw new IdeaError("NOT_AUTHOR", "السحب من صلاحية صاحب الفكرة");
  if (!WITHDRAWABLE_FROM.includes(idea.status)) throw new IdeaError("INVALID_TRANSITION", "لا يمكن سحب الفكرة من حالتها الحالية");

  await prisma.$transaction(async (tx) => {
    await tx.idea.update({ where: { id: ideaId }, data: { status: "WITHDRAWN" } });
    await writeAudit(
      {
        actorUserId: actor.userId,
        action: AUDIT.IDEA_WITHDRAWN,
        entityType: "IDEA",
        entityId: ideaId,
        summary: "سحب فكرة",
        before: { status: idea.status },
        after: { status: "WITHDRAWN" },
      },
      tx,
    );
  });
}

/** Archive a terminal idea (System Administrator / owning department). Soft only. */
export async function archiveIdea(actor: AccessContext, ideaId: string): Promise<void> {
  requirePermission(actor, IDEA_VIEW);
  const idea = await loadInScope(actor, ideaId);
  // Authorization: platform admin OR owning-department scope (never a hard delete).
  await requireDepartmentScope(actor, idea.departmentId ?? "__none__");
  if (!ARCHIVABLE_FROM.includes(idea.status)) throw new IdeaError("INVALID_TRANSITION", "لا يمكن أرشفة الفكرة من حالتها الحالية");

  await prisma.$transaction(async (tx) => {
    await tx.idea.update({ where: { id: ideaId }, data: { status: "ARCHIVED", archivedAt: new Date(), archivedById: actor.userId } });
    await writeAudit(
      {
        actorUserId: actor.userId,
        action: AUDIT.IDEA_ARCHIVED,
        entityType: "IDEA",
        entityId: ideaId,
        summary: "أرشفة فكرة",
        before: { status: idea.status },
        after: { status: "ARCHIVED" },
      },
      tx,
    );
  });
}

/**
 * Restore an archived idea to the status it was archived from.
 *
 * The prior status is NEVER guessed: it is read from the `beforeData.status`
 * of the most recent `IDEA_ARCHIVED` AuditLog entry for this idea (written by
 * archiveIdea() in the same transaction as the archive, before status was
 * overwritten). If no such entry exists, or its recorded status is not one of
 * the states the system allows archiving FROM, restoration is refused
 * outright rather than defaulting to any assumed status. Only status,
 * archivedAt, and archivedById are touched — no other field or relation.
 */
export async function restoreIdea(actor: AccessContext, ideaId: string): Promise<void> {
  requirePermission(actor, IDEA_VIEW);
  const idea = await loadInScope(actor, ideaId);
  // Same authorization as archiveIdea: platform admin OR owning-department scope.
  await requireDepartmentScope(actor, idea.departmentId ?? "__none__");

  if (idea.status !== "ARCHIVED" || !idea.archivedAt) {
    throw new IdeaError("INVALID_TRANSITION", "لا يمكن استعادة فكرة غير مؤرشفة");
  }

  const archiveLog = await prisma.auditLog.findFirst({
    where: { entityType: "IDEA", entityId: ideaId, action: AUDIT.IDEA_ARCHIVED },
    orderBy: { createdAt: "desc" },
    select: { beforeData: true },
  });

  const rawBefore = archiveLog?.beforeData;
  const beforeStatus =
    rawBefore && typeof rawBefore === "object" && !Array.isArray(rawBefore) && "status" in rawBefore
      ? (rawBefore as { status?: unknown }).status
      : undefined;

  const isTrustworthyPriorStatus = typeof beforeStatus === "string" && (ARCHIVABLE_FROM as string[]).includes(beforeStatus);
  if (!isTrustworthyPriorStatus) {
    throw new IdeaError("RESTORE_UNAVAILABLE", "تعذّر تحديد الحالة السابقة لهذه الفكرة بثقة، لذا لا يمكن استعادتها تلقائيًا");
  }
  const restoredStatus = beforeStatus as IdeaStatus;

  await prisma.$transaction(async (tx) => {
    await tx.idea.update({
      where: { id: ideaId },
      data: { status: restoredStatus, archivedAt: null, archivedById: null },
    });
    await writeAudit(
      {
        actorUserId: actor.userId,
        action: AUDIT.IDEA_RESTORED,
        entityType: "IDEA",
        entityId: ideaId,
        summary: "استعادة فكرة من الأرشيف",
        before: { status: "ARCHIVED" },
        after: { status: restoredStatus },
      },
      tx,
    );
  });
}

/** Read a single idea (scope-enforced). Throws NOT_FOUND / OUT_OF_SCOPE / FORBIDDEN. */
export async function getIdeaById(actor: AccessContext, ideaId: string) {
  requirePermission(actor, IDEA_VIEW);
  await requireScope(actor, "IDEA", ideaId);
  return prisma.idea.findUniqueOrThrow({
    where: { id: ideaId },
    select: {
      id: true,
      titleAr: true,
      description: true,
      status: true,
      departmentId: true,
      activityId: true,
      submittedById: true,
      createdAt: true,
      updatedAt: true,
      archivedAt: true,
      department: { select: { nameAr: true } },
      activity: { select: { nameAr: true } },
      submittedBy: { select: { name: true } },
    },
  });
}

export interface IdeaListRow {
  id: string;
  titleAr: string;
  status: IdeaStatus;
  departmentId: string | null;
  departmentName: string | null;
  authorName: string | null;
  updatedAt: Date;
  archivedAt: Date | null;
}

/**
 * List ideas visible to the caller (scope-filtered server-side).
 *
 * `includeArchived` mirrors the `?archived=1` mechanism already used on
 * /solutions: when false (default), ARCHIVED ideas are excluded from the
 * result entirely so the main list stays free of archival clutter; when
 * true, the result is restricted to ARCHIVED ideas only (a dedicated archive
 * view, since that is what the restore UI needs — not a mixed list).
 */
export async function listIdeasInScope(
  actor: AccessContext,
  opts?: { status?: IdeaStatus; includeArchived?: boolean },
): Promise<IdeaListRow[]> {
  requirePermission(actor, IDEA_VIEW);
  const scope = ideaScopeWhere(actor);
  const statusFilter = opts?.includeArchived
    ? ({ status: "ARCHIVED" } as const)
    : opts?.status
      ? { status: opts.status }
      : { status: { not: "ARCHIVED" as const } };
  const rows = await prisma.idea.findMany({
    where: { AND: [scope, statusFilter] },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      titleAr: true,
      status: true,
      departmentId: true,
      updatedAt: true,
      archivedAt: true,
      department: { select: { nameAr: true } },
      submittedBy: { select: { name: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    titleAr: r.titleAr,
    status: r.status,
    departmentId: r.departmentId,
    departmentName: r.department?.nameAr ?? null,
    authorName: r.submittedBy?.name ?? null,
    updatedAt: r.updatedAt,
    archivedAt: r.archivedAt,
  }));
}

/**
 * UI action flags for the details page (which buttons to show). Server-side
 * enforcement still happens in each service function; this only drives display.
 */
export function computeIdeaActionFlags(
  actor: AccessContext,
  idea: { status: IdeaStatus; submittedById: string | null; departmentId: string | null },
) {
  const es = effectiveScopes(actor);
  const isAuthor = idea.submittedById === actor.userId;
  const authorOrAdmin = isAuthor || es.platform;
  const ownsDept = es.platform || (idea.departmentId ? es.departmentIds.includes(idea.departmentId) : false);
  return {
    canEdit: idea.status === "DRAFT",
    canSubmit: idea.status === "DRAFT" && authorOrAdmin,
    canWithdraw: WITHDRAWABLE_FROM.includes(idea.status) && authorOrAdmin,
    canArchive: ARCHIVABLE_FROM.includes(idea.status) && ownsDept,
    canRestore: idea.status === "ARCHIVED" && ownsDept,
  };
}

/** Departments the caller may own an idea in (for the create/edit form). */
export async function listOwnableDepartments(actor: AccessContext): Promise<{ id: string; nameAr: string }[]> {
  const es = effectiveScopes(actor);
  if (es.platform) return prisma.department.findMany({ orderBy: { nameAr: "asc" }, select: { id: true, nameAr: true } });
  return prisma.department.findMany({
    where: {
      OR: [{ id: { in: es.departmentIds } }, { organizationId: { in: es.organizationIds } }],
    },
    orderBy: { nameAr: "asc" },
    select: { id: true, nameAr: true },
  });
}
