import type { Prisma } from "@prisma/client";

import { prisma } from "@/server/db";
import { writeAudit, AUDIT } from "@/server/audit";
import type { AccessContext } from "@/server/access-context";
import { requirePermission, requireDepartmentScope, effectiveScopes, AuthorizationError } from "@/server/authorization";
import { documentIdsWithEvidence, uploadStrategyDocumentEvidence, type EvidenceFileInput } from "@/modules/evidence/service";
import { strategicObjectiveSchema, assignmentSchema, strategyDocumentSchema } from "./schema";

const VIEW = "strategy.objective.view" as const;
const MANAGE = "strategy.objective.manage" as const;
const ASSIGNMENT_MANAGE = "strategy.assignment.manage" as const;
const DOCUMENT_VIEW = "strategy.document.view" as const;
const DOCUMENT_UPLOAD = "strategy.document.upload" as const;
const DOCUMENT_MANAGE = "strategy.document.manage" as const;
const DOCUMENT_ARCHIVE = "strategy.document.archive" as const;

export type StrategyErrorCode = "VALIDATION" | "NOT_FOUND" | "BAD_REFERENCE" | "ALREADY_ARCHIVED" | "DUPLICATE_ASSIGNMENT" | "DUPLICATE_DOCUMENT";
export class StrategyError extends Error {
  code: StrategyErrorCode;
  fieldErrors?: Record<string, string[]>;
  constructor(code: StrategyErrorCode, message?: string, fieldErrors?: Record<string, string[]>) {
    super(message ?? code);
    this.name = "StrategyError";
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

/** Department-scoped visibility: platform sees all; otherwise own department(s)/organization(s). */
function objectiveScopeWhere(ctx: AccessContext): Prisma.StrategicObjectiveWhereInput {
  const es = effectiveScopes(ctx);
  if (es.platform) return {};
  const or: Prisma.StrategicObjectiveWhereInput[] = [];
  if (es.departmentIds.length) or.push({ departmentId: { in: es.departmentIds } });
  if (es.organizationIds.length) or.push({ department: { organizationId: { in: es.organizationIds } } });
  if (or.length === 0) return { id: "__none__" }; // matches nothing
  return { OR: or };
}

async function loadInScope(actor: AccessContext, objectiveId: string) {
  requirePermission(actor, VIEW);
  const objective = await prisma.strategicObjective.findUnique({
    where: { id: objectiveId },
    select: { id: true, status: true, departmentId: true },
  });
  if (!objective) throw new StrategyError("NOT_FOUND", "الهدف الاستراتيجي غير موجود");
  const es = effectiveScopes(actor);
  const inScope =
    es.platform ||
    (objective.departmentId != null && es.departmentIds.includes(objective.departmentId)) ||
    false;
  if (!inScope && objective.departmentId) {
    const dept = await prisma.department.findUnique({ where: { id: objective.departmentId }, select: { organizationId: true } });
    if (dept && es.organizationIds.includes(dept.organizationId)) return objective;
  }
  if (!inScope) throw new AuthorizationError("OUT_OF_SCOPE");
  return objective;
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

export async function createObjective(actor: AccessContext, raw: unknown): Promise<{ id: string }> {
  requirePermission(actor, MANAGE);
  const parsed = strategicObjectiveSchema.safeParse(raw);
  if (!parsed.success) throw new StrategyError("VALIDATION", "invalid", parsed.error.flatten().fieldErrors);
  const input = parsed.data;
  await requireDepartmentScope(actor, input.departmentId);

  const dept = await prisma.department.findUnique({ where: { id: input.departmentId }, select: { id: true } });
  if (!dept) throw new StrategyError("BAD_REFERENCE", "الجهة المحددة غير موجودة");

  return prisma.$transaction(async (tx) => {
    const created = await tx.strategicObjective.create({
      data: { ...input, status: "ACTIVE" },
      select: { id: true },
    });
    await writeAudit(
      {
        actorUserId: actor.userId,
        action: AUDIT.STRATEGIC_OBJECTIVE_CREATED,
        entityType: "STRATEGIC_OBJECTIVE",
        entityId: created.id,
        departmentId: input.departmentId,
        summary: "إنشاء هدف استراتيجي",
        after: { titleAr: input.titleAr, departmentId: input.departmentId },
      },
      tx,
    );
    return created;
  });
}

export async function updateObjective(actor: AccessContext, objectiveId: string, raw: unknown): Promise<void> {
  const current = await loadInScope(actor, objectiveId);
  requirePermission(actor, MANAGE);
  if (current.status === "ARCHIVED") throw new StrategyError("ALREADY_ARCHIVED", "لا يمكن تعديل هدف مؤرشف");

  const parsed = strategicObjectiveSchema.safeParse(raw);
  if (!parsed.success) throw new StrategyError("VALIDATION", "invalid", parsed.error.flatten().fieldErrors);
  const input = parsed.data;
  await requireDepartmentScope(actor, input.departmentId);
  const dept = await prisma.department.findUnique({ where: { id: input.departmentId }, select: { id: true } });
  if (!dept) throw new StrategyError("BAD_REFERENCE", "الجهة المحددة غير موجودة");

  await prisma.$transaction(async (tx) => {
    await tx.strategicObjective.update({ where: { id: objectiveId }, data: input });
    await writeAudit(
      {
        actorUserId: actor.userId,
        action: AUDIT.STRATEGIC_OBJECTIVE_UPDATED,
        entityType: "STRATEGIC_OBJECTIVE",
        entityId: objectiveId,
        departmentId: input.departmentId,
        summary: "تحديث هدف استراتيجي",
        after: { titleAr: input.titleAr },
      },
      tx,
    );
  });
}

/** Archive (RecordStatus has no rich terminal-state history to preserve, unlike Idea — mirrors the Solution archive pattern). */
export async function archiveObjective(actor: AccessContext, objectiveId: string): Promise<void> {
  const current = await loadInScope(actor, objectiveId);
  requirePermission(actor, MANAGE);
  if (current.status === "ARCHIVED") throw new StrategyError("ALREADY_ARCHIVED", "الهدف مؤرشف بالفعل");

  await prisma.$transaction(async (tx) => {
    await tx.strategicObjective.update({
      where: { id: objectiveId },
      data: { status: "ARCHIVED", archivedAt: new Date(), archivedById: actor.userId },
    });
    await writeAudit(
      {
        actorUserId: actor.userId,
        action: AUDIT.STRATEGIC_OBJECTIVE_ARCHIVED,
        entityType: "STRATEGIC_OBJECTIVE",
        entityId: objectiveId,
        departmentId: current.departmentId,
        summary: "أرشفة هدف استراتيجي",
        before: { status: current.status },
        after: { status: "ARCHIVED" },
      },
      tx,
    );
  });
}

export interface ObjectiveListRow {
  id: string;
  code: string | null;
  titleAr: string;
  departmentName: string | null;
  responsibleUserName: string | null;
  kpi: string | null;
  targetValue: string | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  status: string;
  updatedAt: Date;
}

export async function listObjectivesInScope(
  actor: AccessContext,
  opts?: { includeArchived?: boolean; departmentId?: string; q?: string },
): Promise<ObjectiveListRow[]> {
  requirePermission(actor, VIEW);
  const scope = objectiveScopeWhere(actor);
  const and: Prisma.StrategicObjectiveWhereInput[] = [scope];
  if (!opts?.includeArchived) and.push({ status: { not: "ARCHIVED" } });
  if (opts?.departmentId) and.push({ departmentId: opts.departmentId });
  if (opts?.q?.trim()) {
    const q = opts.q.trim();
    and.push({ OR: [{ titleAr: { contains: q, mode: "insensitive" } }, { code: { contains: q, mode: "insensitive" } }] });
  }

  const rows = await prisma.strategicObjective.findMany({
    where: { AND: and },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      code: true,
      titleAr: true,
      kpi: true,
      targetValue: true,
      periodStart: true,
      periodEnd: true,
      status: true,
      updatedAt: true,
      department: { select: { nameAr: true } },
      responsibleUserId: true,
    },
  });

  // Resolve responsible-user display names in one batch (soft ref → User.id).
  const userIds = Array.from(new Set(rows.map((r) => r.responsibleUserId).filter((v): v is string => !!v)));
  const users = userIds.length ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } }) : [];
  const nameById = new Map(users.map((u) => [u.id, u.name]));

  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    titleAr: r.titleAr,
    departmentName: r.department?.nameAr ?? null,
    responsibleUserName: r.responsibleUserId ? (nameById.get(r.responsibleUserId) ?? null) : null,
    kpi: r.kpi,
    targetValue: r.targetValue,
    periodStart: r.periodStart,
    periodEnd: r.periodEnd,
    status: r.status,
    updatedAt: r.updatedAt,
  }));
}

