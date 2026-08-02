import type { Prisma } from "@prisma/client";

import { prisma } from "@/server/db";
import { writeAudit, AUDIT } from "@/server/audit";
import type { AccessContext } from "@/server/access-context";
import { requirePermission, requireScope, effectiveScopes, AuthorizationError } from "@/server/authorization";
import { evaluateFieldRule } from "./rules";
import {
  scoreRequirement,
  weightedRollup,
  readinessBand,
  type ScoredFieldItem,
  type ScoredEvidenceItem,
  type RequirementScore,
  type RollupItem,
} from "./scoring";
import { requirementConfigSchema, sectionConfigSchema, type RequirementConfigInput, type SectionConfigInput } from "./schema";

const VIEW = "compliance.view" as const;
const CONFIGURE = "compliance.configure" as const;

export type ComplianceErrorCode =
  | "NOT_FOUND"
  | "NOT_INTERNAL"
  | "VALIDATION"
  | "NA_NOT_ALLOWED"
  | "NA_INVALID_STATE"
  | "PLATFORM_REQUIRED";

export class ComplianceError extends Error {
  code: ComplianceErrorCode;
  fieldErrors?: Record<string, string[]>;
  constructor(code: ComplianceErrorCode, message?: string, fieldErrors?: Record<string, string[]>) {
    super(message ?? code);
    this.name = "ComplianceError";
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

/** Solution columns exposed to field rules (data-driven readable whitelist). */
const SOLUTION_SELECT = {
  id: true,
  nameAr: true,
  description: true,
  problemStatement: true,
  owningDepartmentId: true,
  strategicObjectiveId: true,
  ownerUserId: true,
  maturityStage: true,
  implementationStatus: true,
  startDate: true,
  targetEndDate: true,
  actualEndDate: true,
  durationMonths: true,
  cost: true,
  targetBeneficiaries: true,
  technologies: true,
  completionPct: true,
  risks: true,
  notes: true,
  publishedAt: true,
  owningDepartment: { select: { nameAr: true, organizationId: true } },
} satisfies Prisma.InnovationSolutionSelect;

type SolutionRow = Prisma.InnovationSolutionGetPayload<{ select: typeof SOLUTION_SELECT }>;

/**
 * Compliance detail is INTERNAL-only: the caller must reach the solution through
 * department/organization/platform scope — never a partner share or the
 * published projection (viewers must not reach raw compliance detail, MVP §5.10).
 */
async function requireInternalSolution(
  actor: AccessContext,
  solutionId: string,
  permission: typeof VIEW | typeof CONFIGURE,
): Promise<SolutionRow> {
  requirePermission(actor, permission);
  await requireScope(actor, "INNOVATION_SOLUTION", solutionId); // NOT_FOUND | OUT_OF_SCOPE
  const solution = await prisma.innovationSolution.findUnique({ where: { id: solutionId }, select: SOLUTION_SELECT });
  if (!solution) throw new ComplianceError("NOT_FOUND", "الحل غير موجود");
  const es = effectiveScopes(actor);
  const internal =
    es.platform ||
    (!!solution.owningDepartmentId && es.departmentIds.includes(solution.owningDepartmentId)) ||
    (!!solution.owningDepartment && es.organizationIds.includes(solution.owningDepartment.organizationId));
  if (!internal) throw new ComplianceError("NOT_INTERNAL", "ملف الامتثال متاح للفريق الداخلي فقط");
  return solution;
}

/** Global (platform-level) configuration privilege. */
function requireConfigurePrivilege(actor: AccessContext): void {
  requirePermission(actor, CONFIGURE);
  if (!effectiveScopes(actor).platform) {
    throw new ComplianceError("PLATFORM_REQUIRED", "ضبط متطلبات الامتثال يتطلب نطاقًا على مستوى المنصة");
  }
}

function solutionValidationErrors(s: SolutionRow): { field: string; message: string }[] {
  const errs: { field: string; message: string }[] = [];
  if (s.startDate && s.targetEndDate && s.targetEndDate < s.startDate) {
    errs.push({ field: "targetEndDate", message: "تاريخ الانتهاء المستهدف قبل تاريخ البدء" });
  }
  if (s.startDate && s.actualEndDate && s.actualEndDate < s.startDate) {
    errs.push({ field: "actualEndDate", message: "تاريخ الانتهاء الفعلي قبل تاريخ البدء" });
  }
  return errs;
}

// ── The on-screen compliance file (per solution) ────────────────────────────

export interface GapField {
  key: string;
  label: string;
  reason: string;
  gate: boolean;
}
export interface GapEvidence {
  key: string;
  label: string;
  have: number;
  need: number;
  gate: boolean;
}
export interface RequirementFileEntry {
  requirementId: string;
  code: string;
  titleAr: string;
  description: string | null;
  sectionCode: string | null;
  allowNA: boolean;
  isEstimated: boolean;
  score: RequirementScore | null;
  excluded: boolean;
  naStatus: { state: string; reason: string | null; naId: string | null; approvedById: string | null };
  fields: ScoredFieldItem[];
  optionalFields: ScoredFieldItem[];
  evidence: ScoredEvidenceItem[];
  missingFields: GapField[];
  missingEvidence: GapEvidence[];
  validationErrors: { field: string; message: string }[];
  unconfigured: boolean;
}
export interface SectionFileEntry {
  code: string;
  titleAr: string;
  sectionWeight: number;
  readiness: number | null;
  band: ReturnType<typeof readinessBand> | null;
  requirements: RequirementFileEntry[];
}
export interface ComplianceFile {
  solution: { id: string; nameAr: string; departmentAr: string | null };
  overallReadiness: number | null;
  overallBand: ReturnType<typeof readinessBand> | null;
  sections: SectionFileEntry[];
  generatedAt: string;
  validationErrors: { field: string; message: string }[];
}

/** Field value from the solution record (undefined for unknown keys → a gap). */
function solutionFieldValue(s: SolutionRow, key: string): unknown {
  return (s as unknown as Record<string, unknown>)[key];
}

/**
 * Compute the full, explainable compliance file for one solution: every active
 * requirement's estimated readiness, gate status, missing fields/evidence, N/A
 * state, validation errors, and the weighted section/overall rollups. Read-only
 * and computed on demand (compliance-rules.md §8) — it never writes readiness.
 */
export async function getComplianceFile(actor: AccessContext, solutionId: string): Promise<ComplianceFile> {
  const solution = await requireInternalSolution(actor, solutionId, VIEW);

  const [sections, requirements, approvedEvidence] = await Promise.all([
    prisma.complianceSection.findMany({ where: { isActive: true }, orderBy: [{ orderIndex: "asc" }, { code: "asc" }] }),
    prisma.complianceRequirement.findMany({
      where: { isActive: true },
      orderBy: { code: "asc" },
      include: { fieldRules: { orderBy: [{ orderIndex: "asc" }, { fieldKey: "asc" }] }, evidenceRules: true },
    }),
    prisma.evidence.findMany({
      where: { reviewStatus: "APPROVED", links: { some: { entityType: "INNOVATION_SOLUTION", entityId: solutionId } } },
      select: {
        id: true,
        classification: true,
        links: { where: { entityType: "COMPLIANCE_REQUIREMENT" }, select: { entityId: true, requirementId: true } },
      },
    }),
  ]);

  const reqIds = requirements.map((r) => r.id);
  const naRows = reqIds.length
    ? await prisma.complianceNA.findMany({ where: { requirementId: { in: reqIds } }, orderBy: { createdAt: "desc" } })
    : [];
  const requirementWeightById = new Map(requirements.map((r) => [r.id, r.requirementWeight]));

  const fileValidation = solutionValidationErrors(solution);

  // Latest applicable N/A per requirement (global scope, or scoped to this solution).
  const naByReq = new Map<string, (typeof naRows)[number]>();
  for (const na of naRows) {
    const scope = na.scopeRef as { solutionId?: string } | null;
    const applies = !scope || !scope.solutionId || scope.solutionId === solutionId;
    if (applies && !naByReq.has(na.requirementId)) naByReq.set(na.requirementId, na); // first = most recent
  }

  const entries: RequirementFileEntry[] = requirements.map((req) => {
    // Fields (required scored + optional informational).
    const allFields: ScoredFieldItem[] = req.fieldRules.map((fr) => {
      const value = solutionFieldValue(solution, fr.fieldKey);
      const optional = fr.optional || fr.rule.trim() === "optional" || fr.weight === 0;
      const res = evaluateFieldRule(fr.rule, value);
      return {
        key: fr.fieldKey,
        label: fr.labelAr ?? fr.fieldKey,
        weight: fr.weight,
        mandatoryGate: fr.mandatoryGate,
        optional,
        satisfied: res.satisfied,
        reason: res.reason,
      };
    });
    const scoredFields = allFields.filter((f) => !f.optional);
    const optionalFields = allFields.filter((f) => f.optional);

    // Evidence: count APPROVED evidence linked to BOTH this requirement and the
    // solution, grouped by classification (= evidenceTypeKey).
    const matching = approvedEvidence.filter((e) => e.links.some((l) => l.entityId === req.id || l.requirementId === req.id));
    const evidence: ScoredEvidenceItem[] = req.evidenceRules.map((er) => {
      const have = matching.filter((e) => e.classification === er.evidenceTypeKey).length;
      return {
        key: er.evidenceTypeKey,
        label: er.labelAr ?? er.evidenceTypeKey,
        weight: er.weight,
        minCount: er.minCount,
        have,
        mandatoryGate: er.mandatoryGate,
        satisfied: have >= er.minCount,
      };
    });

    const na = naByReq.get(req.id);
    const naState = na?.state ?? "NONE";
    const excludedByNA = naState === "APPROVED";

    const score = scoreRequirement({
      requirementWeight: req.requirementWeight,
      gateCeiling: req.gateCeiling,
      fields: scoredFields,
      evidence,
    });

    const missingFields: GapField[] = scoredFields
      .filter((f) => !f.satisfied)
      .map((f) => ({ key: f.key, label: f.label, reason: f.reason ?? "غير مُستوفى", gate: f.mandatoryGate }));
    const missingEvidence: GapEvidence[] = evidence
      .filter((e) => !e.satisfied)
      .map((e) => ({ key: e.key, label: e.label, have: e.have, need: e.minCount, gate: e.mandatoryGate }));

    const reqFieldKeys = new Set(req.fieldRules.map((fr) => fr.fieldKey));
    const validationErrors = fileValidation.filter((v) => reqFieldKeys.has(v.field));

    return {
      requirementId: req.id,
      code: req.code,
      titleAr: req.titleAr,
      description: req.description,
      sectionCode: req.sectionCode,
      allowNA: req.allowNA,
      isEstimated: req.isEstimated,
      score,
      excluded: excludedByNA || score.unconfigured,
      naStatus: { state: naState, reason: na?.reason ?? null, naId: na?.id ?? null, approvedById: na?.approvedById ?? null },
      fields: scoredFields,
      optionalFields,
      evidence,
      missingFields,
      missingEvidence,
      validationErrors,
      unconfigured: score.unconfigured,
    };
  });

  // Group into sections (requirements without a section fall into a synthetic bucket).
  const byCode = new Map<string, SectionFileEntry>();
  for (const s of sections) {
    byCode.set(s.code, { code: s.code, titleAr: s.titleAr, sectionWeight: s.sectionWeight, readiness: null, band: null, requirements: [] });
  }
  const UNSECTIONED = "—";
  for (const entry of entries) {
    const key = entry.sectionCode && byCode.has(entry.sectionCode) ? entry.sectionCode : UNSECTIONED;
    if (!byCode.has(key)) byCode.set(key, { code: key, titleAr: "غير مصنّف", sectionWeight: 1, readiness: null, band: null, requirements: [] });
    byCode.get(key)!.requirements.push(entry);
  }

  const sectionEntries: SectionFileEntry[] = [];
  for (const section of byCode.values()) {
    if (section.requirements.length === 0) continue;
    const items: RollupItem[] = section.requirements.map((r) => ({
      weight: requirementWeightById.get(r.requirementId) ?? 1,
      readiness: r.score?.estimatedReadiness ?? 0,
      excluded: r.excluded,
    }));
    const readiness = weightedRollup(items);
    section.readiness = readiness;
    section.band = readiness === null ? null : readinessBand(readiness);
    sectionEntries.push(section);
  }

  const overallItems: RollupItem[] = sectionEntries
    .filter((s) => s.readiness !== null)
    .map((s) => ({ weight: s.sectionWeight, readiness: s.readiness as number, excluded: false }));
  const overallReadiness = weightedRollup(overallItems);

  return {
    solution: { id: solution.id, nameAr: solution.nameAr, departmentAr: solution.owningDepartment?.nameAr ?? null },
    overallReadiness,
    overallBand: overallReadiness === null ? null : readinessBand(overallReadiness),
    sections: sectionEntries,
    generatedAt: new Date().toISOString(),
    validationErrors: fileValidation,
  };
}

// ── Overview: internally-reachable solutions with overall estimated readiness ──

export interface ComplianceOverviewRow {
  solutionId: string;
  nameAr: string;
  departmentAr: string | null;
  overallReadiness: number | null;
}

/**
 * List solutions the caller can reach INTERNALLY, each with its overall estimated
 * readiness. Viewers/partners (no internal scope) get an empty list — raw
 * compliance detail is never exposed to them.
 */
export async function listComplianceOverview(actor: AccessContext): Promise<ComplianceOverviewRow[]> {
  requirePermission(actor, VIEW);
  const es = effectiveScopes(actor);

  const where: Prisma.InnovationSolutionWhereInput = es.platform
    ? {}
    : {
        OR: [
          ...(es.departmentIds.length ? [{ owningDepartmentId: { in: es.departmentIds } }] : []),
          ...(es.organizationIds.length ? [{ owningDepartment: { organizationId: { in: es.organizationIds } } }] : []),
        ],
      };
  // No internal grants → nothing to show.
  if (!es.platform && !es.departmentIds.length && !es.organizationIds.length) return [];

  const solutions = await prisma.innovationSolution.findMany({
    where: { AND: [where, { status: { not: "ARCHIVED" } }] },
    orderBy: { nameAr: "asc" },
    select: { id: true, nameAr: true, owningDepartment: { select: { nameAr: true } } },
  });

  const rows: ComplianceOverviewRow[] = [];
  for (const s of solutions) {
    const file = await getComplianceFile(actor, s.id);
    rows.push({ solutionId: s.id, nameAr: s.nameAr, departmentAr: s.owningDepartment?.nameAr ?? null, overallReadiness: file.overallReadiness });
  }
  return rows;
}

// ── Governed N/A (request → approve/reject/revoke) ──────────────────────────

function auditScope(solution: SolutionRow) {
  return { departmentId: solution.owningDepartmentId, organizationId: solution.owningDepartment?.organizationId ?? null };
}

/** Request an N/A exception. Requires the requirement to permit N/A (`allowNA`). */
export async function requestNA(actor: AccessContext, input: { requirementId: string; solutionId: string; reason: string }): Promise<{ id: string }> {
  const solution = await requireInternalSolution(actor, input.solutionId, CONFIGURE);
  const req = await prisma.complianceRequirement.findUnique({ where: { id: input.requirementId }, select: { id: true, code: true, allowNA: true } });
  if (!req) throw new ComplianceError("NOT_FOUND", "المتطلب غير موجود");
  if (!req.allowNA) throw new ComplianceError("NA_NOT_ALLOWED", "لا يسمح هذا المتطلب باستثناء عدم الانطباق");

  return prisma.$transaction(async (tx) => {
    const na = await tx.complianceNA.create({
      data: {
        requirementId: req.id,
        reason: input.reason.trim(),
        state: "REQUESTED",
        scopeRef: { solutionId: input.solutionId } as Prisma.InputJsonValue,
        requestedById: actor.userId,
      },
      select: { id: true },
    });
    await writeAudit(
      {
        actorUserId: actor.userId,
        action: AUDIT.COMPLIANCE_NA_REQUESTED,
        entityType: "COMPLIANCE_REQUIREMENT",
        entityId: req.id,
        ...auditScope(solution),
        summary: "طلب استثناء عدم انطباق لمتطلب",
        metadata: { naId: na.id, solutionId: input.solutionId, requirementCode: req.code },
      },
      tx,
    );
    return na;
  });
}

async function transitionNA(
  actor: AccessContext,
  naId: string,
  solutionId: string,
  to: "APPROVED" | "REJECTED" | "REVOKED",
  action: string,
  summary: string,
): Promise<void> {
  const solution = await requireInternalSolution(actor, solutionId, CONFIGURE);
  const na = await prisma.complianceNA.findUnique({ where: { id: naId }, select: { id: true, state: true, requirementId: true } });
  if (!na) throw new ComplianceError("NOT_FOUND", "طلب الاستثناء غير موجود");

  // Legal transitions: REQUESTED → APPROVED | REJECTED; APPROVED → REVOKED.
  const ok =
    (to === "APPROVED" && na.state === "REQUESTED") ||
    (to === "REJECTED" && na.state === "REQUESTED") ||
    (to === "REVOKED" && na.state === "APPROVED");
  if (!ok) throw new ComplianceError("NA_INVALID_STATE", "انتقال غير مسموح لحالة الاستثناء");

  await prisma.$transaction(async (tx) => {
    await tx.complianceNA.update({
      where: { id: naId },
      data: {
        state: to,
        ...(to === "APPROVED" ? { approvedById: actor.userId, approvedAt: new Date() } : {}),
        ...(to === "REVOKED" ? { revokedById: actor.userId, revokedAt: new Date() } : {}),
      },
    });
    await writeAudit(
      {
        actorUserId: actor.userId,
        action,
        entityType: "COMPLIANCE_REQUIREMENT",
        entityId: na.requirementId,
        ...auditScope(solution),
        summary,
        before: { state: na.state },
        after: { state: to },
        metadata: { naId, solutionId },
      },
      tx,
    );
  });
}

export const approveNA = (a: AccessContext, naId: string, solutionId: string) =>
  transitionNA(a, naId, solutionId, "APPROVED", AUDIT.COMPLIANCE_NA_APPROVED, "اعتماد استثناء عدم الانطباق");
export const rejectNA = (a: AccessContext, naId: string, solutionId: string) =>
  transitionNA(a, naId, solutionId, "REJECTED", AUDIT.COMPLIANCE_NA_REJECTED, "رفض طلب استثناء عدم الانطباق");
export const revokeNA = (a: AccessContext, naId: string, solutionId: string) =>
  transitionNA(a, naId, solutionId, "REVOKED", AUDIT.COMPLIANCE_NA_REVOKED, "إلغاء استثناء عدم الانطباق");

// ── Configuration (data-driven; no scoring logic in code) ───────────────────

/** List the full requirement configuration (for admin/config surfaces). */
export async function listRequirementConfig(actor: AccessContext) {
  requirePermission(actor, VIEW);
  return prisma.complianceRequirement.findMany({
    orderBy: { code: "asc" },
    include: { fieldRules: { orderBy: { fieldKey: "asc" } }, evidenceRules: { orderBy: { evidenceTypeKey: "asc" } }, section: true },
  });
}

export async function upsertSection(actor: AccessContext, raw: unknown): Promise<{ id: string }> {
  requireConfigurePrivilege(actor);
  const parsed = sectionConfigSchema.safeParse(raw);
  if (!parsed.success) throw new ComplianceError("VALIDATION", "بيانات غير صالحة", parsed.error.flatten().fieldErrors);
  const input: SectionConfigInput = parsed.data;
  const existing = await prisma.complianceSection.findUnique({ where: { code: input.code }, select: { id: true } });
  const section = await prisma.complianceSection.upsert({
    where: { code: input.code },
    update: { titleAr: input.titleAr, description: input.description, sectionWeight: input.sectionWeight, orderIndex: input.orderIndex, isActive: input.isActive },
    create: { code: input.code, titleAr: input.titleAr, description: input.description, sectionWeight: input.sectionWeight, orderIndex: input.orderIndex, isActive: input.isActive },
    select: { id: true },
  });
  await writeAudit({
    actorUserId: actor.userId,
    action: existing ? AUDIT.COMPLIANCE_SECTION_UPDATED : AUDIT.COMPLIANCE_SECTION_CREATED,
    entityType: "COMPLIANCE_REQUIREMENT",
    entityId: section.id,
    summary: existing ? "تعديل قسم امتثال" : "إنشاء قسم امتثال",
    metadata: { code: input.code },
  });
  return section;
}

/**
 * Create or fully replace a requirement's scoring configuration. Rules are
 * replaced atomically, the version is bumped, and an immutable snapshot is kept
 * for audit (compliance-rules.md §11). No weights/gates/thresholds live in code.
 */
export async function upsertRequirementConfig(actor: AccessContext, raw: unknown): Promise<{ id: string; version: number }> {
  requireConfigurePrivilege(actor);
  const parsed = requirementConfigSchema.safeParse(raw);
  if (!parsed.success) throw new ComplianceError("VALIDATION", "بيانات غير صالحة", parsed.error.flatten().fieldErrors);
  const input: RequirementConfigInput = parsed.data;

  return prisma.$transaction(async (tx) => {
    const existing = await tx.complianceRequirement.findUnique({ where: { code: input.code }, select: { id: true, version: true } });
    const section = input.sectionCode
      ? await tx.complianceSection.findUnique({ where: { code: input.sectionCode }, select: { id: true } })
      : null;
    const nextVersion = (existing?.version ?? 0) + 1;

    const req = await tx.complianceRequirement.upsert({
      where: { code: input.code },
      update: {
        titleAr: input.titleAr,
        description: input.description,
        sectionCode: input.sectionCode ?? null,
        sectionId: section?.id ?? null,
        entityType: input.entityType ?? null,
        requirementWeight: input.requirementWeight,
        gateCeiling: input.gateCeiling,
        allowNA: input.allowNA,
        isActive: input.isActive,
        version: nextVersion,
      },
      create: {
        code: input.code,
        titleAr: input.titleAr,
        description: input.description,
        sectionCode: input.sectionCode ?? null,
        sectionId: section?.id ?? null,
        entityType: input.entityType ?? null,
        requirementWeight: input.requirementWeight,
        gateCeiling: input.gateCeiling,
        allowNA: input.allowNA,
        isActive: input.isActive,
        version: nextVersion,
      },
      select: { id: true },
    });

    // Replace rules atomically.
    await tx.requirementFieldRule.deleteMany({ where: { requirementId: req.id } });
    await tx.requirementEvidenceRule.deleteMany({ where: { requirementId: req.id } });
    for (const f of input.fields) {
      await tx.requirementFieldRule.create({
        data: {
          requirementId: req.id,
          fieldKey: f.fieldKey,
          labelAr: f.labelAr,
          rule: f.rule,
          weight: f.weight,
          mandatoryGate: f.mandatoryGate,
          optional: f.optional,
          orderIndex: f.orderIndex,
        },
      });
    }
    for (const e of input.evidenceTypes) {
      await tx.requirementEvidenceRule.create({
        data: {
          requirementId: req.id,
          evidenceTypeKey: e.evidenceTypeKey,
          labelAr: e.labelAr,
          minCount: e.minCount,
          weight: e.weight,
          mandatoryGate: e.mandatoryGate,
        },
      });
    }

    // Immutable snapshot of the full config at this version.
    await tx.complianceRequirementVersion.create({
      data: {
        requirementId: req.id,
        version: nextVersion,
        snapshot: input as unknown as Prisma.InputJsonValue,
        createdById: actor.userId,
      },
    });

    await writeAudit(
      {
        actorUserId: actor.userId,
        action: existing ? AUDIT.COMPLIANCE_REQUIREMENT_UPDATED : AUDIT.COMPLIANCE_REQUIREMENT_CREATED,
        entityType: "COMPLIANCE_REQUIREMENT",
        entityId: req.id,
        summary: existing ? "تعديل إعداد متطلب امتثال" : "إنشاء متطلب امتثال",
        metadata: { code: input.code, version: nextVersion, fields: input.fields.length, evidenceTypes: input.evidenceTypes.length },
      },
      tx,
    );
    return { id: req.id, version: nextVersion };
  });
}

/** Activate/deactivate a requirement (deactivation removes it from rollups). */
export async function setRequirementActive(actor: AccessContext, code: string, isActive: boolean): Promise<void> {
  requireConfigurePrivilege(actor);
  const req = await prisma.complianceRequirement.findUnique({ where: { code }, select: { id: true, isActive: true } });
  if (!req) throw new ComplianceError("NOT_FOUND", "المتطلب غير موجود");
  await prisma.$transaction(async (tx) => {
    await tx.complianceRequirement.update({ where: { code }, data: { isActive } });
    await writeAudit(
      {
        actorUserId: actor.userId,
        action: isActive ? AUDIT.COMPLIANCE_REQUIREMENT_ACTIVATED : AUDIT.COMPLIANCE_REQUIREMENT_DEACTIVATED,
        entityType: "COMPLIANCE_REQUIREMENT",
        entityId: req.id,
        summary: isActive ? "تفعيل متطلب امتثال" : "تعطيل متطلب امتثال",
        before: { isActive: req.isActive },
        after: { isActive },
        metadata: { code },
      },
      tx,
    );
  });
}

/** Re-throw helper so callers can distinguish scope failures. */
export function isComplianceScopeError(e: unknown): e is AuthorizationError {
  return e instanceof AuthorizationError;
}
