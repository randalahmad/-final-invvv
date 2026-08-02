import { prisma } from "@/server/db";
import { writeAudit, AUDIT } from "@/server/audit";
import type { PermissionKey } from "@/modules/auth/permissions";
import { requirePermission } from "@/server/authorization";
import {
  approveSchema,
  rejectSchema,
  accountStateSchema,
  APPROVABLE_ROLES,
  type ApproveInput,
  type RejectInput,
  type AccountStateInput,
} from "./schema";

/** Minimal actor the services enforce against (built from a valid APPROVED+ACTIVE context). */
export interface Actor {
  userId: string;
  permissions: ReadonlySet<PermissionKey> | Set<string>;
}

export type ServiceResult =
  | { ok: true }
  | { ok: false; error: "FORBIDDEN" | "NOT_FOUND" | "NOT_PENDING" | "INVALID_ROLE" | "INVALID_STATE" | "VALIDATION"; fieldErrors?: Record<string, string[]> };

const MANAGE: PermissionKey = "user.manage";
const ROLE_MANAGE: PermissionKey = "role.manage";

export async function listApprovedUsersWithRoles(actor: Actor) {
  requirePermission(actor, MANAGE);
  return prisma.user.findMany({
    where: { registrationStatus: "APPROVED" },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      jobTitle: true,
      roleAssignments: {
        select: { id: true, scopeType: true, scopeId: true, role: { select: { id: true, key: true, nameAr: true } } },
      },
    },
  });
}

export async function listRoles(actor: Actor) {
  requirePermission(actor, MANAGE);
  return prisma.role.findMany({ orderBy: { nameAr: "asc" }, select: { id: true, key: true, nameAr: true, description: true } });
}

/**
 * Assigns a role at PLATFORM scope only (department/organization/agreement/
 * solution-scoped assignment is not built in this screen — a deliberate MVP
 * scope limit, not a hidden gap).
 */
export async function assignPlatformRole(actor: Actor, userId: string, roleId: string): Promise<ServiceResult> {
  requirePermission(actor, ROLE_MANAGE);
  const [user, role] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { id: true } }),
    prisma.role.findUnique({ where: { id: roleId }, select: { id: true, key: true } }),
  ]);
  if (!user || !role) return { ok: false, error: "NOT_FOUND" };

  const existing = await prisma.userRole.findFirst({
    where: { userId, roleId, scopeType: "PLATFORM", scopeId: null },
    select: { id: true },
  });
  if (existing) return { ok: false, error: "INVALID_STATE" };

  await prisma.$transaction(async (tx) => {
    await tx.userRole.create({ data: { userId, roleId, scopeType: "PLATFORM" } });
    await writeAudit(
      {
        actorUserId: actor.userId,
        action: AUDIT.USER_ROLE_ASSIGNED,
        entityType: "REPORT",
        entityId: userId,
        summary: "إسناد دور لمستخدم",
        after: { userId, roleKey: role.key },
      },
      tx,
    );
  });
  return { ok: true };
}

export async function removeUserRole(actor: Actor, userRoleId: string): Promise<ServiceResult> {
  requirePermission(actor, ROLE_MANAGE);
  const assignment = await prisma.userRole.findUnique({ where: { id: userRoleId }, select: { id: true, userId: true, role: { select: { key: true } } } });
  if (!assignment) return { ok: false, error: "NOT_FOUND" };

  await prisma.$transaction(async (tx) => {
    await tx.userRole.delete({ where: { id: userRoleId } });
    await writeAudit(
      {
        actorUserId: actor.userId,
        action: AUDIT.USER_ROLE_REMOVED,
        entityType: "REPORT",
        entityId: assignment.userId,
        summary: "إزالة دور من مستخدم",
        before: { roleKey: assignment.role.key },
      },
      tx,
    );
  });
  return { ok: true };
}

function requireManage(actor: Actor): ServiceResult | null {
  return actor.permissions.has(MANAGE) ? null : { ok: false, error: "FORBIDDEN" };
}

/**
 * Approve a PENDING registration: assign role + scope + optional membership,
 * set registrationStatus=APPROVED and status=ACTIVE, audited — all in one
 * transaction. Repeated approval is safely rejected (NOT_PENDING). SYSTEM_ADMIN
 * can never be assigned here (blocked by the schema's APPROVABLE_ROLES).
 */
