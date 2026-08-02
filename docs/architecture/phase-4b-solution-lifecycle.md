# Phase 4B — Solution Lifecycle, Publishing & Partner Sharing

Completes the operational lifecycle of Innovation Solutions on top of the Phase 4A registry, reusing the Phase 2C authorization layer, the `ResourceShare` model and the audit writer. **No** evidence upload, document analysis, compliance scoring, or impact workflows.

---

## 1. Services & actions

**`lifecycle-service.ts`** — `changeRecordStatus`, `changeImplementationStatus`, `changeMaturityStage`, `publishSolution`, `unpublishSolution`, `missingPublishFields`, `computeLifecycleFlags`, plus the exported transition matrices.
**`sharing-service.ts`** — `grantSolutionShare`, `updateSolutionShare`, `revokeSolutionShare`, `listSolutionShares`, `addParticipatingOrganization`, `removeParticipatingOrganization`, `listParticipatingOrganizations`.
**`history-service.ts`** — `getSolutionHistory` (read-only, derived from `AuditLog`).
**`stats-service.ts`** — `getSolutionStats` (scope-filtered dashboard aggregates).
**Actions** — `lifecycle-actions.ts` (status/implementation/maturity/publish/unpublish) and `sharing-actions.ts` (grant/update/revoke, add/remove organization), with a shared Arabic error mapper in `action-errors.ts`.

## 2. Lifecycle transition matrix

**Record status** (`status-definitions.md` §3):

| From | Allowed to |
|---|---|
| DRAFT | ACTIVE, ARCHIVED |
| ACTIVE | ARCHIVED |
| ARCHIVED | — (terminal; all lifecycle writes rejected) |

**Implementation status** (§8):

| From | Allowed to |
|---|---|
| PLANNING | IN_PROGRESS, ON_HOLD, CANCELLED |
| IN_PROGRESS | OPERATING, ON_HOLD, CANCELLED |
| OPERATING | COMPLETED, ON_HOLD, CANCELLED |
| ON_HOLD | IN_PROGRESS, CANCELLED |
| COMPLETED / CANCELLED | — (terminal) |

**Maturity stage** (§7): `CONCEPT → PROTOTYPE → POC → PILOT → OPERATIONAL`. Forward movement is **one step at a time** (jumps rejected). **Regression is allowed only with a documented reason** (≥5 chars) and is audited with `regression: true` — no silent downgrade.

Every transition requires `solution.update` **and** in-scope access, and writes an audit entry (`SOLUTION_STATUS_CHANGED`, `SOLUTION_IMPLEMENTATION_CHANGED`, `SOLUTION_MATURITY_CHANGED`).

## 3. Publish rules

- Requires `solution.update` + scope (see limitation below).
- The record must be **ACTIVE** (a DRAFT cannot be published) and not archived.
- All **publish-required fields** must be filled: `nameAr`, `description`, `problemStatement`, `owningDepartmentId`, `ownerUserId`. Otherwise `PUBLISH_INCOMPLETE` is returned **naming the missing fields**.
- Publishing sets `publishedAt`, which is exactly what the PUBLISHED (Viewer) scope filter reads — so Viewer visibility begins immediately.
- `unpublishSolution` clears `publishedAt`; **Viewer visibility ends immediately**. Archiving (both `archiveSolution` and `changeRecordStatus → ARCHIVED`) also clears `publishedAt`, so an archived record can never linger in Viewer scope.
- Publishing is a **visibility act only** — the UI states plainly that it carries no compliance or DGA readiness meaning. Audited as `SOLUTION_PUBLISHED` / `SOLUTION_UNPUBLISHED`.

## 4. Partner-sharing behaviour

- **Granting/revoking requires `solution.update` + scope** over the solution; Viewers and Partners cannot grant or even list shares.
- A grant validates its allow-lists **at creation time**: actions must be in `SHAREABLE_ACTIONS` (`update_fields`, `upload_evidence`, `respond_info_request`) and fields must be in `PARTNER_UPDATABLE_FIELDS` and **never** in `PARTNER_FORBIDDEN_FIELDS` — a protected official field can't enter an allow-list even by mistake.
- Only **one active share per (user, solution)**; a duplicate is rejected (`DUPLICATE`) in favour of updating the existing one.
- The target must be an APPROVED + ACTIVE user, and self-sharing is rejected.
- **Revocation and expiry take effect immediately**: `isShareActive` (revoked → inactive; past `expiresAt` → inactive) gates both visibility (`solutionScopeWhere`) and writes (`requirePartnerFieldWrite`).
- All share events are audited with the share id (`SOLUTION_SHARE_GRANTED/UPDATED/REVOKED`), and partner writes remain audited with the originating share id.

