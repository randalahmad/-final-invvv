import { prisma } from "@/server/db";
import { writeAudit, AUDIT } from "@/server/audit";
import type { AccessContext } from "@/server/access-context";
import { requirePermission, requireScope, PARTNER_FORBIDDEN_FIELDS, isShareActive } from "@/server/authorization";
import { SolutionError, PARTNER_UPDATABLE_FIELDS } from "./service";

const UPDATE = "solution.update" as const;
const VIEW = "solution.view" as const;

/** Actions a share may permit (kept to what the platform actually enforces). */
export const SHAREABLE_ACTIONS = ["update_fields", "evidence.create", "respond_info_request"] as const;

export interface GrantShareInput {
  userId: string;
  allowedActions: string[];
  allowedFields: string[];
  expiresAt?: Date | null;
}

function validateShareInput(input: { allowedActions: string[]; allowedFields: string[] }) {
  for (const a of input.allowedActions) {
    if (!(SHAREABLE_ACTIONS as readonly string[]).includes(a)) {
      throw new SolutionError("VALIDATION", `إجراء غير معروف: ${a}`);
    }
  }
  for (const f of input.allowedFields) {
    // A globally-forbidden field can never enter an allow-list, even by mistake.
    if (PARTNER_FORBIDDEN_FIELDS.has(f)) throw new SolutionError("VALIDATION", `حقل محظور لا يمكن مشاركته: ${f}`);
    if (!(PARTNER_UPDATABLE_FIELDS as readonly string[]).includes(f)) {
      throw new SolutionError("VALIDATION", `حقل غير قابل للمشاركة: ${f}`);
    }
  }
}

async function requireManageableSolution(actor: AccessContext, solutionId: string) {
  requirePermission(actor, UPDATE);
  await requireScope(actor, "INNOVATION_SOLUTION", solutionId);
  return prisma.innovationSolution.findUniqueOrThrow({
    where: { id: solutionId },
    select: { id: true, owningDepartmentId: true },
  });
}

/** Grant an external partner an auditable, revocable share over a solution. */
export async function grantSolutionShare(actor: AccessContext, solutionId: string, input: GrantShareInput) {
  const solution = await requireManageableSolution(actor, solutionId);
  validateShareInput(input);
  if (input.userId === actor.userId) throw new SolutionError("VALIDATION", "لا يمكن مشاركة السجل مع نفسك");

  const target = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, status: true, registrationStatus: true },
  });
  if (!target) throw new SolutionError("BAD_REFERENCE", "المستخدم غير موجود");
  if (target.status !== "ACTIVE" || target.registrationStatus !== "APPROVED") {
    throw new SolutionError("VALIDATION", "لا يمكن المشاركة مع حساب غير مُفعّل");
  }

  // One active share per (user, solution) — adjust the existing one instead.
  const existing = await prisma.resourceShare.findFirst({
    where: { userId: input.userId, entityType: "INNOVATION_SOLUTION", solutionId, revokedAt: null },
  });
  if (existing && isShareActive(existing)) throw new SolutionError("DUPLICATE", "توجد مشاركة سارية لهذا المستخدم");

  return prisma.$transaction(async (tx) => {
    const share = await tx.resourceShare.create({
      data: {
        userId: input.userId,
        entityType: "INNOVATION_SOLUTION",
        solutionId,
        allowedActions: input.allowedActions,
        allowedFields: input.allowedFields,
        expiresAt: input.expiresAt ?? null,
        grantedById: actor.userId,
      },
      select: { id: true },
    });
    await writeAudit(
      {
        actorUserId: actor.userId,
        action: AUDIT.SOLUTION_SHARE_GRANTED,
        entityType: "INNOVATION_SOLUTION",
        entityId: solutionId,
        departmentId: solution.owningDepartmentId,
        summary: "منح مشاركة لشريك خارجي",
        metadata: {
          shareId: share.id,
          userId: input.userId,
          allowedActions: input.allowedActions,
          allowedFields: input.allowedFields,
          expiresAt: input.expiresAt?.toISOString() ?? null,
        },
      },
      tx,
    );
    return share;
  });
}

/** Adjust an existing share's allow-lists or expiry. */
export async function updateSolutionShare(
  actor: AccessContext,
  shareId: string,
  input: { allowedActions: string[]; allowedFields: string[]; expiresAt?: Date | null },
): Promise<void> {
  const share = await prisma.resourceShare.findUnique({
    where: { id: shareId },
    select: { id: true, solutionId: true, revokedAt: true },
  });
  if (!share?.solutionId) throw new SolutionError("BAD_REFERENCE", "المشاركة غير موجودة");
  if (share.revokedAt) throw new SolutionError("INVALID_STATE", "المشاركة ملغاة");
  const solution = await requireManageableSolution(actor, share.solutionId);
  validateShareInput(input);

  await prisma.$transaction(async (tx) => {
    await tx.resourceShare.update({
      where: { id: shareId },
      data: { allowedActions: input.allowedActions, allowedFields: input.allowedFields, expiresAt: input.expiresAt ?? null },
    });
    await writeAudit(
      {
        actorUserId: actor.userId,
        action: AUDIT.SOLUTION_SHARE_UPDATED,
        entityType: "INNOVATION_SOLUTION",
        entityId: share.solutionId!,
        departmentId: solution.owningDepartmentId,
        summary: "تعديل صلاحيات المشاركة",
        metadata: { shareId, allowedActions: input.allowedActions, allowedFields: input.allowedFields },
      },
      tx,
    );
  });
}