export async function getObjective(actor: AccessContext, objectiveId: string) {
  await loadInScope(actor, objectiveId);
  return prisma.strategicObjective.findUniqueOrThrow({
    where: { id: objectiveId },
    include: { department: { select: { id: true, nameAr: true } } },
  });
}

export function computeObjectiveFlags(actor: AccessContext, objective: { status: string; departmentId: string | null }) {
  const es = effectiveScopes(actor);
  const canManage =
    actor.permissions.has(MANAGE) &&
    (es.platform || (objective.departmentId != null && es.departmentIds.includes(objective.departmentId)));
  return {
    canEdit: canManage && objective.status !== "ARCHIVED",
    canArchive: canManage && objective.status !== "ARCHIVED",
  };
}

// =============================================================================
// ComplianceRequirementAssignment + StrategyDocument (5.23.1)
// =============================================================================

/** SYSTEM_ADMIN only, per the approved permission matrix. */
export async function createAssignment(actor: AccessContext, raw: unknown): Promise<{ id: string }> {
  requirePermission(actor, ASSIGNMENT_MANAGE);
  const parsed = assignmentSchema.safeParse(raw);
  if (!parsed.success) throw new StrategyError("VALIDATION", "invalid", parsed.error.flatten().fieldErrors);
  const input = parsed.data;

  const [requirement, department] = await Promise.all([
    prisma.complianceRequirement.findUnique({ where: { id: input.complianceRequirementId }, select: { id: true } }),
    prisma.department.findUnique({ where: { id: input.departmentId }, select: { id: true } }),
  ]);
  if (!requirement) throw new StrategyError("BAD_REFERENCE", "المعيار المحدد غير موجود");
  if (!department) throw new StrategyError("BAD_REFERENCE", "الجهة المحددة غير موجودة");

  const existingActive = await prisma.complianceRequirementAssignment.findFirst({
    where: { complianceRequirementId: input.complianceRequirementId, departmentId: input.departmentId, archivedAt: null },
    select: { id: true },
  });
  if (existingActive) throw new StrategyError("DUPLICATE_ASSIGNMENT", "هذا المعيار مُسنَد بالفعل لهذه الجهة (إسناد نشط قائم)");

  return prisma.$transaction(async (tx) => {
    const created = await tx.complianceRequirementAssignment.create({
      data: {
        complianceRequirementId: input.complianceRequirementId,
        departmentId: input.departmentId,
        strategicObjectiveId: input.strategicObjectiveId,
        dueDate: input.dueDate,
        assignedById: actor.userId,
      },
      select: { id: true },
    });
    await writeAudit(
      {
        actorUserId: actor.userId,
        action: AUDIT.COMPLIANCE_ASSIGNMENT_CREATED,
        entityType: "COMPLIANCE_REQUIREMENT",
        entityId: input.complianceRequirementId,
        departmentId: input.departmentId,
        summary: "إسناد معيار امتثال لجهة",
        after: { assignmentId: created.id, departmentId: input.departmentId },
      },
      tx,
    );
    return created;
  });
}

