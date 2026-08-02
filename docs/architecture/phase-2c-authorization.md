# Phase 2C — Authorization, Data Scope & Immutability

Implements the enterprise authorization layers as reusable **server-side** guards, before any business workflow. Deny-by-default; every guard throws a typed `AuthorizationError`. No business CRUD/UI was built. Consistent with `docs/authorization.md`, `docs/roles-and-permissions.md`, and `docs/status-definitions.md`.

Location: `src/server/authorization/` (barrel: `@/server/authorization`).

---

## 1. Layers implemented

| Layer (authorization.md) | Module | Status |
|---|---|---|
| L2 Permission guard (ctx-based) | `permission.ts` | ✅ `requirePermission(ctx, key)` |
| L3 Scope-filtered reads | `scope.ts` | ✅ `solutionScopeWhere` / `findSolutionsInScope` |
| L3 Single-record scope | `scope.ts` | ✅ `requireScope`, `requireOwnership`, `requirePublished` |
| Shared-resource (partner) | `share.ts` | ✅ active-share resolution + `requireShareAction` |
| Field-level | `fields.ts` | ✅ `requirePartnerFieldWrite`, `PARTNER_FORBIDDEN_FIELDS` |
| L5 Immutability | `immutability.ts` | ✅ `assertMutable` + supersede/reopen |

The session-resolving page guard (`requireUser`, `requirePermission(key)`) stays in `authz.ts`; the pure ctx-based guards here are usable from services, actions, and tests (they never import the Auth.js instance).

## 2. Helper utilities (required by Phase 2C)

- `requirePermission(ctx, key)` — deny-by-default permission check on a resolved principal.
- `requireScope(ctx, entityType, entityId)` — assert a single record is inside the caller's data scope (throws `NOT_FOUND` / `OUT_OF_SCOPE`).
- `requirePublished(record)` — published-only readers see a record only when `publishedAt` is set.
- `requireOwnership(ctx, record)` — caller is the named owner or holds dept/org/platform scope over it.
- `assertMutable(kind, record)` — blocks in-place edits of finalized decisions / verified measurements.

Typed failures (`AuthzCode`): `FORBIDDEN`, `OUT_OF_SCOPE`, `NOT_PUBLISHED`, `NOT_OWNER`, `IMMUTABLE`, `FIELD_FORBIDDEN`, `SHARE_INACTIVE`, `ACTION_NOT_ALLOWED`, `NOT_FOUND`.

## 3. Data-scope enforcement

`effectiveScopes(ctx)` aggregates a principal's `UserRole` grants into buckets (`platform`, `organizationIds`, `departmentIds`, `solutionIds`, `agreementIds`, `published`). Effective authorization is the **union** of grants.

`solutionScopeWhere(ctx)` builds a Prisma `WHERE` fragment (the canonical scoped entity is `InnovationSolution`):

- **PLATFORM** → `{}` (unrestricted).
- **DEPARTMENT** → `owningDepartmentId IN (…)`.
- **ORGANIZATION** → `owningDepartment.organizationId IN (…)`.
- **SOLUTION** → `id IN (directly-scoped ids ∪ ids reachable via an active ResourceShare)`.
- **PUBLISHED** → `publishedAt IS NOT NULL`.
- No grant → a match-nothing filter (`id = "__no_access__"`) — deny-by-default.

`findSolutionsInScope(ctx, args)` always `AND`s the caller's scope filter with any caller-supplied `where`, so the client can never widen visibility. `requireScope` performs the equivalent check for a single record id. Verified by tests: Internal Editor sees only their department; External Partner only shared solutions; Viewer only published; SYSTEM_ADMIN everything.

**Scope required a schema field:** `InnovationSolution.publishedAt DateTime?` (added, migration `20260722170203_authorization_scope_fields`). `requireScope` is implemented for `INNOVATION_SOLUTION`; extending to other entities follows the same descriptor pattern (documented as future work).

## 4. ResourceShare enforcement

A share is **active** when it is not revoked **and** not past `expiresAt` (`isShareActive`). `ResourceShare.expiresAt DateTime?` was added for expiration handling (same migration).

