import type { Prisma } from "@prisma/client";

import { prisma } from "@/server/db";
import { writeAudit, AUDIT } from "@/server/audit";
import type { AccessContext } from "@/server/access-context";
import { requirePermission, requireDepartmentScope, effectiveScopes, AuthorizationError } from "@/server/authorization";
import { activitySchema } from "./schema";

const VIEW = "activity.view" as const;
const MANAGE = "activity.manage" as const;

export type ActivityErrorCode = "VALIDATION" | "NOT_FOUND" | "BAD_REFERENCE" | "ALREADY_ARCHIVED";
export class ActivityError extends Error {
  code: ActivityErrorCode;
  fieldErrors?: Record<string, string[]>;
  constructor(code: ActivityErrorCode, message?: string, fieldErrors?: Record<string, string[]>) {
    super(message ?? code);
    this.name = "ActivityError";
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

function activityScopeWhere(ctx: AccessContext): Prisma.InnovationActivityWhereInput {
  const es = effectiveScopes(ctx);
  if (es.platform) return {};
  const or: Prisma.InnovationActivityWhereInput[] = [];
  if (es.departmentIds.length) or.push({ organizerDepartmentId: { in: es.departmentIds } });
  if (es.organizationIds.length) or.push({ organizerDepartment: { organizationId: { in: es.organizationIds } } });
  if (or.length === 0) return { id: "__none__" };
  return { OR: or };
}

async function loadInScope(actor: AccessContext, activityId: string) {
  requirePermission(actor, VIEW);
  const activity = await prisma.innovationActivity.findUnique({
    where: { id: activityId },
    select: { id: true, status: true, organizerDepartmentId: true, archivedAt: true },
  });
  if (!activity) throw new ActivityError("NOT_FOUND", "النشاط غير موجود");
  const es = effectiveScopes(actor);
  const inScope =
    es.platform || (activity.organizerDepartmentId != null && es.departmentIds.includes(activity.organizerDepartmentId));
  if (!inScope && activity.organizerDepartmentId) {
    const dept = await prisma.department.findUnique({ where: { id: activity.organizerDepartmentId }, select: { organizationId: true } });
    if (dept && es.organizationIds.includes(dept.organizationId)) return activity;
  }
  if (!inScope) throw new AuthorizationError("OUT_OF_SCOPE");
  return activity;
}

export async function listOwnableDepartments(actor: AccessContext) {
  const es = effectiveScopes(actor);
  if (es.platform) return prisma.department.findMany({ orderBy: { nameAr: "asc" }, select: { id: true, nameAr: true } });
  return prisma.department.findMany({
    where: { OR: [{ id: { in: es.departmentIds } }, { organizationId: { in: es.organizationIds } }] },
    orderBy: { nameAr: "asc" },
    select: { id: true, nameAr: true },
  });
}

export async function createActivity(actor: AccessContext, raw: unknown): Promise<{ id: string }> {
  requirePermission(actor, MANAGE);
  const parsed = activitySchema.safeParse(raw);
  if (!parsed.success) throw new ActivityError("VALIDATION", "invalid", parsed.error.flatten().fieldErrors);
  const input = parsed.data;
  await requireDepartmentScope(actor, input.organizerDepartmentId);

  const dept = await prisma.department.findUnique({ where: { id: input.organizerDepartmentId }, select: { id: true } });
  if (!dept) throw new ActivityError("BAD_REFERENCE", "الجهة المحددة غير موجودة");

  return prisma.$transaction(async (tx) => {
    const created = await tx.innovationActivity.create({
      data: { ...input, status: "PLANNED" },
      select: { id: true },
    });
    await writeAudit(
      {
        actorUserId: actor.userId,
        action: AUDIT.ACTIVITY_CREATED,
        entityType: "INNOVATION_ACTIVITY",
        entityId: created.id,
        departmentId: input.organizerDepartmentId,
        summary: "إنشاء نشاط ابتكاري",
        after: { nameAr: input.nameAr, type: input.type },
      },
      tx,
    );
    return created;
  });
}

export async function updateActivity(
  actor: AccessContext,
  activityId: string,
  raw: unknown,
  status?: string,
): Promise<void> {
  const current = await loadInScope(actor, activityId);
  requirePermission(actor, MANAGE);
  if (current.archivedAt) throw new ActivityError("ALREADY_ARCHIVED", "لا يمكن تعديل نشاط مؤرشف");

  const parsed = activitySchema.safeParse(raw);
  if (!parsed.success) throw new ActivityError("VALIDATION", "invalid", parsed.error.flatten().fieldErrors);
  const input = parsed.data;
  await requireDepartmentScope(actor, input.organizerDepartmentId);
  const dept = await prisma.department.findUnique({ where: { id: input.organizerDepartmentId }, select: { id: true } });
  if (!dept) throw new ActivityError("BAD_REFERENCE", "الجهة المحددة غير موجودة");

  const validStatus = ["PLANNED", "ONGOING", "COMPLETED", "CANCELLED"].includes(status ?? "") ? status : undefined;

  await prisma.$transaction(async (tx) => {
    await tx.innovationActivity.update({
      where: { id: activityId },
      data: { ...input, ...(validStatus ? { status: validStatus as "PLANNED" | "ONGOING" | "COMPLETED" | "CANCELLED" } : {}) },
    });
    await writeAudit(
      {
        actorUserId: actor.userId,
        action: AUDIT.ACTIVITY_UPDATED,
        entityType: "INNOVATION_ACTIVITY",
        entityId: activityId,
        departmentId: input.organizerDepartmentId,
        summary: "تحديث نشاط ابتكاري",
        after: { nameAr: input.nameAr, status: validStatus ?? current.status },
      },
      tx,
    );
  });
}

export async function archiveActivity(actor: AccessContext, activityId: string): Promise<void> {
  const current = await loadInScope(actor, activityId);
  requirePermission(actor, MANAGE);
  if (current.archivedAt) throw new ActivityError("ALREADY_ARCHIVED", "النشاط مؤرشف بالفعل");

  await prisma.$transaction(async (tx) => {
    await tx.innovationActivity.update({
      where: { id: activityId },
      data: { archivedAt: new Date(), archivedById: actor.userId },
    });
    await writeAudit(
      {
        actorUserId: actor.userId,
        action: AUDIT.ACTIVITY_ARCHIVED,
        entityType: "INNOVATION_ACTIVITY",
        entityId: activityId,
        departmentId: current.organizerDepartmentId,
        summary: "أرشفة نشاط ابتكاري",
      },
      tx,
    );
  });
}

export interface ActivityListRow {
  id: string;
  nameAr: string;
  type: string;
  departmentName: string | null;
  startDate: Date | null;
  endDate: Date | null;
  status: string;
  updatedAt: Date;
}

export async function listActivitiesInScope(
  actor: AccessContext,
  opts?: { includeArchived?: boolean; departmentId?: string; year?: string; q?: string },
): Promise<ActivityListRow[]> {
  requirePermission(actor, VIEW);
  const scope = activityScopeWhere(actor);
  const and: Prisma.InnovationActivityWhereInput[] = [scope];
  if (!opts?.includeArchived) and.push({ archivedAt: null });
  if (opts?.departmentId) and.push({ organizerDepartmentId: opts.departmentId });
  if (opts?.year) {
    const y = Number(opts.year);
    if (!Number.isNaN(y)) and.push({ startDate: { gte: new Date(`${y}-01-01`), lt: new Date(`${y + 1}-01-01`) } });
  }
  if (opts?.q?.trim()) and.push({ nameAr: { contains: opts.q.trim(), mode: "insensitive" } });

  const rows = await prisma.innovationActivity.findMany({
    where: { AND: and },
    orderBy: { startDate: "desc" },
    select: {
      id: true,
      nameAr: true,
      type: true,
      startDate: true,
      endDate: true,
      status: true,
      updatedAt: true,
      organizerDepartment: { select: { nameAr: true } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    nameAr: r.nameAr,
    type: r.type,
    departmentName: r.organizerDepartment?.nameAr ?? null,
    startDate: r.startDate,
    endDate: r.endDate,
    status: r.status,
    updatedAt: r.updatedAt,
  }));
}

export async function getActivity(actor: AccessContext, activityId: string) {
  await loadInScope(actor, activityId);
  return prisma.innovationActivity.findUniqueOrThrow({
    where: { id: activityId },
    include: { organizerDepartment: { select: { id: true, nameAr: true } } },
  });
}

export function computeActivityFlags(actor: AccessContext, activity: { archivedAt: Date | null; organizerDepartmentId: string | null }) {
  const es = effectiveScopes(actor);
  const canManage =
    actor.permissions.has(MANAGE) &&
    (es.platform || (activity.organizerDepartmentId != null && es.departmentIds.includes(activity.organizerDepartmentId)));
  return {
    canEdit: canManage && !activity.archivedAt,
    canArchive: canManage && !activity.archivedAt,
  };
}

/** Annual documented-activity target referenced in the 5.23.2 requirement text. */
export const ANNUAL_ACTIVITY_TARGET = 5;

/** Documented (non-archived) activities within the caller's scope for a given year — used by the compliance overview screen. */
export async function countActivitiesForYear(actor: AccessContext, year: number): Promise<number> {
  requirePermission(actor, VIEW);
  const scope = activityScopeWhere(actor);
  return prisma.innovationActivity.count({
    where: {
      AND: [scope, { archivedAt: null }, { startDate: { gte: new Date(`${year}-01-01`), lt: new Date(`${year + 1}-01-01`) } }],
    },
  });
}