export async function updateAssignment(actor: AccessContext, assignmentId: string, raw: unknown): Promise<void> {
  requirePermission(actor, ASSIGNMENT_MANAGE);
  const current = await prisma.complianceRequirementAssignment.findUnique({
    where: { id: assignmentId },
    select: { id: true, archivedAt: true, complianceRequirementId: true, departmentId: true },
  });
  if (!current) throw new StrategyError("NOT_FOUND", "الإسناد غير موجود");
  if (current.archivedAt) throw new StrategyError("ALREADY_ARCHIVED", "لا يمكن تعديل إسناد مؤرشف");

  const parsed = assignmentSchema.pick({ strategicObjectiveId: true, dueDate: true }).safeParse(raw);
  if (!parsed.success) throw new StrategyError("VALIDATION", "invalid", parsed.error.flatten().fieldErrors);
  const input = parsed.data;

  await prisma.$transaction(async (tx) => {
    await tx.complianceRequirementAssignment.update({
      where: { id: assignmentId },
      data: { strategicObjectiveId: input.strategicObjectiveId, dueDate: input.dueDate },
    });
    await writeAudit(
      {
        actorUserId: actor.userId,
        action: AUDIT.COMPLIANCE_ASSIGNMENT_UPDATED,
        entityType: "COMPLIANCE_REQUIREMENT",
        entityId: current.complianceRequirementId,
        departmentId: current.departmentId,
        summary: "تحديث بيانات إسناد معيار امتثال",
        after: { assignmentId, dueDate: input.dueDate },
      },
      tx,
    );
  });
}

