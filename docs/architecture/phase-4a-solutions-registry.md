# Phase 4A — Innovation Solutions Registry Foundation

A real, scoped Innovation Solutions Registry (5.24.1) on persisted PostgreSQL data, built on the existing `InnovationSolution` schema, the Phase 3C conversion output, and the Phase 2C authorization layer. **No** evidence upload, document analysis, compliance scoring, or impact workflows.

---

## 1. Routes & components

| Route | Purpose |
|---|---|
| `/solutions` | Scoped registry table + search + filters (maturity, implementation status, department, source, include-archived) |
| `/solutions/new` | Manual registration form (DRAFT) |
| `/solutions/[id]` | Details, completeness panel, missing fields, Idea link, partner field form |
| `/solutions/[id]/edit` | DRAFT edit form (404 for non-DRAFT) |

Plus `loading.tsx` (skeleton) and `error.tsx` (FORBIDDEN-aware). New components: `solution-form.tsx`, `completeness-panel.tsx`, `solution-actions.tsx` (`SolutionActionBar` + `PartnerFieldsForm`). The previous mock-driven `/solutions` page (`solutionsMock` + old `SolutionsTable`) was replaced — the route is now server-rendered from the database.

## 2. Services & actions

**`service.ts`:** `createSolution`, `updateDraftSolution`, `updateSharedSolutionFields` (partner path), `archiveSolution`, `getSolutionById`, `listSolutionsInScope`, `listSolutionFilters`, `listOwnableDepartments`, `computeSolutionCompleteness`, `COMPLETENESS_FIELDS`.
**`actions.ts`:** `createSolutionAction`, `updateSolutionAction`, `archiveSolutionAction`, `updateSharedFieldsAction` — resolve the actor server-side, map typed errors to Arabic, revalidate.

## 3. Authorization behaviour

All enforcement is server-side, reusing Phase 2C primitives (`solutionScopeWhere`, `requireScope`, `requirePermission`, `requireDepartmentScope`, `requirePartnerFieldWrite`, `findActiveShareForEntity`) plus the audit writer.

| Principal | Behaviour |
|---|---|
| **SYSTEM_ADMIN** | All solutions (PLATFORM scope). |
| **INTERNAL_EDITOR** | Only their department(s): create/update within scope; cannot create for another department; cannot archive (lacks `solution.archive` by default). |
| **EXTERNAL_PARTNER** | Only solutions reachable through an **active** `ResourceShare`; may write **only** fields in that share's `allowedFields`, and only when `allowedActions` includes `update_fields`. Expired/revoked shares grant nothing. Writes are audited with the originating **share id**. |
| **VIEWER** | Read-only, and only solutions with `publishedAt` set (PUBLISHED scope). Cannot create or update (no `solution.*` write permissions). |

The list query always AND-s the caller's scope filter with any user-supplied filters, so no filter can widen visibility. Partner writes additionally pass a server-side `PARTNER_UPDATABLE` column whitelist before the share allow-list check.

## 4. Business rules

- **Only DRAFT solutions are freely editable** (`NOT_DRAFT` otherwise); the edit route 404s for non-DRAFT.
- **The Idea link is preserved**: `ideaId` is not part of the form schema, so it can never be re-assigned or cleared by an edit (verified by test).
- **Manual creation** is allowed for `solution.create` holders within their department scope.
- **Duplicate Idea→Solution conversion remains blocked** by the `ideaId` unique index (Phase 3C logic untouched).
- **Archive, never hard delete**: `status=ARCHIVED` + `archivedAt` + `archivedById`; archived rows are hidden from the list unless explicitly requested.
- Mass assignment is prevented: `status`, `publishedAt`, `completionPct`, `evidenceReadinessPct`, `ideaId` and archive metadata are never writable from a form.
- **Audited**: `SOLUTION_CREATED`, `SOLUTION_UPDATED`, `SOLUTION_ARCHIVED`, `SOLUTION_PARTNER_UPDATED`.

