/**
 * Phase 2C authorization layer — server-side data-scope, ResourceShare,
 * field-level, and immutability guards. Deny-by-default; every guard throws a
 * typed AuthorizationError. Consumed by services/actions; never re-implemented
 * per module.
 *
 * Helper utilities (per Phase 2C requirements):
 *  - requirePermission(ctx, key)         → permission.ts
 *  - requireScope(ctx, type, id)         → scope.ts
 *  - requirePublished(record)            → scope.ts
 *  - requireOwnership(ctx, record)       → scope.ts
 *  - assertMutable(kind, record)         → immutability.ts
 */
export { AuthorizationError, isAuthorizationError, type AuthzCode } from "./errors";
export { hasPermission, requirePermission, type Principal } from "./permission";
export {
  effectiveScopes,
  solutionScopeWhere,
  findSolutionsInScope,
  requireScope,
  requirePublished,
  requireOwnership,
  ideaScopeWhere,
  requireDepartmentScope,
  type EffectiveScopes,
} from "./scope";
export {
  isShareActive,
  getActiveSharesForUser,
  getActiveShareSolutionIds,
  getActiveShareAgreementIds,
  findActiveShareForEntity,
  requireShareAction,
  type ShareLike,
} from "./share";
export { PARTNER_FORBIDDEN_FIELDS, assertFieldsWithinShare, requirePartnerFieldWrite } from "./fields";
export {
  assertMutable,
  isFinalizedDecision,
  isVerifiedMeasurement,
  supersedeDecision,
  supersedeDecisionInTransaction,
  reopenDecision,
  reopenDecisionInTransaction,
  supersedeMeasurement,
  reopenMeasurement,
  type ImmutableKind,
} from "./immutability";