export async function archiveAssignment(actor: AccessContext, assignmentId: string): Promise<void> {
  requirePermission(actor, ASSIGNMENT_MANAGE);
  const current = await prisma.complianceRequirementAssignment.findUnique({
    where: { id: assignmentId },
    select: { id: true, archivedAt: true, departmentId: true, complianceRequirementId: true },
  });
  if (!current) throw new StrategyError("NOT_FOUND", "الإسناد غير موجود");
  if (current.archivedAt) throw new StrategyError("ALREADY_ARCHIVED", "هذا الإسناد مؤرشف بالفعل");

  await prisma.$transaction(async (tx) => {
    await tx.complianceRequirementAssignment.update({
      where: { id: assignmentId },
      data: { archivedAt: new Date(), archivedById: actor.userId },
    });
    await writeAudit(
      {
        actorUserId: actor.userId,
        action: AUDIT.COMPLIANCE_ASSIGNMENT_ARCHIVED,
        entityType: "COMPLIANCE_REQUIREMENT",
        entityId: current.complianceRequirementId,
        departmentId: current.departmentId,
        summary: "أرشفة إسناد معيار امتثال",
        after: { assignmentId },
      },
      tx,
    );
  });
}

export interface AssignmentRow {
  id: string;
  requirementCode: string | null;
  requirementTitleAr: string;
  departmentName: string | null;
  dueDate: Date | null;
  status: "NOT_STARTED" | "IN_PROGRESS" | "FULFILLED";
  document: {
    id: string;
    titleAr: string;
    documentType: string;
    description: string | null;
    documentDate: Date | null;
    approvalStatus: string;
    notes: string | null;
    hasEvidence: boolean;
  } | null;
}

function computeAssignmentStatus(activeDocument: { approvalStatus: string } | null, hasEvidence: boolean): "NOT_STARTED" | "IN_PROGRESS" | "FULFILLED" {
  if (!activeDocument) return "NOT_STARTED";
  if (activeDocument.approvalStatus === "APPROVED" && hasEvidence) return "FULFILLED";
  return "IN_PROGRESS";
}

