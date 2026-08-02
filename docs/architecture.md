# Architecture — Innovation Platform

High-level map of how the codebase is actually organized. For the database design specifically, see `database-freeze.md` and `data-dictionary.md`. For deeper phase-level design notes, see the `architecture/` subfolder.

## Stack
Next.js (App Router) + TypeScript, PostgreSQL via Prisma, server-rendered pages with Server Actions for all mutations — no separate REST/GraphQL backend (see `api.md`).

## Module boundary pattern
Every domain lives under `src/modules/<name>/` with a consistent internal shape:

```
src/modules/<name>/
  schema.ts       # Zod validation + label maps (status/type → Arabic display text)
  service.ts       # All DB access + business logic + permission checks (requirePermission)
  actions.ts        # "use server" wrappers: read FormData, call service, map errors to Arabic, revalidatePath/redirect
  components/       # Client components (forms, action bars, lists) specific to this module
```

Pages under `src/app/(app)/<route>/` are thin: they call `requirePermission`/`getAccessContext`, call one or more `service.ts` functions, and render. All authorization is enforced in `service.ts` (defense in depth: pages also gate, but the service call is the real boundary — verified directly by Permission Tests in `test-plan.md`, item P-10).

## Cross-cutting primitives (`src/server/`)
- `authz.ts` / `authorization/` — `requirePermission`, `getAccessContext`, `effectiveScopes`, `requireDepartmentScope`. Every module calls into these; none re-implements auth.
- `audit.ts` — `writeAudit()` + the `AUDIT` action-key registry. See `audit-events.md`.
- `db.ts` — the shared Prisma client instance.
- `storage/` — file storage abstraction (`buildEvidenceKey`, `buildEntityEvidenceKey`, `getStorage`) used by the evidence module.

## Evidence as a reusable primitive
`Evidence`/`EvidenceLink` (in `src/modules/evidence/`) is the one generic attachment mechanism used across the platform. Solutions, activities, and strategy documents each get their own upload entry point in `evidence/service.ts` (`uploadEvidence`, `uploadActivityEvidence`, `uploadStrategyDocumentEvidence`), all writing to the same two tables via `EvidenceLink.entityType`. This is deliberate: new entity types are added by extending `LinkedEntityType` and writing one new upload function, never by duplicating the storage/versioning/review machinery.

## Scoping model
Authorization is **permission + data scope**, never role alone. `effectiveScopes(actor)` returns `{ platform, organizationIds[], departmentIds[] }`; every list/read function in every module filters by this. Department-scoped modules (`strategy`, `activities`, `challenges`) filter on `departmentId`; organization-scoped modules (`committees`) filter on `organizationId`.

## New-module additions from this integration (frozen, see `database-freeze.md`)
`strategy` (Assignment/StrategyDocument), `committees`, `challenges` follow the exact same four-file module pattern above. They introduce no new architectural primitive — they consume the existing authorization, audit, and evidence primitives.

## What is *not* in this architecture
- No background job runner / cron — the `alerts` module has no automatic `Alert`-row generation yet (see `modules.md` build status).
- No dedicated `Report` persistence — the `/reports` counters are computed live on each page load, not stored or scheduled.