## 5. Completeness logic

`computeSolutionCompleteness` counts **11 record fields** (`nameAr`, `description`, `problemStatement`, `owningDepartmentId`, `ownerUserId`, `strategicObjectiveId`, `startDate`, `targetEndDate`, `cost`, `targetBeneficiaries`, `technologies`) and returns `{ percentage, filled, total, missing[] }`. The value is persisted to the existing `completionPct` column on create/update and recomputed on read for the details panel.

- Enum fields with schema defaults (`maturityStage`, `implementationStatus`, `source`) are **excluded** — they are never empty and would inflate the number.
- The UI labels it **"اكتمال بيانات الملف"** with an explicit notice that it measures record-field completeness **only**, is **not** a readiness/compliance indicator, and **excludes evidence and requirement assessment**. Every missing field is listed by name, so the figure is fully explainable.

## 6. Fields used

Only existing justified columns: `nameAr`, `description`, `problemStatement`, `owningDepartmentId`, `source`, `activityId`, `ideaId` (read-only link), `ownerUserId`, `strategicObjectiveId`, `maturityStage`, `implementationStatus`, `startDate`, `targetEndDate`, `actualEndDate`, `durationMonths`, `cost`, `targetBeneficiaries`, `technologies`, `risks`, `notes`, `status`, `completionPct`, `publishedAt`, archive metadata. **No fields were added.**

## 7. Tests & results

`tests/solutions.test.ts` — **23 integration tests**: manual create (DRAFT + completeness); cross-department create/read/write blocked; viewer/partner cannot create; scope-filtered list; converted solution visible and Idea link preserved through edits; duplicate conversion blocked; DRAFT edit; non-DRAFT edit rejected; viewer cannot update; partner sees only actively-shared; expired/revoked share grants nothing; partner allowed-field write succeeds; field outside allow-list blocked; protected official field blocked; action outside `allowedActions` blocked; viewer sees only published and cannot modify; archive permission enforced + soft; archived hidden unless requested; completeness math + missing fields; completeness rises as the record fills; audit records for create/update/archive; partner write audited with share id.

**Full suite: 127 tests passing.** `npm run lint` clean · `npm run typecheck` clean · `npm run build` 20 routes (`/solutions` now dynamic/server-rendered). Manual browser check: registry lists real rows with working filters and live completeness (0% / 18% / 82%); details page shows "9 من 11 حقلًا = 82%", the not-a-compliance-score notice, and exactly the two missing fields.

## 8. Migrations

**None.** Every field used already exists (including `publishedAt` from Phase 2C).

## 9. Limitations

- **Publish/unpublish is deferred** (Task 7): there is no publish action or UI, so `publishedAt` is only settable out-of-band. In practice a Viewer therefore sees an empty registry until publishing ships — the scope filter itself is implemented and tested.
- Solutions are created as `DRAFT`; there is no DRAFT→ACTIVE lifecycle action yet, so "freely editable" effectively covers everything created so far.
- The registry list has no pagination (pilot volume) and search is a simple `contains` (no full-text index).
- The dashboard still uses `solutionsMock`; only the `/solutions` route was de-mocked in this subphase.
- `evidenceReadinessPct` remains untouched at its default — it belongs to the compliance/evidence phases.
- Partner editing is limited to five text columns (`notes`, `description`, `technologies`, `targetBeneficiaries`, `risks`) intersected with the share allow-list.

## 10. Deferred to Phase 4B

- Publish/unpublish workflow (governed, audited) to make Viewer access meaningful.
- Solution lifecycle transitions (DRAFT → ACTIVE → ARCHIVED) with proper actor rules.
- Evidence attachment/linking to solutions and the evidence-readiness figure.
- Impact indicators and measurements on the solution.
- Participating organizations (`SolutionOrganization`) management and partner sharing UI (grant/revoke).
- De-mocking the dashboard aggregates and registry pagination/sorting.
