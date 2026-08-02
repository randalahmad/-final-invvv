# Phase 3B — Idea Evaluation & Review Workflow

Adds the reviewer workflow on top of Phase 3A ideas: SUBMITTED → INITIAL_REVIEW → TECHNICAL_REVIEW, with a MORE_INFO_REQUESTED loop and author resubmission. No final approve/reject decision, no conversion-to-solution, no Kanban (Phase 3C+).

Module additions under `src/modules/ideas/` (`evaluation-*`). Surfaced inside `/governance/ideas/[id]`.

---

## 1. Status transitions

| From | To | Actor | Service fn |
|---|---|---|---|
| SUBMITTED | INITIAL_REVIEW | reviewer (`idea.evaluate`, in scope, not author) | `startInitialReview` |
| INITIAL_REVIEW | TECHNICAL_REVIEW | reviewer | `advanceToTechnicalReview` |
| INITIAL_REVIEW / TECHNICAL_REVIEW | MORE_INFO_REQUESTED | reviewer | `requestMoreInformation` |
| MORE_INFO_REQUESTED | INITIAL_REVIEW | author | `resubmitRequestedInformation` |

Recording an evaluation (`submitInitialEvaluation` / `submitTechnicalEvaluation`) does **not** change status — it appends an `IdeaEvaluation` event in the current stage. All other transitions are rejected (`INVALID_TRANSITION` / `INVALID_STAGE`). Aligned with `status-definitions.md` §4.1.

## 2. Services & actions

**Service** (`evaluation-service.ts`, actor-injected, server-side): `startInitialReview`, `submitInitialEvaluation`, `advanceToTechnicalReview`, `submitTechnicalEvaluation`, `requestMoreInformation`, `resubmitRequestedInformation`, `listIdeaEvaluations`, `listInfoRequests`, `getEvaluationDetails`, plus `computeReviewFlags` (UI display).

**Actions** (`evaluation-actions.ts`, `"use server"`): `startInitialReviewAction`, `advanceToTechnicalReviewAction`, `submitInitialEvaluationAction`, `submitTechnicalEvaluationAction`, `requestMoreInformationAction`, `resubmitInfoAction` — resolve the actor via `getAccessContext`, call the service, map typed errors (`AuthorizationError`/`EvaluationError`) to Arabic, `revalidatePath`.

## 3. Authorization rules (Phase 2C reuse)

- **Reviewer actions** require `idea.evaluate` (`requirePermission`) **and** `requireScope(IDEA)` (in the idea's department/organization). EXTERNAL_PARTNER and VIEWER lack `idea.evaluate` → `FORBIDDEN`. A cross-department evaluator → `OUT_OF_SCOPE`. SYSTEM_ADMIN (platform) may review any idea.
- **Separation of duties:** the idea author cannot evaluate their own idea (`SELF_EVALUATION`) even though INTERNAL_EDITOR holds `idea.evaluate` — unless platform-authorized (admin).
- **Author action** (`resubmitRequestedInformation`) requires `idea.view`, in-scope, and being the author (`NOT_AUTHOR` otherwise).
- Everything is enforced server-side; the UI panel (`computeReviewFlags`) only decides which forms to show.

## 4. Business rules

- Only SUBMITTED enters INITIAL_REVIEW; only INITIAL_REVIEW advances to TECHNICAL_REVIEW.
- **MORE_INFO_REQUESTED stores** the requested information, requester (`requestedById`), and `requestedAt` in a dedicated `IdeaInfoRequest` (status `OPEN`).
- The author **only stores a response** (`responseText`, `respondedById`, `respondedAt`, status `ANSWERED`) — the submitted idea's title/description are **not** overwritten. Resubmission returns the idea to INITIAL_REVIEW (per §4.1) and preserves the full request/response history.
- **Evaluations are append-only** (`IdeaEvaluation` is insert-only; `createdAt` = submittedAt) — never silently overwritten; history is preserved across multiple submissions.
- Every review action writes an `AuditLog` entry: `IDEA_REVIEW_STARTED`, `IDEA_EVALUATION_SUBMITTED`, `IDEA_ADVANCED_TO_TECHNICAL`, `IDEA_MORE_INFO_REQUESTED`, `IDEA_INFO_RESUBMITTED`.

## 5. Evaluation data

- **`IdeaEvaluation`** (existing, unchanged): `stage` (INITIAL/TECHNICAL), `evaluatorId`, `notes` (comments), optional `score` (0–100), `createdAt` (submittedAt). Insert-only → history-safe.
- **`IdeaInfoRequest`** (new — genuinely required; existing models cannot store request+response): `ideaId` (relation), `requestedById`, `requestedInfo`, `requestedAt`, `responseText?`, `respondedById?`, `respondedAt?`, `status` (`OPEN`/`ANSWERED`). Migration `20260722223244_idea_info_requests` (additive) + `Idea.infoRequests` back-relation + `InfoRequestStatus` enum.

Validation via Zod (`evaluation-schema.ts`): evaluation comments (3–4000) + optional score (0–100); info request (3–2000); info response (3–4000).

## 6. UI

Inside `/governance/ideas/[id]`: a **Review Panel** (`review-panel.tsx`, client) that conditionally renders start-review / evaluation form (comments + score) / advance-to-technical / request-more-info / author-response forms based on `computeReviewFlags`; and a **Review Timeline** (`evaluation-timeline.tsx`, server) showing info requests (+ responses) and evaluations newest-first with stage, score, evaluator, and empty state. Arabic RTL throughout; loading/error states inherited from the Phase 3A ideas route. No final-decision UI.

## 7. Tests

`tests/idea-evaluation.test.ts` — **15 integration tests** against a disposable PostgreSQL DB (with a second in-scope reviewer and a cross-department editor created in setup): start review; unauthorized (partner/viewer) blocked; cross-department out of scope; author self-evaluation blocked; invalid start; initial evaluation stored (append-only); evaluation outside stage rejected; advance to technical + technical evaluation stored; invalid advance; history preserved; request-more-info (requester/requestedAt stored); author response stored + idea not overwritten + returns to review; non-author cannot respond; respond without request rejected; audit records. **Full suite: 82 tests passing** (15 evaluation + 17 ideas + 36 authorization + 14 identity).

## 8. Validation

`npm test` → 82/82 · `npm run lint` clean · `npm run typecheck` clean · `npm run build` → 19 routes. Migrations apply cleanly from zero on PostgreSQL 16. Manual browser check (admin as reviewer): SUBMITTED idea shows the review panel; "بدء المراجعة الأولية" transitions to INITIAL_REVIEW and reveals the evaluation / advance / request-info forms; timeline empty state renders.

## 9. Known limitations

- `resubmitRequestedInformation` always returns to INITIAL_REVIEW (per §4.1), even if the info was requested during TECHNICAL_REVIEW — the prior technical stage is not restored (documented, matches the approved doc).
- No minimum-evaluation gate before advancing (a reviewer may advance without recording an evaluation).
- Reviewer identity is not assigned/locked to a single person — any in-scope non-author reviewer may act.
- Evaluations and info requests are visible to anyone with `idea.view` + scope (including the author); no reviewer-private notes.

## 10. Deferred to Phase 3C

- Final decisions (`IdeaDecision` approve/reject) with the Phase 2C immutability guard on finalized decisions.
- TECHNICAL_REVIEW → APPROVED_FOR_PILOT / REJECTED, and APPROVED_FOR_PILOT → CONVERTED_TO_SOLUTION.
- Persisted governance Kanban projection over the idea statuses.
- Committee stage (`EvaluationStage.COMMITTEE`) usage and reviewer assignment.