/** Revoke a share — partner access ends immediately. */
export async function revokeSolutionShare(actor: AccessContext, shareId: string): Promise<void> {
  const share = await prisma.resourceShare.findUnique({
    where: { id: shareId },
    select: { id: true, solutionId: true, revokedAt: true },
  });
  if (!share?.solutionId) throw new SolutionError("BAD_REFERENCE", "المشاركة غير موجودة");
  if (share.revokedAt) throw new SolutionError("INVALID_STATE", "المشاركة ملغاة بالفعل");
  const solution = await requireManageableSolution(actor, share.solutionId);

  await prisma.$transaction(async (tx) => {
    await tx.resourceShare.update({
      where: { id: shareId },
      data: { revokedAt: new Date(), revokedById: actor.userId },
    });
    await writeAudit(
      {
        actorUserId: actor.userId,
        action: AUDIT.SOLUTION_SHARE_REVOKED,
        entityType: "INNOVATION_SOLUTION",
        entityId: share.solutionId!,
        departmentId: solution.owningDepartmentId,
        summary: "إلغاء مشاركة شريك",
        metadata: { shareId },
      },
      tx,
    );
  });
}

/** All shares on a solution (management view), with a computed active flag. */
export async function listSolutionShares(actor: AccessContext, solutionId: string) {
  await requireManageableSolution(actor, solutionId);
  const shares = await prisma.resourceShare.findMany({
    where: { entityType: "INNOVATION_SOLUTION", solutionId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, allowedActions: true, allowedFields: true, expiresAt: true,
      revokedAt: true, createdAt: true,
      user: { select: { id: true, name: true, email: true } },
    },
  });
  return shares.map((s) => ({ ...s, active: isShareActive(s) }));
}

// ── Participating organizations ────────────────────────────────────────────

export async function addParticipatingOrganization(actor: AccessContext, solutionId: string, organizationId: string): Promise<void> {
  const solution = await requireManageableSolution(actor, solutionId);
  const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true } });
  if (!org) throw new SolutionError("BAD_REFERENCE", "الجهة غير موجودة");

  const existing = await prisma.solutionOrganization.findUnique({
    where: { solutionId_organizationId: { solutionId, organizationId } },
  });
  if (existing) throw new SolutionError("DUPLICATE", "الجهة مضافة بالفعل");

  try {
    await prisma.$transaction(async (tx) => {
      await tx.solutionOrganization.create({ data: { solutionId, organizationId } });
      await writeAudit(
        {
          actorUserId: actor.userId,
          action: AUDIT.SOLUTION_ORG_ADDED,
          entityType: "INNOVATION_SOLUTION",
          entityId: solutionId,
          departmentId: solution.owningDepartmentId,
          summary: "إضافة جهة مشاركة",
          metadata: { organizationId },
        },
        tx,
      );
    });
  } catch (e) {
    if (typeof e === "object" && e && (e as { code?: string }).code === "P2002") {
      throw new SolutionError("DUPLICATE", "الجهة مضافة بالفعل");
    }
    throw e;
  }
}

export async function removeParticipatingOrganization(actor: AccessContext, solutionId: string, organizationId: string): Promise<void> {
  const solution = await requireManageableSolution(actor, solutionId);
  const existing = await prisma.solutionOrganization.findUnique({
    where: { solutionId_organizationId: { solutionId, organizationId } },
  });
  if (!existing) throw new SolutionError("BAD_REFERENCE", "الجهة غير مرتبطة بهذا الحل");

  await prisma.$transaction(async (tx) => {
    await tx.solutionOrganization.delete({ where: { solutionId_organizationId: { solutionId, organizationId } } });
    await writeAudit(
      {
        actorUserId: actor.userId,
        action: AUDIT.SOLUTION_ORG_REMOVED,
        entityType: "INNOVATION_SOLUTION",
        entityId: solutionId,
        departmentId: solution.owningDepartmentId,
        summary: "إزالة جهة مشاركة",
        metadata: { organizationId },
      },
      tx,
    );
  });
}

export async function listParticipatingOrganizations(actor: AccessContext, solutionId: string) {
  requirePermission(actor, VIEW);
  await requireScope(actor, "INNOVATION_SOLUTION", solutionId);
  const rows = await prisma.solutionOrganization.findMany({
    where: { solutionId },
    select: { organization: { select: { id: true, nameAr: true, type: true } } },
  });
  return rows.map((r) => r.organization);
}