export async function approveRegistration(actor: Actor, raw: ApproveInput | unknown): Promise<ServiceResult> {
  const denied = requireManage(actor);
  if (denied) return denied;

  const parsed = approveSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "VALIDATION", fieldErrors: parsed.error.flatten().fieldErrors };
  const input = parsed.data;

  if (!APPROVABLE_ROLES.includes(input.roleKey)) return { ok: false, error: "INVALID_ROLE" };

  try {
    return await prisma.$transaction(async (tx) => {
      const target = await tx.user.findUnique({
        where: { id: input.userId },
        select: { id: true, registrationStatus: true },
      });
      if (!target) return { ok: false, error: "NOT_FOUND" } as const;
      if (target.registrationStatus !== "PENDING") return { ok: false, error: "NOT_PENDING" } as const;

      const role = await tx.role.findUnique({ where: { key: input.roleKey }, select: { id: true } });
      if (!role) return { ok: false, error: "INVALID_ROLE" } as const;

      const scopeId = input.scopeId?.trim() || null;
      await tx.userRole.upsert({
        where: {
          userId_roleId_scopeType_scopeId: {
            userId: target.id,
            roleId: role.id,
            scopeType: input.scopeType,
            scopeId: scopeId ?? "",
          },
        },
        update: {},
        create: { userId: target.id, roleId: role.id, scopeType: input.scopeType, scopeId },
      });

      const organizationId = input.organizationId?.trim() || null;
      const departmentId = input.departmentId?.trim() || null;
      if (organizationId || departmentId) {
        await tx.userMembership.upsert({
          where: {
            userId_organizationId_departmentId: {
              userId: target.id,
              organizationId: organizationId ?? "",
              departmentId: departmentId ?? "",
            },
          },
          update: {},
          create: { userId: target.id, organizationId, departmentId },
        });
      }

      await tx.user.update({
        where: { id: target.id },
        data: {
          registrationStatus: "APPROVED",
          status: "ACTIVE",
          approvedById: actor.userId,
          approvedAt: new Date(),
          rejectionReason: null,
        },
      });

      await writeAudit(
        {
          actorUserId: actor.userId,
          action: AUDIT.REGISTRATION_APPROVED,
          entityId: target.id,
          organizationId,
          departmentId,
          summary: "اعتماد تسجيل مستخدم",
          after: { registrationStatus: "APPROVED", status: "ACTIVE", roleKey: input.roleKey, scopeType: input.scopeType },
        },
        tx,
      );
      return { ok: true } as const;
    });
  } catch (e) {
    // Concurrent unique-race on role/membership → treat as already handled.
    if (typeof e === "object" && e && (e as { code?: string }).code === "P2002") {
      return { ok: false, error: "NOT_PENDING" };
    }
    throw e;
  }
}

/** Reject a PENDING registration. Grants no role; records an internal reason. */
export async function rejectRegistration(actor: Actor, raw: RejectInput | unknown): Promise<ServiceResult> {
  const denied = requireManage(actor);
  if (denied) return denied;

  const parsed = rejectSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "VALIDATION", fieldErrors: parsed.error.flatten().fieldErrors };
  const input = parsed.data;

  return prisma.$transaction(async (tx) => {
    const target = await tx.user.findUnique({ where: { id: input.userId }, select: { id: true, registrationStatus: true } });
    if (!target) return { ok: false, error: "NOT_FOUND" } as const;
    if (target.registrationStatus !== "PENDING") return { ok: false, error: "NOT_PENDING" } as const;

    await tx.user.update({
      where: { id: target.id },
      data: {
        registrationStatus: "REJECTED",
        status: "INACTIVE",
        approvedById: actor.userId,
        approvedAt: new Date(),
        rejectionReason: input.reason?.trim() || null,
      },
    });
    await writeAudit(
      {
        actorUserId: actor.userId,
        action: AUDIT.REGISTRATION_REJECTED,
        entityId: target.id,
        summary: "رفض تسجيل مستخدم",
        // internal reason kept in metadata (never shown to the rejected user)
        metadata: input.reason?.trim() ? { reason: input.reason.trim() } : undefined,
        after: { registrationStatus: "REJECTED" },
      },
      tx,
    );
    return { ok: true } as const;
  });
}

const STATE_MAP = {
  ACTIVATE: { status: "ACTIVE", action: AUDIT.USER_ACTIVATED, from: ["INACTIVE"] },
  DEACTIVATE: { status: "INACTIVE", action: AUDIT.USER_DEACTIVATED, from: ["ACTIVE", "SUSPENDED"] },
  SUSPEND: { status: "SUSPENDED", action: AUDIT.USER_SUSPENDED, from: ["ACTIVE", "INACTIVE"] },
  RESTORE: { status: "ACTIVE", action: AUDIT.USER_RESTORED, from: ["SUSPENDED"] },
} as const;

/** Change operational status of an APPROVED account (activate/deactivate/suspend/restore). */
export async function setAccountState(actor: Actor, raw: AccountStateInput | unknown): Promise<ServiceResult> {
  const denied = requireManage(actor);
  if (denied) return denied;

  const parsed = accountStateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "VALIDATION", fieldErrors: parsed.error.flatten().fieldErrors };
  const { userId, action } = parsed.data;

  // Prevent an admin from locking themselves out.
  if (userId === actor.userId && (action === "DEACTIVATE" || action === "SUSPEND")) {
    return { ok: false, error: "INVALID_STATE" };
  }

  return prisma.$transaction(async (tx) => {
    const target = await tx.user.findUnique({ where: { id: userId }, select: { id: true, status: true, registrationStatus: true } });
    if (!target) return { ok: false, error: "NOT_FOUND" } as const;
    if (target.registrationStatus !== "APPROVED") return { ok: false, error: "INVALID_STATE" } as const;

    const rule = STATE_MAP[action];
    if (!(rule.from as readonly string[]).includes(target.status)) return { ok: false, error: "INVALID_STATE" } as const;

    await tx.user.update({ where: { id: target.id }, data: { status: rule.status } });
    await writeAudit(
      {
        actorUserId: actor.userId,
        action: rule.action,
        entityId: target.id,
        summary: "تغيير حالة الحساب",
        before: { status: target.status },
        after: { status: rule.status },
      },
      tx,
    );
    return { ok: true } as const;
  });
}

/** Read helper for the admin page. */
export async function listUsersByRegistration(actor: Actor, status?: "PENDING" | "APPROVED" | "REJECTED") {
  requirePermission(actor, MANAGE);
  return prisma.user.findMany({
    where: status ? { registrationStatus: status } : undefined,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      registrationStatus: true,
      requestedRoleKey: true,
      requestedOrgType: true,
      requestedOrganizationName: true,
      requestedDepartmentId: true,
      registrationNote: true,
      createdAt: true,
      approvedAt: true,
    },
  });
}