/** Assignments linked to a given objective — used by the objective detail screen. */
export async function listAssignmentsForObjective(actor: AccessContext, objectiveId: string): Promise<AssignmentRow[]> {
  requirePermission(actor, DOCUMENT_VIEW);
  const es = effectiveScopes(actor);

  const assignments = await prisma.complianceRequirementAssignment.findMany({
    where: {
      strategicObjectiveId: objectiveId,
      archivedAt: null,
      ...(es.platform ? {} : { departmentId: { in: es.departmentIds } }),
    },
    orderBy: { assignedAt: "desc" },
    include: {
      requirement: { select: { code: true, titleAr: true } },
      department: { select: { nameAr: true } },
      document: {
        select: {
          id: true,
          titleAr: true,
          documentType: true,
          description: true,
          documentDate: true,
          approvalStatus: true,
          notes: true,
          archivedAt: true,
        },
      },
    },
  });

  const activeDocIds = assignments
    .map((a: { document: { id: string; archivedAt: Date | null } | null }) => (a.document && !a.document.archivedAt ? a.document.id : null))
    .filter((id: string | null): id is string => id !== null);
  const evidenceIds = await documentIdsWithEvidence(activeDocIds);

  return assignments.map((a) => {
    const activeDoc = a.document && !a.document.archivedAt ? a.document : null;
    const hasEvidence = activeDoc ? evidenceIds.has(activeDoc.id) : false;
    return {
      id: a.id,
      requirementCode: a.requirement.code,
      requirementTitleAr: a.requirement.titleAr,
      departmentName: a.department.nameAr,
      dueDate: a.dueDate,
      status: computeAssignmentStatus(activeDoc, hasEvidence),
      document: activeDoc
        ? {
            id: activeDoc.id,
            titleAr: activeDoc.titleAr,
            documentType: activeDoc.documentType,
            description: activeDoc.description,
            documentDate: activeDoc.documentDate,
            approvalStatus: activeDoc.approvalStatus,
            notes: activeDoc.notes,
            hasEvidence,
          }
        : null,
    };
  });
}

/** Rollup used by the compliance overview screen (5.23.1): fulfilled vs. total active assignments in scope. */
export interface StrategyComplianceReadiness {
  fulfilled: number;
  total: number;
}
export async function getStrategyComplianceReadiness(actor: AccessContext): Promise<StrategyComplianceReadiness> {
  requirePermission(actor, DOCUMENT_VIEW);
  const es = effectiveScopes(actor);
  const assignments = await prisma.complianceRequirementAssignment.findMany({
    where: { archivedAt: null, ...(es.platform ? {} : { departmentId: { in: es.departmentIds } }) },
    include: { document: { select: { id: true, approvalStatus: true, archivedAt: true } } },
  });
  const activeDocIds = assignments
    .map((a: { document: { id: string; archivedAt: Date | null } | null }) => (a.document && !a.document.archivedAt ? a.document.id : null))
    .filter((id: string | null): id is string => id !== null);
  const evidenceIds = await documentIdsWithEvidence(activeDocIds);
  let fulfilled = 0;
  for (const a of assignments) {
    const activeDoc = a.document && !a.document.archivedAt ? a.document : null;
    const hasEvidence = activeDoc ? evidenceIds.has(activeDoc.id) : false;
    if (computeAssignmentStatus(activeDoc, hasEvidence) === "FULFILLED") fulfilled += 1;
  }
  return { fulfilled, total: assignments.length };
}

export async function uploadStrategyDocument(
  actor: AccessContext,
  assignmentId: string,
  raw: unknown,
  file?: EvidenceFileInput,
): Promise<{ id: string }> {
  requirePermission(actor, DOCUMENT_UPLOAD);
  const assignment = await prisma.complianceRequirementAssignment.findUnique({
    where: { id: assignmentId },
    select: { id: true, departmentId: true, archivedAt: true },
  });
  if (!assignment) throw new StrategyError("NOT_FOUND", "الإسناد غير موجود");
  if (assignment.archivedAt) throw new StrategyError("ALREADY_ARCHIVED", "هذا الإسناد مؤرشف، لا يمكن رفع وثيقة له");
  await requireDepartmentScope(actor, assignment.departmentId);

  const existingActive = await prisma.strategyDocument.findFirst({ where: { assignmentId, archivedAt: null }, select: { id: true } });
  if (existingActive) throw new StrategyError("DUPLICATE_DOCUMENT", "توجد وثيقة نشطة بالفعل لهذا الإسناد — أرشفها أولًا لاستبدالها");

  const parsed = strategyDocumentSchema.safeParse(raw);
  if (!parsed.success) throw new StrategyError("VALIDATION", "invalid", parsed.error.flatten().fieldErrors);
  const input = parsed.data;

  const created = await prisma.$transaction(async (tx) => {
    const doc = await tx.strategyDocument.create({
      data: {
        titleAr: input.titleAr,
        documentType: input.documentType,
        description: input.description,
        assignmentId,
        documentDate: input.documentDate,
        approvalStatus: input.approvalStatus,
        notes: input.notes,
        uploadedById: actor.userId,
        approvedById: input.approvalStatus === "APPROVED" ? actor.userId : null,
        approvedAt: input.approvalStatus === "APPROVED" ? new Date() : null,
      },
      select: { id: true },
    });
    await writeAudit(
      {
        actorUserId: actor.userId,
        action: AUDIT.STRATEGY_DOCUMENT_UPLOADED,
        entityType: "EVIDENCE",
        entityId: doc.id,
        departmentId: assignment.departmentId,
        summary: "رفع وثيقة استيفاء معيار",
        metadata: { assignmentId, approvalStatus: input.approvalStatus },
        after: { approvalStatus: input.approvalStatus },
      },
      tx,
    );
    return doc;
  });

  if (file) {
    await uploadStrategyDocumentEvidence(actor, created.id, { title: input.titleAr, description: input.notes, classification: input.documentType }, file);
  }
  return created;
}

