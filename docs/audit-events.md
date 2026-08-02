# Audit Events — Current Catalogue

Single source of truth in code: `AUDIT` in `src/server/audit.ts`, written via `writeAudit()`. Every mutating action in every module writes one of these into `AuditLog` (`action`, `entityType`, `entityId`, `summary`, `beforeData`/`afterData`, `metadata`, `actorUserId`, `createdAt`). The `/audit` page reads this table read-only.

`AuditLog` is append-only — nothing in the platform updates or deletes a row once written.

## Identity & access lifecycle
`USER_REGISTERED`, `REGISTRATION_APPROVED`, `REGISTRATION_REJECTED`, `USER_ACTIVATED`, `USER_DEACTIVATED`, `USER_SUSPENDED`, `USER_RESTORED`, `USER_ROLE_ASSIGNED`, `USER_ROLE_REMOVED`, `LOGIN_BLOCKED_PENDING`, `LOGIN_BLOCKED_REJECTED`, `LOGIN_BLOCKED_INACTIVE`, `LOGIN_BLOCKED_SUSPENDED`, `LOGIN_RATE_LIMITED`, `REGISTRATION_RATE_LIMITED`

Covers self-registration → admin approval/rejection → account state changes, plus every blocked-login reason and role assignment/removal (the `/admin/users` role assignment feature writes `USER_ROLE_ASSIGNED`/`USER_ROLE_REMOVED`).

## Immutability-sanctioned change paths
`DECISION_SUPERSEDED`, `DECISION_REOPENED`, `MEASUREMENT_SUPERSEDED`, `MEASUREMENT_REOPENED`

Idea decisions and impact measurements are otherwise immutable once recorded; these four events are the *only* sanctioned way to change one, and always via a new record superseding the old (never an in-place edit).

## Ideas (5.23.3 governance)
`IDEA_CREATED`, `IDEA_UPDATED`, `IDEA_SUBMITTED`, `IDEA_WITHDRAWN`, `IDEA_ARCHIVED`, `IDEA_RESTORED`

`IDEA_ARCHIVED` writes the pre-archive `status` into `beforeData` — this is exactly what `IDEA_RESTORED`'s restore logic reads back to know what status to return to, rather than guessing (see `restoreIdea` in `src/modules/ideas/service.ts`).

## Strategic planning (5.23.1)
`STRATEGIC_OBJECTIVE_CREATED/UPDATED/ARCHIVED`, `COMPLIANCE_ASSIGNMENT_CREATED/UPDATED/ARCHIVED`, `STRATEGY_DOCUMENT_UPLOADED/UPDATED/ARCHIVED`

Objective, requirement-assignment, and strategy-document lifecycles. Requires the frozen migration (`ComplianceRequirementAssignment`/`StrategyDocument` tables) to be applied before these can fire for anything but objectives.

## Methodologies & activities (5.23.2)
`ACTIVITY_CREATED`, `ACTIVITY_UPDATED`, `ACTIVITY_ARCHIVED`

## Innovation governance committees (5.23.3)
`COMMITTEE_CREATED/UPDATED/ARCHIVED`, `COMMITTEE_MEMBER_ADDED/UPDATED/REMOVED`, `COMMITTEE_MEETING_CREATED/UPDATED/ARCHIVED`

Requires the frozen migration. `COMMITTEE_MEETING_CREATED`'s summary includes the sequential meeting number.

## Challenges
`CHALLENGE_CREATED/UPDATED/ARCHIVED`, `CHALLENGE_SOLUTION_LINKED/UNLINKED`

Requires the frozen migration.

## Idea evaluation / review
`IDEA_REVIEW_STARTED`, `IDEA_EVALUATION_SUBMITTED`, `IDEA_ADVANCED_TO_TECHNICAL`, `IDEA_MORE_INFO_REQUESTED`, `IDEA_INFO_RESUBMITTED`

## Idea final decisions & conversion
`IDEA_DECISION_APPROVED`, `IDEA_DECISION_REJECTED`, `IDEA_CONVERTED`

## Solutions registry
`SOLUTION_CREATED/UPDATED/ARCHIVED`, `SOLUTION_PARTNER_UPDATED`, `SOLUTION_STATUS_CHANGED`, `SOLUTION_MATURITY_CHANGED`, `SOLUTION_IMPLEMENTATION_CHANGED`, `SOLUTION_PUBLISHED`, `SOLUTION_UNPUBLISHED`, `SOLUTION_SHARE_GRANTED/UPDATED/REVOKED`, `SOLUTION_ORG_ADDED/REMOVED`

## Evidence management
`EVIDENCE_UPLOADED`, `EVIDENCE_UPDATED`, `EVIDENCE_SUBMITTED`, `EVIDENCE_REVIEW_STARTED`, `EVIDENCE_APPROVED`, `EVIDENCE_REJECTED`, `EVIDENCE_ARCHIVED`, `EVIDENCE_LINKED`, `EVIDENCE_UNLINKED`

`EVIDENCE_UPLOADED` is the one event reused across three upload entry points (solution/activity/strategy-document evidence) — always with `entityType: "EVIDENCE"` and `entityId` set to the evidence record's own id, distinguishing which context it came from only via `metadata` (`solutionId`/`activityId`/`documentId`). **`EVIDENCE_UPDATED` is currently unused** — no code path writes it (pre-existing, not part of this integration).

## Binary storage & secure access
`EVIDENCE_DOWNLOADED`, `EVIDENCE_DOWNLOAD_DENIED`, `EVIDENCE_FILE_REPLACED`

`EVIDENCE_DOWNLOAD_DENIED` is a security-relevant negative event — it fires when a download is attempted and rejected by authorization, not just on success.

## AI document analysis
`ANALYSIS_QUEUED`, `ANALYSIS_STARTED`, `ANALYSIS_COMPLETED`, `ANALYSIS_FAILED`, `SUGGESTION_ACCEPTED`, `SUGGESTION_EDITED`, `SUGGESTION_REJECTED`

The AI only ever proposes; `SUGGESTION_ACCEPTED/EDITED/REJECTED` are always a human decision on the AI's output, never automatic.

## Compliance readiness engine
`COMPLIANCE_SECTION_CREATED/UPDATED`, `COMPLIANCE_REQUIREMENT_CREATED/UPDATED/ACTIVATED/DEACTIVATED`, `COMPLIANCE_NA_REQUESTED/APPROVED/REJECTED/REVOKED`, `COMPLIANCE_EXPORTED`

The engine never sets readiness itself — readiness is always computed live from real records + approved evidence. These events cover configuration changes and the governed not-applicable (N/A) exception workflow.

## Adding a new event
Add the key to `AUDIT` in `src/server/audit.ts`, call `writeAudit({ action: AUDIT.YOUR_KEY, ... })` from the relevant `service.ts` mutation, and add it to this document under the right group. An `AUDIT` key with no `writeAudit()` caller anywhere is dead code — see the Production Readiness Cleanup review for how that's checked.
