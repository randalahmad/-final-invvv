# Phase 3A — Ideas Foundation

The first real business module (5.23.3 Innovation Governance): author → draft → submit → withdraw → archive of ideas, scoped and audited on top of the Phase 2C authorization layer. No evaluation, decision, Kanban, or conversion-to-solution (those are Phase 3B+).

Module: `src/modules/ideas/`. Routes under `/governance/ideas`.

---

## 1. Routes

| Route | Purpose |
|---|---|
| `/governance/ideas` | Scope-filtered list with status filter, empty state, "new idea" |
| `/governance/ideas/new` | Create form (department select limited to caller's scope) |
| `/governance/ideas/[id]` | Details + submit/withdraw/archive/edit actions |
| `/governance/ideas/[id]/edit` | Edit a DRAFT (404s for non-DRAFT) |

Plus `loading.tsx` (skeleton) and `error.tsx` (FORBIDDEN-aware) for the route. A conditional sidebar link ("الأفكار") shows only to `idea.view` holders.

## 2. Services & actions

**Service** (`service.ts`, all server-side, actor-injected):
`createIdea`, `updateDraftIdea`, `submitIdea`, `withdrawIdea`, `archiveIdea`, `getIdeaById`, `listIdeasInScope`, plus helpers `computeIdeaActionFlags` (UI display) and `listOwnableDepartments`.

**Actions** (`actions.ts`, `"use server"`): `createIdeaAction`, `updateIdeaAction`, `submitIdeaAction`, `withdrawIdeaAction`, `archiveIdeaAction` — resolve the actor via `getAccessContext`, call the service, map typed errors (`AuthorizationError` / `IdeaError`) to Arabic messages, `revalidatePath`, and redirect.

## 3. Business rules

- **Only DRAFT is editable** — editing any other status throws `NOT_DRAFT` ("submitted ideas cannot be silently edited").
- **Author or authorized scoped user may edit** — `requireScope(IDEA)` allows the author (by `submittedById`) or a user holding the owning department/organization.
- Transitions (per `status-definitions.md` §4): **DRAFT → SUBMITTED** (author); **DRAFT/SUBMITTED/INITIAL_REVIEW/TECHNICAL_REVIEW/MORE_INFO_REQUESTED → WITHDRAWN** (author, pre-decision); **WITHDRAWN/REJECTED/CONVERTED_TO_SOLUTION → ARCHIVED** (admin/owning-dept). Any other transition throws `INVALID_TRANSITION`.
- **Archive is soft** — sets `status=ARCHIVED` + `archivedAt` + `archivedById`; never a hard delete.
- **Audit** on every create/update/submit/withdraw/archive (`IDEA_CREATED/UPDATED/SUBMITTED/WITHDRAWN/ARCHIVED`), written in the same transaction as the mutation.

## 4. Authorization usage (Phase 2C reuse)

- **Permission gate:** every service function calls `requirePermission(actor, "idea.view")`. INTERNAL_EDITOR and SYSTEM_ADMIN hold it; EXTERNAL_PARTNER and VIEWER do not → `FORBIDDEN`.
- **Data scope:** reads use `ideaScopeWhere(ctx)` (server-injected filter: own-authored ∪ department ∪ organization; PLATFORM unrestricted); single-record access uses `requireScope(ctx, "IDEA", id)` (extended in this phase). Create/re-home uses `requireDepartmentScope`.
- **URL/action-bypass proof:** pages call `requirePermission("idea.view")` server-side and every action re-resolves the actor from the session and re-runs the service guards — hiding the nav link is never the control.
- **Role matrix:** SYSTEM_ADMIN → all ideas; INTERNAL_EDITOR → their department(s); EXTERNAL_PARTNER → none; VIEWER → none (see note below).

**Permission-catalogue correction:** the seed previously granted `VIEWER` a blanket `idea.view`, contradicting `roles-and-permissions.md` §7 (Viewer's `idea.view` is grantable *only for explicitly published* records, not a default). `permissions.ts` now excludes `idea.view` from the Viewer default, so Viewers have no idea access — matching the approved matrix and this phase's requirement.

## 5. Validation (Zod)

`createIdeaSchema` / `updateIdeaSchema`: `titleAr` (required, 3–200), `description` (optional, ≤4000), `departmentId` (required — owning department), `activityId` (optional source/activity link, existence-checked). **No new Idea fields were invented:** the Idea model has no `problemStatement` column (that lives on `InnovationSolution`), so problem context is captured in `description`.

## 6. Database

Used the current Idea schema. One **genuinely-required missing relation** was added: `Idea.department` (the `departmentId` column existed but had no relation/FK, unlike every other owned entity) — needed for organization-scope resolution and department-name display. Migration `20260722213616_idea_department_relation` (adds the FK on the existing column + `Department.ideas` back-relation; additive, no data loss). No other schema change.

## 7. Tests

`tests/ideas.test.ts` — **17 integration tests** against a disposable PostgreSQL DB: create saves DRAFT authored by caller; editor cannot create for another department; partner cannot create (FORBIDDEN); edit own DRAFT; SUBMITTED cannot be edited (NOT_DRAFT); DRAFT→SUBMITTED; re-submit rejected; archive-DRAFT invalid; withdraw from SUBMITTED; archive WITHDRAWN (soft); editor cannot open another department's idea (OUT_OF_SCOPE); viewer cannot open (FORBIDDEN); missing → NOT_FOUND; archive blocked cross-department; list is scope-filtered; viewer cannot list; audit records for create/submit/withdraw/archive. **Full suite: 67 tests passing** (17 ideas + 36 authorization + 14 identity).

## 8. Validation results

`npm test` → 67/67 · `npm run lint` → clean · `npm run typecheck` → clean · `npm run build` → 19 routes (all 4 idea routes present). Migrations apply cleanly from zero on PostgreSQL 16. Manual browser check (editor): scoped list, scope-limited create form, create→details (DRAFT + correct action buttons), submit→SUBMITTED (buttons update); Viewer session shows no ideas nav link.

## 9. Known limitations

- `requireScope`/`ideaScopeWhere` cover the author + department/organization dimensions; there is no "published idea" projection yet, so Viewer/Partner have no idea visibility at all (as required for 3A).
- Ideas are not yet linked into any dashboard/Kanban; the existing `/governance` mock page is untouched.
- Withdraw/submit are author-or-platform initiated; delegated submission is not modeled.
- No pagination on the list (small pilot volume).

## 10. Deferred to Phase 3B

- Evaluations (`IdeaEvaluation`) and the reviewer transitions (SUBMITTED → INITIAL_REVIEW → TECHNICAL_REVIEW → MORE_INFO_REQUESTED).
- Decisions (`IdeaDecision`, approve/reject) with the finalized-decision immutability guard already available from Phase 2C.
- Conversion APPROVED_FOR_PILOT → CONVERTED_TO_SOLUTION and the persisted governance Kanban projection.
- Published-idea projection for Viewer access.