- `getActiveSharesForUser` / `getActiveShareSolutionIds` feed scope reads (only active shares grant visibility).
- `requireShareAction(ctx, entityType, entityId, action)` requires an active share covering the entity whose `allowedActions` includes `action`; else `SHARE_INACTIVE` / `ACTION_NOT_ALLOWED`.

Verified: an expired share grants no visibility and no action; a revoked share is inactive; a disallowed action is rejected.

## 5. Field-level restrictions

`PARTNER_FORBIDDEN_FIELDS` is a global deny-list of official fields a partner may **never** write regardless of a share's `allowedFields` — ownership (`ownerUserId`, `owningDepartmentId`, `responsibleUserId`, `partnerOrgId`, …), lifecycle/status, verification/review/processing status, readiness/publication, and approval/immutability metadata.

`requirePartnerFieldWrite(ctx, entityType, entityId, fields, action)` = `requireShareAction` **then** `assertFieldsWithinShare` (every field must be allow-listed **and** not globally forbidden). Verified: a partner may write `notes` on a shared solution but cannot change `status` (FIELD_FORBIDDEN) or ownership; a Viewer cannot mutate at all because they lack `*.update` permissions (`requirePermission` denies).

## 6. Immutability guards (Layer 5)

Protected: a **finalized** `IdeaDecision` (`finalizedAt` set) and a **VERIFIED** `ImpactMeasurement`.

- `assertMutable(kind, record)` throws `IMMUTABLE` — no silent overwrite.
- **Sanctioned change paths** (each preserves history + writes AuditLog, permission-gated):
  - `supersedeDecision(actor, originalId, data)` → new decision with `supersedesId` (needs `idea.decide`), audit `DECISION_SUPERSEDED`.
  - `reopenDecision(actor, id, reason)` → clears finalization + reopen metadata, audit `DECISION_REOPENED`.
  - `supersedeMeasurement(actor, originalId, data)` → new measurement with `supersedesId` (needs `impact.verify`), audit `MEASUREMENT_SUPERSEDED`.
  - `reopenMeasurement(actor, id, reason)` → back to `PENDING` + reopen metadata, audit `MEASUREMENT_REOPENED`.

Verified: in-place edits are blocked; superseding creates a linked record + audit; a non-privileged actor cannot supersede; reopening a verified measurement returns it to PENDING with audit.

## 7. Server-side authorization hardening

- All guards are **pure and ctx-injected**, so they run identically in services, server actions, and tests — never in the client, never as UI-hiding.
- Reads go through `findSolutionsInScope` (scope filter injected server-side); single-record access through `requireScope`; mutations through `requirePermission` + `requireScope`/`requireOwnership` + (partners) `requirePartnerFieldWrite` + (finalized/verified) `assertMutable`.
- `getAccessContext` already requires APPROVED + ACTIVE (Phase 2B), so no ineligible principal reaches these guards.

## 8. Tests

`tests/authorization.test.ts` — **36 integration tests** against a disposable PostgreSQL DB using the seeded principals + fixtures: effective-scope resolution (3); scope-filtered reads across admin/editor/partner/viewer incl. active vs expired shares (8); single-record `requireScope` incl. NOT_FOUND/OUT_OF_SCOPE (6); ResourceShare active/expired/action (4); field-level allow-list + global forbidden + partner status block (5); permission guards for viewer/partner (3); ownership + published (2); immutability assert + supersede + reopen + non-privileged denial (5). Total suite (with Phase 2B): **50 tests, all passing**.

## 9. Validation

`npm run lint` ✓ · `npm run typecheck` ✓ · `npm run build` ✓ (17 routes) · `npm run test` ✓ (50/50). Migration `20260722170203_authorization_scope_fields` applies cleanly from zero.

## 10. Known limitations / deferred

- `requireScope` currently implements `INNOVATION_SOLUTION`; other entity types throw until their descriptor is added (Phase 3, alongside the modules that need them).
- Guards are libraries — **not yet wired into business endpoints** (there are none yet). Phase 3 modules must consume them (reads via `findSolutionsInScope`/`requireScope`; writes via the guard chain above).
- Agreement/meeting scope and partner meeting-minute/attendance actions are modeled (share + `requireShareAction`) but exercised only for solutions here.
- No denied-attempt audit for read guards (only immutability/share mutations audit); can be added when endpoints exist.
- Rate limiting (carried from Phase 2B) remains a HIGH-priority deferred item.
