# Phase 3C — Final Decisions, Conversion to Solution & Persisted Kanban

Completes the governance thread (5.23.3): `TECHNICAL_REVIEW → APPROVED_FOR_PILOT | REJECTED → CONVERTED_TO_SOLUTION`, plus a governance Kanban backed by real data. Builds on Phase 3A/3B and reuses the Phase 2C authorization + immutability guards. **No** solution CRUD/registry, evidence, document analysis, compliance scoring, or impact work.

---

## 1. Routes & components changed

| Path | Change |
|---|---|
| `/governance` | **Replaced the mock Kanban** with a persisted, scope-filtered ideas board |
| `/governance/ideas/[id]` | Added decision panel, decision history, linked-solution summary |

New components: `decision-panel.tsx` (client — approve/reject/convert/reopen/supersede forms with confirmations), `decision-history.tsx` (append-only history), `ideas-kanban.tsx` (read-only board).

## 2. Services & actions

**`decision-service.ts`:** `approveForPilot`, `rejectIdea`, `getIdeaDecisionHistory`, `reopenIdeaDecision`, `supersedeIdeaDecision`, `computeDecisionFlags`.
**`conversion-service.ts`:** `convertApprovedIdeaToSolution`, `getLinkedSolution`.
**`kanban.ts`:** `KANBAN_COLUMNS`, `listKanbanIdeas`.
**`decision-actions.ts`:** `approveIdeaAction`, `rejectIdeaAction`, `convertIdeaAction`, `reopenDecisionAction`, `supersedeDecisionAction` — resolve the actor from the session, map typed errors to Arabic, revalidate the idea/list/board paths.

## 3. Decision rules

- Requires **`idea.decide`**; the actor must be **in scope** (`requireScope(IDEA)`).
- **Author cannot decide their own idea** unless they hold **PLATFORM** scope (`SELF_DECISION`).
- **Only `TECHNICAL_REVIEW`** may be approved or rejected; anything else → `INVALID_TRANSITION`.
- Decisions are written as **new finalized rows** (`finalizedAt` + `finalizedById`) — there is no update path, so a finalized decision can never be silently overwritten. The Phase 2C `assertMutable("IDEA_DECISION", …)` guard rejects in-place edits.
- **Reopen** goes only through the Phase 2C `reopenDecision` guard: requires a **reason** (Zod, ≥5 chars), clears finalization, records who/why, audits `DECISION_REOPENED`, and returns the idea to `TECHNICAL_REVIEW`. Blocked after conversion.
- **Supersede** goes only through the Phase 2C `supersedeDecision` guard: requires a **new decision + reason**, creates a linked row (`supersedesId`) preserving the original, audits `DECISION_SUPERSEDED`, and moves the idea to the corrected status. Blocked after conversion.
- Every decision writes an audit entry (`IDEA_DECISION_APPROVED` / `IDEA_DECISION_REJECTED`).

## 4. Conversion rules

- Requires **`idea.decide` + `solution.create`** and in-scope access.
- **Only `APPROVED_FOR_PILOT`** may convert (`NOT_APPROVED` otherwise).
- **Exactly one solution per idea:** explicit pre-check plus the `InnovationSolution.ideaId` unique index (P2002 race → `ALREADY_CONVERTED`); after conversion the idea is `CONVERTED_TO_SOLUTION`, so a second attempt also fails the status gate.
- Runs in a **single transaction**: create solution → set idea `CONVERTED_TO_SOLUTION` → record a finalized `CONVERT_TO_SOLUTION` decision → audit `IDEA_CONVERTED`.
- **Only justified fields are copied:** `titleAr → nameAr`, `description → description` + `problemStatement` (problem context), `departmentId → owningDepartmentId`, `activityId` (+ `source = ACTIVITY | INTERNAL_PROPOSAL`), `submittedById → ownerUserId` (responsible owner). The solution starts as `DRAFT` — this is not solution editing.
- Idea ↔ Solution linked both ways via the unique `ideaId` relation.

## 5. Kanban behaviour

- Columns: Submitted · Initial Review · Technical Review · More Information Requested · Approved for Pilot · Rejected · Converted. (`DRAFT`/`WITHDRAWN`/`ARCHIVED` are outside the active board.)
- Data comes from `listKanbanIdeas`, which requires `idea.view` and applies `ideaScopeWhere(ctx)` server-side — **no mock data** (the previous `solutionsMock` board was removed; a test asserts the page neither imports the mock nor renders anything but persisted ids).
- **Read-only by design.** Drag-and-drop is deliberately not enabled: status changes must pass the validated server-side transitions, so the board cannot generate an arbitrary/invalid transition. Cards link to the idea details page where every action lives (the phase's explicitly sanctioned option).
- `/governance` renders a permission placeholder (and fetches nothing) for users without `idea.view`, so Partner/Viewer see no data.

## 6. Authorization & immutability usage

Reused without re-implementation: `requirePermission`, `requireScope`, `ideaScopeWhere`, `assertMutable`, `supersedeDecision`, `reopenDecision`, and `writeAudit`. External Partner and Viewer hold neither `idea.decide` nor `idea.view`, so they are denied at the permission layer for decisions, conversion, and the board. All enforcement is server-side; UI flags (`computeDecisionFlags`) only decide which buttons render.

## 7. Tests & results

`tests/idea-decisions.test.ts` — **22 integration tests**: approve/reject transitions; decision stored + finalized; missing `idea.decide` blocked; partner/viewer blocked; cross-department blocked; self-decision blocked; PLATFORM may self-decide; non-TECHNICAL_REVIEW rejected; finalized decision immutable + no re-decide; reopen requires reason, clears finalization, audits; supersede requires reason, preserves the original, audits; history preserved; conversion links one solution and updates status; duplicate conversion blocked; rejected cannot convert; conversion permission/scope enforced; Kanban scope-filtered and persisted; no mock data; viewer cannot read the board; audit records for approve/reject/convert.

**Full suite: 104 tests passing.** `npm run lint` clean · `npm run typecheck` clean · `npm run build` 19 routes (`/governance` is now dynamic/server-rendered, previously static mock). Manual browser check: board counts match the database, converted idea shows the linked solution + two finalized decisions, TECHNICAL_REVIEW idea shows the decision panel, empty states render.

## 8. Migrations

**None.** `IdeaDecision` already carried `finalizedAt/finalizedById/supersedesId/reopened*` (Phase 2A) and `InnovationSolution.ideaId` is already `@unique` with the `SolutionFromIdea` relation — no schema change was required.

## 9. Limitations

- Kanban is **read-only** (no drag-and-drop) by deliberate choice; transitions happen on the details page.
- Reopen returns the idea to `TECHNICAL_REVIEW`; it does not roll back a conversion (blocked after conversion by design).
- `INITIAL_REVIEW → REJECTED` (allowed by `status-definitions.md` §4.1) is intentionally **not** exposed here — this phase restricts approve/reject to `TECHNICAL_REVIEW` as specified.
- Created solutions are minimal `DRAFT` records; there is no solution detail route yet, so the linked-solution card is a summary only.
- No board pagination/virtualisation (pilot volume).

## 10. Deferred to Phase 4

- Innovation Solutions registry: solution detail/edit routes, lifecycle and ownership management.
- Evidence upload + linking, document analysis, compliance scoring/readiness, impact indicators and measurements.
- Published projections for Viewer access; notifications/alerts on decisions.
- Optional drag-and-drop Kanban backed by validated transition endpoints.