**Participating organizations:** `SolutionOrganization` has **no role/type column**, so that optional part is not modelled (no migration). Duplicates are blocked by the composite primary key plus an explicit pre-check; add/remove are audited.

## 5. Solution history

`getSolutionHistory` reads the append-only `AuditLog` filtered to `entityType = INNOVATION_SOLUTION` — **no new history model was added**. The timeline surfaces creation, edits, status/implementation/maturity changes, publish/unpublish, share grants/updates/revocations and organization changes, each with actor and timestamp.

## 6. Dashboard de-mocking

`getSolutionStats` returns scope-filtered, archived-excluded aggregates: **total**, **by maturity stage**, **by implementation status**, and a **completeness distribution** (<40 / 40–69 / 70–89 / 90+). The dashboard's "الحلول الابتكارية المسجّلة" tile and the maturity/implementation breakdown card now read these real values (verified live: total **53**, matching the database, with all breakdowns summing to 53). The completeness distribution is labelled "(ليس مؤشر امتثال)".

**Still mock and intentionally untouched** (they belong to later phases): the DGA readiness tile and readiness grid, the activities count, and the alerts feed.

## 7. UI

`/solutions/[id]` gains: **LifecyclePanel** (record-status, implementation-status, maturity advance + reason-required regression, publish/unpublish with confirmations), **SharingPanel** (share list with active/expired/revoked badges, grant form with action/field checkboxes and expiry, revoke), **OrganizationsPanel** (add/remove participating organizations), and **HistoryTimeline**. All Arabic RTL with confirmations, inline errors and empty states. `/solutions` and `/solutions/[id]/edit` are unchanged from 4A apart from revalidation.

## 8. Tests & results

`tests/solution-lifecycle.test.ts` — **28 integration tests**: valid record/implementation transitions; downgrade and jump rejected; archived write-protection; terminal states; ON_HOLD resume; unauthorized lifecycle change; maturity one-step, skip rejected, regression reason required + audited; publish blocked when incomplete and when DRAFT; publish succeeds when complete+active; Viewer sees published only; unpublish and archive both remove visibility; viewer cannot publish; share grant enables partner access and allowed writes; forbidden/unknown entries rejected at grant time; revoke and expiry block immediately; duplicate share rejected; only authorized internal users grant/list; cross-department sharing blocked; organization add/list/remove and duplicate blocked; history contains every lifecycle event; dashboard aggregates match direct database counts and are scope-filtered.

**Full suite: 155 tests passing.** `npm run lint` clean · `npm run typecheck` clean · `npm run build` 20 routes. Manual browser check: lifecycle/sharing/organizations/history panels render with correct available transitions; dashboard totals match the database.

## 9. Migrations

**None.** `publishedAt` (Phase 2C), `ResourceShare.expiresAt/revokedAt/revokedById` (Phase 2C) and `SolutionOrganization` already existed.

## 10. Limitations

- **Publish is gated on `solution.update`**, because the approved permission catalogue has no `solution.publish` key and this phase does not extend it. A dedicated publish permission (or a higher gate) is worth considering — flagged for review.
- Publishing has no approval workflow or scheduled expiry; it is a single authorized act.
- `SolutionOrganization` carries **no role/type**, so participation is a plain link (adding a role column would need a migration).
- Share **updating** exists in the service but the UI only exposes grant + revoke (update is API-only for now).
- The share UI lists users holding the `EXTERNAL_PARTNER` role; there is no organization-level share (shares are per user).
- The DGA readiness tile, readiness grid, activities count and alerts on the dashboard remain mock — out of this phase's scope.
- Lifecycle flags shown in the UI are advisory; e.g. the publish button appears for an ACTIVE record and the server then returns the precise missing-field list.

## 11. Deferred to Phase 4C / Phase 5

- Evidence upload and linking to solutions; evidence-readiness (`evidenceReadinessPct`).
- Impact indicators and measurements on solutions.
- Compliance requirement mapping and readiness scoring (and replacing the DGA tile/readiness grid).
- Document analysis of solution attachments.
- Share-update UI, organization-level sharing, and a partner self-service view.
- Registry pagination/sorting and dashboard alerts/activities de-mocking.
