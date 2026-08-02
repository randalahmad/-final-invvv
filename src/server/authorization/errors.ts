/**
 * Typed authorization failures. Guards throw these; callers (server actions,
 * route handlers) map them to safe responses. Deny-by-default: any guard that
 * cannot positively confirm access throws.
 */
export type AuthzCode =
  | "FORBIDDEN" // missing permission
  | "OUT_OF_SCOPE" // record outside the caller's data scope
  | "NOT_PUBLISHED" // published-only reader hit a non-published record
  | "NOT_OWNER" // ownership required and not held
  | "IMMUTABLE" // finalized/verified record; silent overwrite blocked
  | "FIELD_FORBIDDEN" // write touched a field outside the allow-list
  | "SHARE_INACTIVE" // no active (unrevoked, unexpired) share covers the record
  | "ACTION_NOT_ALLOWED" // action outside the share's allowedActions
  | "NOT_FOUND"; // target record does not exist

export class AuthorizationError extends Error {
  code: AuthzCode;
  constructor(code: AuthzCode, message?: string) {
    super(message ?? code);
    this.name = "AuthorizationError";
    this.code = code;
  }
}

export function isAuthorizationError(e: unknown): e is AuthorizationError {
  return e instanceof AuthorizationError;
}
