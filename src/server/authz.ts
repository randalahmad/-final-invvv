import { cache } from "react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/server/db";
import type { PermissionKey } from "@/modules/auth/permissions";
import {
  buildContext,
  userInclude,
  type AccessContext,
  type UserWithRolesShape,
} from "@/server/access-context";

// Re-export the pure helpers so existing imports from `@/server/authz` keep working.
export {
  loadAccessContextByUserId,
  can,
  hasPlatformScope,
  type AccessContext,
  type ScopeGrant,
} from "@/server/access-context";

/**
 * Resolve the current session user's effective context (APPROVED + ACTIVE only).
 * Deduped per-request. Returns null when there is no valid session or the user
 * is not eligible.
 */
export const getAccessContext = cache(async (): Promise<AccessContext | null> => {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, include: userInclude });
  return buildContext(user as UserWithRolesShape | null);
});

/** Require a session; redirect to /login otherwise. */
export async function requireUser(): Promise<AccessContext> {
  const ctx = await getAccessContext();
  if (!ctx) redirect("/login");
  return ctx;
}

/** Require a permission; redirect when unauthenticated, throw FORBIDDEN when authenticated-but-unauthorized. */
export async function requirePermission(permission: PermissionKey): Promise<AccessContext> {
  const ctx = await requireUser();
  if (!ctx.permissions.has(permission)) {
    throw new Error("FORBIDDEN: missing permission " + permission);
  }
  return ctx;
}
