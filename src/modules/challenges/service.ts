import type { Prisma } from "@prisma/client";

import { prisma } from "@/server/db";
import { writeAudit, AUDIT } from "@/server/audit";
import type { AccessContext } from "@/server/access-context";
import { requirePermission, requireDepartmentScope, effectiveScopes, AuthorizationError } from "@/server/authorization";
import { challengeSchema, challengeStatusSchema } from "./schema";

const VIEW = "challenge.view" as const;
const CREATE = "challenge.create" as const;
const UPDATE = "challenge.update" as const;
const ARCHIVE = "challenge.archive" as const;

export type ChallengeErrorCode = "VALIDATION" | "NOT_FOUND" | "BAD_REFERENCE" | "ALREADY_ARCHIVED" | "ALREADY_LINKED";
export class ChallengeError extends Error {
  code: ChallengeErrorCode;
  fieldErrors?: Record<string, string[]>;
  constructor(code: ChallengeErrorCode, message?: string, fieldErrors?: Record<string, string[]>) {
    super(message ?? code);
    this.name = "ChallengeError";
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

function challengeScopeWhere(ctx: AccessContext): Prisma.ChallengeWhereInput {
  const es = effectiveScopes(ctx);
  if (es.platform) return {};
  const or: Prisma.ChallengeWhereInput[] = [];
  if (es.departmentIds.length) or.push({ departmentId: { in: es.departmentIds } });
  if (es.organizationIds.length) or.push({ department: { organizationId: { in: es.organizationIds } } });
  if (or.length === 0) return { id: "__none__" };
  return { OR: or };
}

async function loadInScope(actor: AccessContext, challengeId: string) {
  requirePermission(actor, VIEW);
  const challenge = await prisma.challenge.findUnique({
    where: { id: challengeId },
    select: { id: true, status: true, departmentId: true, archivedAt: true },
  });
  if (!challenge) throw new ChallengeError("NOT_FOUND", "التحدي غير موجود");
  const es = effectiveScopes(actor);
  const inScope = es.platform || es.departmentIds.includes(challenge.departmentId);
  if (!inScope) {
    const dept = await prisma.department.findUnique({ where: { id: challenge.departmentId }, select: { organizationId: true } });
    if (!dept || !es.organizationIds.includes(dept.organizationId)) throw new AuthorizationError("OUT_OF_SCOPE");
  }
  return challenge;
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

export async function createChallenge(actor: AccessContext, raw: unknown): Promise<{ id: string }> {
  requirePermission(actor, CREATE);
  const parsed = challengeSchema.safeParse(raw);
  if (!parsed.success) throw new ChallengeError("VALIDATION", "invalid", parsed.error.flatten().fieldErrors);
  const input = parsed.data;
  await requireDepartmentScope(actor, input.departmentId);

  const dept = await prisma.department.findUnique({ where: { id: input.departmentId }, select: { id: true } });
  if (!dept) throw new ChallengeError("BAD_REFERENCE", "الجهة المحددة غير موجودة");

  return prisma.$transaction(async (tx) => {
    const created = await tx.challenge.create({
      data: { ...input, submittedById: actor.userId, status: "NEW" },
      select: { id: true },
    });
    await writeAudit(
      {
        actorUserId: actor.userId,
        action: AUDIT.CHALLENGE_CREATED,
        entityType: "CHALLENGE",
        entityId: created.id,
        departmentId: input.departmentId,
        summary: "تسجيل تحدٍّ جديد",
        after: { titleAr: input.titleAr, departmentId: input.departmentId },
      },
      tx,
    );
    return created;
  });
}

export async function updateChallenge(actor: AccessContext, challengeId: string, raw: unknown): Promise<void> {
  const current = await loadInScope(actor, challengeId);
  requirePermission(actor, UPDATE);
  if (current.archivedAt) throw new ChallengeError("ALREADY_ARCHIVED", "لا يمكن تعديل تحدٍّ مؤرشف");

  const parsed = challengeSchema.safeParse(raw);
  if (!parsed.success) throw new ChallengeError("VALIDATION", "invalid", parsed.error.flatten().fieldErrors);
  const input = parsed.data;
  await requireDepartmentScope(actor, input.departmentId);
  const dept = await prisma.department.findUnique({ where: { id: input.departmentId }, select: { id: true } });
  if (!dept) throw new ChallengeError("BAD_REFERENCE", "الجهة المحددة غير موجودة");

  await prisma.$transaction(async (tx) => {
    await tx.challenge.update({ where: { id: challengeId }, data: input });
    await writeAudit(
      {
        actorUserId: actor.userId,
        action: AUDIT.CHALLENGE_UPDATED,
        entityType: "CHALLENGE",
        entityId: challengeId,
        departmentId: input.departmentId,
        summary: "تحديث بيانات تحدٍّ",
        after: { titleAr: input.titleAr },
      },
      tx,
    );
  });
}

/** Status transition (NEW → ... → RESOLVED/CLOSED_WITHOUT_SOLUTION), independent of archival. */
export async function updateChallengeStatus(actor: AccessContext, challengeId: string, raw: unknown): Promise<void> {
  const current = await loadInScope(actor, challengeId);
  requirePermission(actor, UPDATE);
  if (current.archivedAt) throw new ChallengeError("ALREADY_ARCHIVED", "لا يمكن تعديل تحدٍّ مؤرشف");

  const parsed = challengeStatusSchema.safeParse(raw);
  if (!parsed.success) throw new ChallengeError("VALIDATION", "invalid", parsed.error.flatten().fieldErrors);

  await prisma.$transaction(async (tx) => {
    await tx.challenge.update({ where: { id: challengeId }, data: { status: parsed.data.status } });
    await writeAudit(
      {
        actorUserId: actor.userId,
        action: AUDIT.CHALLENGE_UPDATED,
        entityType: "CHALLENGE",
        entityId: challengeId,
        departmentId: current.departmentId,
        summary: "تحديث حالة تحدٍّ",
        before: { status: current.status },
        after: { status: parsed.data.status },
      },
      tx,
    );
  });
}

/**
 * Archive stays separate from `status` (mirrors Idea/Committee/StrategicObjective
 * archival pattern): restoring a challenge would otherwise lose its last
 * real status. No restore action is built yet — not needed by any screen in
 * this delivery.
 */
export async function archiveChallenge(actor: AccessContext, challengeId: string): Promise<void> {
  const current = await loadInScope(actor, challengeId);
  requirePermission(actor, ARCHIVE);
  if (current.archivedAt) throw new ChallengeError("ALREADY_ARCHIVED", "التحدي مؤرشف بالفعل");

  await prisma.$transaction(async (tx) => {
    await tx.challenge.update({ where: { id: challengeId }, data: { archivedAt: new Date(), archivedById: actor.userId } });
    await writeAudit(
      {
        actorUserId: actor.userId,
        action: AUDIT.CHALLENGE_ARCHIVED,
        entityType: "CHALLENGE",
        entityId: challengeId,
        departmentId: current.departmentId,
        summary: "أرشفة تحدٍّ",
        before: { status: current.status },
      },
      tx,
    );
  });
}

export interface ChallengeListRow {
  id: string;
  titleAr: string;
  category: string | null;
  departmentName: string | null;
  status: string;
  descriptionSnippet: string | null;
  updatedAt: Date;
}

export async function listChallengesInScope(
  actor: AccessContext,
  opts?: { includeArchived?: boolean; departmentId?: string; status?: string; q?: string },
): Promise<ChallengeListRow[]> {
  requirePermission(actor, VIEW);
  const scope = challengeScopeWhere(actor);
  const and: Prisma.ChallengeWhereInput[] = [scope];
  if (!opts?.includeArchived) and.push({ archivedAt: null });
  if (opts?.departmentId) and.push({ departmentId: opts.departmentId });
  if (opts?.status) and.push({ status: opts.status as never });
  if (opts?.q?.trim()) {
    const q = opts.q.trim();
    and.push({ OR: [{ titleAr: { contains: q, mode: "insensitive" } }, { description: { contains: q, mode: "insensitive" } }] });
  }

  const rows = await prisma.challenge.findMany({
    where: { AND: and },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      titleAr: true,
      category: true,
      description: true,
      status: true,
      updatedAt: true,
      department: { select: { nameAr: true } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    titleAr: r.titleAr,
    category: r.category,
    departmentName: r.department?.nameAr ?? null,
    status: r.status,
    descriptionSnippet: r.description ? (r.description.length > 140 ? `${r.description.slice(0, 140)}…` : r.description) : null,
    updatedAt: r.updatedAt,
  }));
}

export async function getChallenge(actor: AccessContext, challengeId: string) {
  await loadInScope(actor, challengeId);
  return prisma.challenge.findUniqueOrThrow({
    where: { id: challengeId },
    include: {
      department: { select: { id: true, nameAr: true } },
      solutions: { include: { solution: { select: { id: true, nameAr: true, maturityStage: true, implementationStatus: true } } } },
    },
  });
}

export function computeChallengeFlags(actor: AccessContext, challenge: { archivedAt: Date | null; departmentId: string | null }) {
  const es = effectiveScopes(actor);
  const inScope = es.platform || (challenge.departmentId != null && es.departmentIds.includes(challenge.departmentId));
  return {
    canEdit: actor.permissions.has(UPDATE) && inScope && !challenge.archivedAt,
    canArchive: actor.permissions.has(ARCHIVE) && inScope && !challenge.archivedAt,
    canLinkSolution: actor.permissions.has(UPDATE) && inScope && !challenge.archivedAt,
  };
}

// ── Challenge ↔ Solution linking ────────────────────────────────────────

export async function linkChallengeSolution(actor: AccessContext, challengeId: string, solutionId: string): Promise<void> {
  const challenge = await loadInScope(actor, challengeId);
  requirePermission(actor, UPDATE);
  if (challenge.archivedAt) throw new ChallengeError("ALREADY_ARCHIVED", "لا يمكن ربط حل بتحدٍّ مؤرشف");

  const solution = await prisma.innovationSolution.findUnique({ where: { id: solutionId }, select: { id: true } });
  if (!solution) throw new ChallengeError("BAD_REFERENCE", "الحل المحدد غير موجود");

  const existing = await prisma.challengeSolution.findUnique({
    where: { challengeId_solutionId: { challengeId, solutionId } },
  });
  if (existing) throw new ChallengeError("ALREADY_LINKED", "هذا الحل مرتبط بالتحدي بالفعل");

  await prisma.$transaction(async (tx) => {
    await tx.challengeSolution.create({ data: { challengeId, solutionId, linkedById: actor.userId } });
    // A challenge with at least one proposed solution is no longer just "NEW".
    if (challenge.status === "NEW" || challenge.status === "UNDER_REVIEW") {
      await tx.challenge.update({ where: { id: challengeId }, data: { status: "SOLUTION_PROPOSED" } });
    }
    await writeAudit(
      {
        actorUserId: actor.userId,
        action: AUDIT.CHALLENGE_SOLUTION_LINKED,
        entityType: "CHALLENGE",
        entityId: challengeId,
        summary: "ربط حل بتحدٍّ",
        after: { solutionId },
      },
      tx,
    );
  });
}

export async function unlinkChallengeSolution(actor: AccessContext, challengeId: string, solutionId: string): Promise<void> {
  const challenge = await loadInScope(actor, challengeId);
  requirePermission(actor, UPDATE);
  if (challenge.archivedAt) throw new ChallengeError("ALREADY_ARCHIVED", "لا يمكن تعديل روابط تحدٍّ مؤرشف");

  await prisma.$transaction(async (tx) => {
    await tx.challengeSolution.delete({ where: { challengeId_solutionId: { challengeId, solutionId } } });
    await writeAudit(
      {
        actorUserId: actor.userId,
        action: AUDIT.CHALLENGE_SOLUTION_UNLINKED,
        entityType: "CHALLENGE",
        entityId: challengeId,
        summary: "إلغاء ربط حل بتحدٍّ",
        before: { solutionId },
      },
      tx,
    );
  });
}

/** Challenges linked to a given solution — used by the solution detail page (reverse direction of the linking above). */
export interface ChallengeForSolutionRow {
  id: string;
  titleAr: string;
  status: string;
}
export async function listChallengesForSolution(actor: AccessContext, solutionId: string): Promise<ChallengeForSolutionRow[]> {
  requirePermission(actor, VIEW);
  const links = await prisma.challengeSolution.findMany({
    where: { solutionId },
    select: { challenge: { select: { id: true, titleAr: true, status: true, archivedAt: true } } },
  });
  return links.filter((l) => !l.challenge.archivedAt).map((l) => ({ id: l.challenge.id, titleAr: l.challenge.titleAr, status: l.challenge.status }));
}
