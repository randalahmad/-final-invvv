import type { Prisma } from "@prisma/client";

import { prisma } from "@/server/db";
import { writeAudit, AUDIT } from "@/server/audit";
import type { AccessContext } from "@/server/access-context";
import {
  requirePermission,
  requireScope,
  requireDepartmentScope,
  solutionScopeWhere,
  requirePartnerFieldWrite,
  effectiveScopes,
} from "@/server/authorization";
import { solutionSchema } from "./schema";
import { detectPotentialDuplicates, solutionFingerprint } from "./portfolio";

export type SolutionErrorCode =
  | "VALIDATION"
  | "NOT_DRAFT"
  | "INVALID_STATE"
  | "BAD_REFERENCE"
  | "INVALID_TRANSITION"
  | "PUBLISH_INCOMPLETE"
  | "REASON_REQUIRED"
  | "DUPLICATE";
export class SolutionError extends Error {
  code: SolutionErrorCode;
  fieldErrors?: Record<string, string[]>;
  constructor(code: SolutionErrorCode, message?: string, fieldErrors?: Record<string, string[]>) {
    super(message ?? code);
    this.name = "SolutionError";
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

const VIEW = "solution.view" as const;
const CREATE = "solution.create" as const;
const UPDATE = "solution.update" as const;
const ARCHIVE = "solution.archive" as const;

// ── Completeness ───────────────────────────────────────────────────────────

/**
 * Fields counted for **file/data completeness**. This is NOT a DGA compliance
 * readiness score: it measures only whether the solution's own record fields
 * are filled. Evidence is not considered (Phase 4B+). Enum fields with schema
 * defaults (maturityStage, implementationStatus, source) are excluded because
 * they are never empty and would inflate the figure.
 */
export const COMPLETENESS_FIELDS: { key: string; label: string }[] = [
  { key: "nameAr", label: "اسم الحل" },
  { key: "description", label: "الوصف" },
  { key: "problemStatement", label: "وصف المشكلة" },
  { key: "owningDepartmentId", label: "الإدارة المالكة" },
  { key: "ownerUserId", label: "المسؤول عن الحل" },
  { key: "strategicObjectiveId", label: "الهدف الاستراتيجي" },
  { key: "startDate", label: "تاريخ البدء" },
  { key: "targetEndDate", label: "تاريخ الانتهاء المستهدف" },
  { key: "cost", label: "التكلفة التقديرية" },
  { key: "targetBeneficiaries", label: "الفئة المستفيدة" },
  { key: "technologies", label: "التقنيات المستخدمة" },
];

function isEmptyValue(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === "string") return v.trim() === "";
  return false;
}

export interface Completeness {
  percentage: number;
  filled: number;
  total: number;
  missing: { key: string; label: string }[];
}

/** Transparent, explainable data-completeness of a solution record. */
export function computeSolutionCompleteness(solution: Record<string, unknown>): Completeness {
  const missing = COMPLETENESS_FIELDS.filter((f) => isEmptyValue(solution[f.key]));
  const total = COMPLETENESS_FIELDS.length;
  const filled = total - missing.length;
  return { percentage: Math.round((filled / total) * 100), filled, total, missing };
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Verify optional foreign references exist (clean errors instead of FK crashes). */
async function assertReferences(input: { activityId: string | null; strategicObjectiveId: string | null; ownerUserId: string | null }) {
  if (input.activityId) {
    const a = await prisma.innovationActivity.findUnique({ where: { id: input.activityId }, select: { id: true } });
    if (!a) throw new SolutionError("BAD_REFERENCE", "النشاط المرتبط غير موجود");
  }
  if (input.strategicObjectiveId) {
    const o = await prisma.strategicObjective.findUnique({ where: { id: input.strategicObjectiveId }, select: { id: true } });
    if (!o) throw new SolutionError("BAD_REFERENCE", "الهدف الاستراتيجي غير موجود");
  }
  if (input.ownerUserId) {
    const u = await prisma.user.findUnique({ where: { id: input.ownerUserId }, select: { id: true } });
    if (!u) throw new SolutionError("BAD_REFERENCE", "المستخدم المسؤول غير موجود");
  }
}

function writableData(input: Awaited<ReturnType<typeof solutionSchema.parseAsync>>) {
  return {
    nameAr: input.nameAr,
    description: input.description,
    problemStatement: input.problemStatement,
    owningDepartmentId: input.owningDepartmentId,
    source: input.source,
    activityId: input.activityId,
    ownerUserId: input.ownerUserId,
    strategicObjectiveId: input.strategicObjectiveId,
    maturityStage: input.maturityStage,
    implementationStatus: input.implementationStatus,
    startDate: input.startDate,
    targetEndDate: input.targetEndDate,
    actualEndDate: input.actualEndDate,
    durationMonths: input.durationMonths,
    cost: input.cost,
    targetBeneficiaries: input.targetBeneficiaries,
    technologies: input.technologies,
    risks: input.risks,
    notes: input.notes,
    launchDate: input.launchDate,
    beneficiaryCount: input.beneficiaryCount,
    achievedOrExpectedImpact: input.achievedOrExpectedImpact,
    beneficiarySatisfactionPct: input.beneficiarySatisfactionPct,
    previouslySubmittedForMeasurement: input.previouslySubmittedForMeasurement,
    significantChangeNote: input.significantChangeNote,
    innovationMethodologySource: input.innovationMethodologySource,
    digitalTransformationPlanLink: input.digitalTransformationPlanLink,
    isSustained: input.isSustained,
    sustainabilityOwner: input.sustainabilityOwner,
    sustainabilityPlan: input.sustainabilityPlan,
    portfolioStatus: input.portfolioStatus,
    externalReferenceId: input.externalReferenceId,
    solutionType: input.solutionType, domain: input.domain, executingEntity: input.executingEntity, operationalOwner: input.operationalOwner,
    nextAction: input.nextAction, nextActionDueDate: input.nextActionDueDate, expectedImpact: input.expectedImpact, achievedImpact: input.achievedImpact,
    satisfactionMeasurementSource: input.satisfactionMeasurementSource, satisfactionMeasurementDate: input.satisfactionMeasurementDate,
    usageStartDate: input.usageStartDate, stillInUse: input.stillInUse, usingDepartmentName: input.usingDepartmentName, operationNotes: input.operationNotes,
    digitalTransformationObjective: input.digitalTransformationObjective, innovationObjective: input.innovationObjective, linkedInitiative: input.linkedInitiative,
    technologyTags: input.technologyTagsText?.split(/[،,]/).map((x) => x.trim()).filter(Boolean) ?? [],
  };
}

// ── Services ───────────────────────────────────────────────────────────────

/** Manually register a solution (DRAFT) in a department within the caller's scope. */
export async function createSolution(actor: AccessContext, raw: unknown): Promise<{ id: string }> {
  requirePermission(actor, CREATE);
  const parsed = solutionSchema.safeParse(raw);
  if (!parsed.success) throw new SolutionError("VALIDATION", "invalid", parsed.error.flatten().fieldErrors);
  const input = parsed.data;
  await requireDepartmentScope(actor, input.owningDepartmentId);
  await assertReferences(input);

  const candidates = await prisma.innovationSolution.findMany({ where: { status: { not: "ARCHIVED" } }, select: { id: true, nameAr: true, externalReferenceId: true, sourceRecordType: true, sourceRecordId: true } });
  const duplicates = detectPotentialDuplicates(input, candidates);
  if (duplicates.length && !input.duplicateContinuationReason) throw new SolutionError("DUPLICATE", "قد يكون هذا الحل مسجلًا مسبقًا");

  const data = writableData(input);
  const completeness = computeSolutionCompleteness(data as unknown as Record<string, unknown>);

  return prisma.$transaction(async (tx) => {
    const created = await tx.innovationSolution.create({
      data: { ...data, intakeFingerprint: duplicates.length ? null : solutionFingerprint(input), duplicateOfId: duplicates[0]?.id ?? null, duplicateReason: input.duplicateContinuationReason, status: "DRAFT", completionPct: completeness.percentage },
      select: { id: true },
    });
    await writeAudit(
      {
        actorUserId: actor.userId,
        action: AUDIT.SOLUTION_CREATED,
        entityType: "INNOVATION_SOLUTION",
        entityId: created.id,
        departmentId: input.owningDepartmentId,
        summary: "تسجيل حل ابتكاري (مسودة)",
        after: { status: "DRAFT", completionPct: completeness.percentage },
      },
      tx,
    );
    return created;
  });
}

/** Edit a DRAFT solution. The Idea link, status and computed fields are never writable. */
export async function updateDraftSolution(actor: AccessContext, solutionId: string, raw: unknown): Promise<void> {
  requirePermission(actor, UPDATE);
  await requireScope(actor, "INNOVATION_SOLUTION", solutionId);
  const current = await prisma.innovationSolution.findUniqueOrThrow({
    where: { id: solutionId },
    select: { id: true, status: true, owningDepartmentId: true, ideaId: true },
  });
  if (current.status !== "DRAFT") throw new SolutionError("NOT_DRAFT", "يمكن تعديل المسودات فقط");

  const parsed = solutionSchema.safeParse(raw);
  if (!parsed.success) throw new SolutionError("VALIDATION", "invalid", parsed.error.flatten().fieldErrors);
  const input = parsed.data;
  if (input.owningDepartmentId !== current.owningDepartmentId) await requireDepartmentScope(actor, input.owningDepartmentId);
  await assertReferences(input);

  const data = writableData(input);
  const completeness = computeSolutionCompleteness(data as unknown as Record<string, unknown>);

  await prisma.$transaction(async (tx) => {
    await tx.innovationSolution.update({
      where: { id: solutionId },
      data: { ...data, completionPct: completeness.percentage }, // ideaId/status untouched
    });
    await writeAudit(
      {
        actorUserId: actor.userId,
        action: AUDIT.SOLUTION_UPDATED,
        entityType: "INNOVATION_SOLUTION",
        entityId: solutionId,
        departmentId: input.owningDepartmentId,
        summary: "تحديث بيانات حل ابتكاري",
        after: { completionPct: completeness.percentage },
      },
      tx,
    );
  });
}

/** Columns an External Partner may ever write (still gated by the share allow-list). */
export const PARTNER_UPDATABLE_FIELDS = ["notes", "description", "technologies", "targetBeneficiaries", "risks"] as const;
const PARTNER_UPDATABLE = new Set<string>(PARTNER_UPDATABLE_FIELDS);

/**
 * 5.24.1 (متطلبات التطبيق، البند الثاني، ب+ت): شروط أهلية الحل لتقديمه لقياس الأثر —
 * (1) مستخدَم فعليًا (ليس في التخطيط/التصميم/التجريب)، (2) منذ 6 أشهر إلى 5 سنوات،
 * (3) لم يُقدَّم في دورة قياس سابقة إلا مع توضيح تطور كبير. تُستخدم كتحقق فعلي وليس
 * مجرد حقل بيانات — انظر استدعاءها في src/modules/impact/service.ts.
 */
export interface MeasurementEligibility {
  eligible: boolean;
  reasons: string[];
}
export function checkMeasurementEligibility(solution: {
  maturityStage: string;
  launchDate: Date | null;
  startDate: Date | null;
  previouslySubmittedForMeasurement: boolean;
  significantChangeNote: string | null;
}): MeasurementEligibility {
  const reasons: string[] = [];
  if (solution.maturityStage !== "OPERATIONAL") {
    reasons.push("الحل ما زال في مرحلة التخطيط أو التصميم أو التجريب (ليس التشغيل الفعلي)، ولا يجوز تقديمه لقياس الأثر بعد.");
  }
  const usageStart = solution.launchDate ?? solution.startDate;
  if (!usageStart) {
    reasons.push("لا يوجد تاريخ إطلاق أو تاريخ بدء مسجَّل لاحتساب مدة الاستخدام.");
  } else {
    const months = (Date.now() - usageStart.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
    if (months < 6) reasons.push(`مدة استخدام الحل أقل من 6 أشهر (${months.toFixed(1)} شهرًا تقريبًا)، ولم تُستوفَ المدة الدنيا المطلوبة.`);
    if (months > 60) reasons.push(`مدة استخدام الحل تجاوزت 5 سنوات (${(months / 12).toFixed(1)} سنة تقريبًا)، وهو خارج النافذة المسموحة إلا بحل بديل أحدث.`);
  }
  if (solution.previouslySubmittedForMeasurement && !solution.significantChangeNote?.trim()) {
    reasons.push("قُدّم هذا الحل في دورة قياس سابقة، ويلزم توضيح التطور الكبير الذي طرأ عليه قبل إعادة تقديمه.");
  }
  return { eligible: reasons.length === 0, reasons };
}

/**
 * Partner write path: gated by an ACTIVE ResourceShare whose allowedActions
 * include `update_fields` and whose allowedFields cover every touched field
 * (Phase 2C `requirePartnerFieldWrite`). Audited with the originating share id.
 */
export async function updateSharedSolutionFields(
  actor: AccessContext,
  solutionId: string,
  values: Record<string, string>,
): Promise<void> {
  const keys = Object.keys(values);
  if (keys.length === 0) throw new SolutionError("VALIDATION", "لا توجد حقول للتحديث");
  for (const k of keys) {
    if (!PARTNER_UPDATABLE.has(k)) throw new SolutionError("VALIDATION", `حقل غير قابل للتحديث: ${k}`);
  }
  const share = await requirePartnerFieldWrite(actor, "INNOVATION_SOLUTION", solutionId, keys, "update_fields");

  const data: Record<string, string | null> = {};
  for (const k of keys) data[k] = values[k]?.trim() ? values[k].trim() : null;

  await prisma.$transaction(async (tx) => {
    await tx.innovationSolution.update({ where: { id: solutionId }, data });
    await writeAudit(
      {
        actorUserId: actor.userId,
        action: AUDIT.SOLUTION_PARTNER_UPDATED,
        entityType: "INNOVATION_SOLUTION",
        entityId: solutionId,
        summary: "تحديث شريك لحقول مشتركة",
        metadata: { shareId: share.id, fields: keys },
      },
      tx,
    );
  });
}

/** Archive (never hard delete). Requires solution.archive. */
export async function archiveSolution(actor: AccessContext, solutionId: string): Promise<void> {
  requirePermission(actor, ARCHIVE);
  await requireScope(actor, "INNOVATION_SOLUTION", solutionId);
  const current = await prisma.innovationSolution.findUniqueOrThrow({
    where: { id: solutionId },
    select: { id: true, status: true, owningDepartmentId: true },
  });
  if (current.status === "ARCHIVED") throw new SolutionError("INVALID_STATE", "الحل مؤرشف بالفعل");

  await prisma.$transaction(async (tx) => {
    await tx.innovationSolution.update({
      where: { id: solutionId },
      // Archiving also withdraws publication, so an archived record can never
      // linger in the Viewer (PUBLISHED) scope.
      data: { status: "ARCHIVED", archivedAt: new Date(), archivedById: actor.userId, publishedAt: null },
    });
    await writeAudit(
      {
        actorUserId: actor.userId,
        action: AUDIT.SOLUTION_ARCHIVED,
        entityType: "INNOVATION_SOLUTION",
        entityId: solutionId,
        departmentId: current.owningDepartmentId,
        summary: "أرشفة حل ابتكاري",
        before: { status: current.status },
        after: { status: "ARCHIVED" },
      },
      tx,
    );
  });
}

/** Single solution, scope-enforced, with its relations and the Idea link. */
export async function getSolutionById(actor: AccessContext, solutionId: string) {
  requirePermission(actor, VIEW);
  await requireScope(actor, "INNOVATION_SOLUTION", solutionId);
  return prisma.innovationSolution.findUniqueOrThrow({
    where: { id: solutionId },
    select: {
      id: true, nameAr: true, description: true, problemStatement: true, source: true,
      maturityStage: true, implementationStatus: true, status: true, publishedAt: true,
      startDate: true, targetEndDate: true, actualEndDate: true, durationMonths: true,
      cost: true, targetBeneficiaries: true, technologies: true, risks: true, notes: true,
      launchDate: true, beneficiaryCount: true, achievedOrExpectedImpact: true, beneficiarySatisfactionPct: true,
      previouslySubmittedForMeasurement: true, significantChangeNote: true, innovationMethodologySource: true,
      digitalTransformationPlanLink: true, isSustained: true, sustainabilityOwner: true, sustainabilityPlan: true,
      portfolioStatus: true, externalReferenceId: true, solutionType: true, domain: true, executingEntity: true, operationalOwner: true,
      nextAction: true, nextActionDueDate: true, expectedImpact: true, achievedImpact: true, satisfactionMeasurementSource: true,
      satisfactionMeasurementDate: true, usageStartDate: true, stillInUse: true, usingDepartmentName: true, operationNotes: true,
      digitalTransformationObjective: true, innovationObjective: true, linkedInitiative: true, technologyTags: true, duplicateReason: true,
      completionPct: true, owningDepartmentId: true, ownerUserId: true,
      strategicObjectiveId: true, activityId: true, ideaId: true,
      createdAt: true, updatedAt: true, archivedAt: true,
      owningDepartment: { select: { nameAr: true } },
      owner: { select: { name: true } },
      activity: { select: { nameAr: true } },
      strategicObjective: { select: { titleAr: true } },
      idea: { select: { id: true, titleAr: true, status: true } },
    },
  });
}

export interface SolutionFilters {
  q?: string;
  maturityStage?: string;
  implementationStatus?: string;
  owningDepartmentId?: string;
  source?: string;
  includeArchived?: boolean;
}

/** Scope-filtered registry list (server-side filter is always AND-ed). */
export async function listSolutionsInScope(actor: AccessContext, filters: SolutionFilters = {}) {
  requirePermission(actor, VIEW);
  const scope = await solutionScopeWhere(actor);

  const and: Prisma.InnovationSolutionWhereInput[] = [scope];
  if (!filters.includeArchived) and.push({ status: { not: "ARCHIVED" } });
  if (filters.maturityStage) and.push({ maturityStage: filters.maturityStage as never });
  if (filters.implementationStatus) and.push({ implementationStatus: filters.implementationStatus as never });
  if (filters.owningDepartmentId) and.push({ owningDepartmentId: filters.owningDepartmentId });
  if (filters.source) and.push({ source: filters.source as never });
  if (filters.q?.trim()) {
    const q = filters.q.trim();
    and.push({
      OR: [
        { nameAr: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { problemStatement: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  return prisma.innovationSolution.findMany({
    where: { AND: and },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true, nameAr: true, source: true, maturityStage: true, implementationStatus: true,
      status: true, completionPct: true, evidenceReadinessPct: true, updatedAt: true, ideaId: true,
      portfolioStatus: true, beneficiaryCount: true, nextAction: true, nextActionDueDate: true, duplicateOfId: true,
      owningDepartment: { select: { nameAr: true, organization: { select: { nameAr: true } } } },
      owner: { select: { name: true } },
    },
  });
}

/** Filter options limited to what the caller can actually see. */
export async function listSolutionFilters(actor: AccessContext) {
  requirePermission(actor, VIEW);
  const scope = await solutionScopeWhere(actor);
  const rows = await prisma.innovationSolution.findMany({
    where: scope,
    select: { owningDepartment: { select: { id: true, nameAr: true } } },
  });
  const map = new Map<string, string>();
  for (const r of rows) if (r.owningDepartment) map.set(r.owningDepartment.id, r.owningDepartment.nameAr);
  return {
    departments: Array.from(map, ([id, nameAr]) => ({ id, nameAr })).sort((a, b) => a.nameAr.localeCompare(b.nameAr)),
  };
}

/** Departments the caller may own a solution in (create/edit form). */
export async function listOwnableDepartments(actor: AccessContext) {
  const es = effectiveScopes(actor);
  if (es.platform) return prisma.department.findMany({ orderBy: { nameAr: "asc" }, select: { id: true, nameAr: true } });
  return prisma.department.findMany({
    where: { OR: [{ id: { in: es.departmentIds } }, { organizationId: { in: es.organizationIds } }] },
    orderBy: { nameAr: "asc" },
    select: { id: true, nameAr: true },
  });
}

// ── 5.24.2 (بند 4): جوائز الحل الابتكاري ────────────────────────────────────
export async function listSolutionAwards(actor: AccessContext, solutionId: string) {
  requirePermission(actor, VIEW);
  await requireScope(actor, "INNOVATION_SOLUTION", solutionId);
  return prisma.solutionAward.findMany({ where: { solutionId, archivedAt: null }, orderBy: { awardedAt: "desc" } });
}

export async function addSolutionAward(actor: AccessContext, input: { solutionId: string; nameAr: string; level: "LOCAL" | "REGIONAL" | "INTERNATIONAL"; awardedAt: Date | null; evidenceNote: string | null }) {
  requirePermission(actor, UPDATE);
  await requireScope(actor, "INNOVATION_SOLUTION", input.solutionId);
  if (!input.nameAr.trim()) throw new SolutionError("VALIDATION", "اسم الجائزة مطلوب");
  return prisma.$transaction(async (tx) => {
    const created = await tx.solutionAward.create({ data: { solutionId: input.solutionId, nameAr: input.nameAr.trim(), level: input.level, awardedAt: input.awardedAt, evidenceNote: input.evidenceNote } });
    await writeAudit({ actorUserId: actor.userId, action: AUDIT.SOLUTION_AWARD_ADDED, entityType: "INNOVATION_SOLUTION", entityId: input.solutionId, summary: "إضافة جائزة للحل الابتكاري", metadata: { awardId: created.id, level: input.level } }, tx);
    return created;
  });
}

export async function removeSolutionAward(actor: AccessContext, solutionId: string, awardId: string) {
  requirePermission(actor, UPDATE);
  await requireScope(actor, "INNOVATION_SOLUTION", solutionId);
  await prisma.$transaction(async (tx) => {
    await tx.solutionAward.update({ where: { id: awardId, solutionId }, data: { archivedAt: new Date() } });
    await writeAudit({ actorUserId: actor.userId, action: AUDIT.SOLUTION_AWARD_REMOVED, entityType: "INNOVATION_SOLUTION", entityId: solutionId, summary: "إزالة جائزة من الحل الابتكاري", metadata: { awardId } }, tx);
  });
}
