import type { PermissionKey } from "@/modules/auth/permissions";
import { AuthorizationError } from "./errors";

/** Anything carrying an effective permission set (AccessContext, admin Actor, …). */
export interface Principal {
  userId: string;
  permissions: ReadonlySet<PermissionKey> | Set<string>;
}

export function hasPermission(ctx: Principal, permission: PermissionKey): boolean {
  return ctx.permissions.has(permission);
}

/**
 * Deny-by-default permission guard operating on an already-resolved principal
 * (usable from services, actions, and tests). Throws FORBIDDEN when absent.
 * (The session-resolving page guard remains `requirePermission` in authz.ts.)
 */
export function requirePermission(ctx: Principal, permission: PermissionKey): void {
  if (!ctx.permissions.has(permission)) {
    throw new AuthorizationError("FORBIDDEN", `missing permission ${permission}`);
  }
}