export async function updateStrategyDocument(actor: AccessContext, documentId: string, raw: unknown): Promise<void> {
  requirePermission(actor, DOCUMENT_MANAGE);
  const doc = await prisma.strategyDocument.findUnique({
    where: { id: documentId },
    select: { id: true, archivedAt: true, assignment: { select: { departmentId: true } } },
  });
  if (!doc) throw new StrategyError("NOT_FOUND", "الوثيقة غير موجودة");
  if (doc.archivedAt) throw new StrategyError("ALREADY_ARCHIVED", "لا يمكن تعديل وثيقة مؤرشفة");
  await requireDepartmentScope(actor, doc.assignment.departmentId);

  const parsed = strategyDocumentSchema.safeParse(raw);
  if (!parsed.success) throw new StrategyError("VALIDATION", "invalid", parsed.error.flatten().fieldErrors);
  const input = parsed.data;

  await prisma.$transaction(async (tx) => {
    await tx.strategyDocument.update({
      where: { id: documentId },
      data: {
        titleAr: input.titleAr,
        documentType: input.documentType,
        description: input.description,
        documentDate: input.documentDate,
        approvalStatus: input.approvalStatus,
        notes: input.notes,
        approvedById: input.approvalStatus === "APPROVED" ? actor.userId : null,
        approvedAt: input.approvalStatus === "APPROVED" ? new Date() : null,
      },
    });
    await writeAudit(
      {
        actorUserId: actor.userId,
        action: AUDIT.STRATEGY_DOCUMENT_UPDATED,
        entityType: "EVIDENCE",
        entityId: documentId,
        departmentId: doc.assignment.departmentId,
        summary: "تحديث بيانات وثيقة استيفاء",
        after: { approvalStatus: input.approvalStatus },
      },
      tx,
    );
  });
}

export async function archiveStrategyDocument(actor: AccessContext, documentId: string): Promise<void> {
  requirePermission(actor, DOCUMENT_ARCHIVE);
  const doc = await prisma.strategyDocument.findUnique({
    where: { id: documentId },
    select: { id: true, archivedAt: true, assignment: { select: { departmentId: true } } },
  });
  if (!doc) throw new StrategyError("NOT_FOUND", "الوثيقة غير موجودة");
  if (doc.archivedAt) throw new StrategyError("ALREADY_ARCHIVED", "الوثيقة مؤرشفة بالفعل");
  await requireDepartmentScope(actor, doc.assignment.departmentId);

  await prisma.$transaction(async (tx) => {
    await tx.strategyDocument.update({ where: { id: documentId }, data: { archivedAt: new Date(), archivedById: actor.userId } });
    await writeAudit(
      {
        actorUserId: actor.userId,
        action: AUDIT.STRATEGY_DOCUMENT_ARCHIVED,
        entityType: "EVIDENCE",
        entityId: documentId,
        departmentId: doc.assignment.departmentId,
        summary: "أرشفة وثيقة استيفاء",
      },
      tx,
    );
  });
}
