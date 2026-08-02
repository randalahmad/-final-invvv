import { prisma } from "@/server/db";
import type { PermissionKey } from "@/modules/auth/permissions";

/**
 * Pure access-context resolution — no dependency on the Auth.js instance, so it
 * is importable from services and (Node) tests without pulling in next-auth.
 * Session-bound helpers live in `authz.ts`.
 */

export interface ScopeGrant {
  scopeType: string;
  scopeId: string | null;
}

export interface AccessContext {
  userId: string;
  name: string;
  email: string;
  permissions: Set<PermissionKey>;
  scopes: ScopeGrant[];
}

export type UserWithRolesShape = {
  id: string;
  name: string;
  email: string;
  status: string;
  registrationStatus: string;
  roleAssignments: {
    scopeType: string;
    scopeId: string | null;
    role: { permissions: { permission: { key: string } }[] };
  }[];
};

export const userInclude = {
  roleAssignments: {
    include: { role: { include: { permissions: { include: { permission: true } } } } },
  },
} as const;

/** Only APPROVED + ACTIVE users have an effective context. */
export function buildContext(user: UserWithRolesShape | null): AccessContext | null {
  if (!user) return null;
  if (user.registrationStatus !== "APPROVED" || user.status !== "ACTIVE") return null;

  const permissions = new Set<PermissionKey>();
  const scopes: ScopeGrant[] = [];
  for (const assignment of user.roleAssignments) {
    scopes.push({ scopeType: assignment.scopeType, scopeId: assignment.scopeId });
    for (const rp of assignment.role.permissions) {
      permissions.add(rp.permission.key as PermissionKey);
    }
  }
  return { userId: user.id, name: user.name, email: user.email, permissions, scopes };
}

/** Build a context directly from a user id (no session) — for services/tests. */
export async function loadAccessContextByUserId(userId: string): Promise<AccessContext | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: userInclude });
  return buildContext(user as UserWithRolesShape | null);
}

export function can(ctx: AccessContext | null, permission: PermissionKey): boolean {
  return !!ctx?.permissions.has(permission);
}

export function hasPlatformScope(ctx: AccessContext | null): boolean {
  return !!ctx?.scopes.some((s) => s.scopeType === "PLATFORM");
}
