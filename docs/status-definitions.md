# Status Definitions — منصة إدارة الابتكار المؤسسي

Every entity's status values, meanings, allowed transitions, and **who may perform each transition**. Values map to the enums in `prisma/schema.prisma`; where the MVP needs values not yet in the schema, they are marked **(delta)** and cross-referenced to `data-dictionary.md` §12.

> **Key correction:** technical file-processing, governance evidence-review, and AI analysis are **three separate status concepts** on different fields/models — never one combined enum (see §10–§12).

Notation: `A → B` = allowed transition. Actor = the permission/role that may perform it.

---

## 1. Registration / user approval **(delta)**
| Status | Meaning |
|---|---|
| `PENDING` | Registered, awaiting Admin decision; no effective access. |
| `APPROVED` | Admin approved; role + scope assigned. |
| `REJECTED` | Admin rejected; no access; audit retained. |

| Transition | Actor |
|---|---|
| `PENDING → APPROVED` | System Administrator (`user.manage`) |
| `PENDING → REJECTED` | System Administrator (`user.manage`) |

## 2. UserStatus (account operational)
`ACTIVE ↔ SUSPENDED`, `ACTIVE → INACTIVE`, `INACTIVE → ACTIVE` — all by System Administrator (`user.manage`).

---

## 3. RecordStatus (Organization, Department, StrategicObjective, InnovationSolution)
| Status | Meaning |
|---|---|
| `DRAFT` | Being created; not official. |
| `ACTIVE` | In use; counts where applicable. |
| `ARCHIVED` | Retired/superseded; retained for audit. |

Transitions `DRAFT → ACTIVE → ARCHIVED`, `DRAFT → ARCHIVED`. Actor: record owner within scope (`*.create`/`*.update`/`*.archive`). No hard delete.

---

## 4. IdeaStatus (governance) — **updated: adds `DRAFT` and `WITHDRAWN`**

Proposed lifecycle values (**delta** — current schema lacks `DRAFT`/`WITHDRAWN`; to be added):
`DRAFT · SUBMITTED · INITIAL_REVIEW · TECHNICAL_REVIEW · MORE_INFO_REQUESTED · APPROVED_FOR_PILOT · REJECTED · CONVERTED_TO_SOLUTION · WITHDRAWN · ARCHIVED`

| Status | Meaning |
|---|---|
| `DRAFT` | Author is still preparing; not yet in governance; visible only to author/owning dept. |
| `SUBMITTED` | Entered governance intake. |
| `INITIAL_REVIEW` | Under initial screening. |
| `TECHNICAL_REVIEW` | Under technical evaluation. |
| `MORE_INFO_REQUESTED` | Returned to author for clarification. |
| `APPROVED_FOR_PILOT` | Approved to proceed. |
| `REJECTED` | Declined by decision. |
| `CONVERTED_TO_SOLUTION` | Became an InnovationSolution. |
| `WITHDRAWN` | Author (or owning dept) retracted it before a final decision. |
| `ARCHIVED` | Closed/retained (post-terminal housekeeping). |

### 4.1 Allowed transitions + who may perform them
| Transition | Actor |
|---|---|
| `— → DRAFT` (create) | Submitter (Internal Editor, in-scope) / author |
| `DRAFT → SUBMITTED` | Submitter (author) |
| `DRAFT → WITHDRAWN` | Submitter (author) |
| `SUBMITTED → INITIAL_REVIEW` | Reviewer (`idea.evaluate`) |
| `INITIAL_REVIEW → TECHNICAL_REVIEW` | Reviewer (`idea.evaluate`) |
| `INITIAL_REVIEW → MORE_INFO_REQUESTED` | Reviewer (`idea.evaluate`) |
| `TECHNICAL_REVIEW → MORE_INFO_REQUESTED` | Reviewer (`idea.evaluate`) |
| `MORE_INFO_REQUESTED → INITIAL_REVIEW` | Submitter resubmits (author) → re-enters review |
| `INITIAL_REVIEW → REJECTED` | Decision-maker (`idea.decide`) |
| `TECHNICAL_REVIEW → REJECTED` | Decision-maker (`idea.decide`) |
| `TECHNICAL_REVIEW → APPROVED_FOR_PILOT` | Decision-maker (`idea.decide`) |
| `APPROVED_FOR_PILOT → CONVERTED_TO_SOLUTION` | Decision-maker (`idea.decide`) + `solution.create` |
| `SUBMITTED/INITIAL_REVIEW/TECHNICAL_REVIEW/MORE_INFO_REQUESTED → WITHDRAWN` | Submitter (author) — only **before** a final decision |
| `REJECTED → ARCHIVED` | System Administrator / owning dept |
| `WITHDRAWN → ARCHIVED` | System Administrator / owning dept |
| `CONVERTED_TO_SOLUTION → ARCHIVED` | System Administrator (housekeeping; solution link preserved) |

**Rules:** each transition writes an `IdeaEvaluation`/`IdeaDecision` (as applicable) + `AuditLog`. `WITHDRAWN` is author-initiated and only valid pre-decision. Terminal: `CONVERTED_TO_SOLUTION`, `ARCHIVED` (and `REJECTED`/`WITHDRAWN` before archival). The Kanban board is a projection of this field; drag = a server action that must respect these actor rules.

## 5. EvaluationStage (IdeaEvaluation)
`INITIAL → TECHNICAL → COMMITTEE` — an event record per evaluation (Actor: `idea.evaluate`).

## 6. DecisionType (IdeaDecision)
`APPROVE_FOR_PILOT · REJECT · REQUEST_MORE_INFO · CONVERT_TO_SOLUTION · DEFER` — event values (Actor: `idea.decide`). **Finalized decisions are immutable — see §13.**

---

## 7. MaturityStage (InnovationSolution)
`CONCEPT → PROTOTYPE → POC → PILOT → OPERATIONAL` (Actor: `solution.update`, in scope). Regression allowed with audit note.

## 8. ImplementationStatus (InnovationSolution)
`PLANNING → IN_PROGRESS → OPERATING → COMPLETED`; any active `→ ON_HOLD`/`→ CANCELLED`; `ON_HOLD → IN_PROGRESS` (Actor: `solution.update`).

## 9. ActivityStatus (InnovationActivity)
`PLANNED → ONGOING → COMPLETED`; any `→ CANCELLED` (Actor: activity owner / Internal Editor in scope).

---

## 10. File processing status **(delta — technical only)**
On `Evidence.fileProcessingStatus`. Describes the **file**, not its governance standing.
| Status | Meaning |
|---|---|
| `UPLOADED` | File stored (checksum recorded); nothing processed yet. |
| `PROCESSING` | Extraction pipeline running. |
| `EXTRACTION_READY` | Text/tables extracted successfully; ready for review/mapping. |
| `PROCESSING_FAILED` | Extraction failed; manual mapping still available. |

Transitions: `UPLOADED → PROCESSING → EXTRACTION_READY`; `PROCESSING → PROCESSING_FAILED`; `PROCESSING_FAILED → UPLOADED` (retry). Actor: **system** (pipeline) — never a human decision. **`EXTRACTION_READY` is purely technical and does NOT mean the evidence is approved.**

## 11. Evidence review status **(delta — governance)**
On `Evidence.reviewStatus`. Describes the **governance standing** of the evidence.
| Status | Meaning |
|---|---|
| `DRAFT` | Created; not yet submitted for review. |
| `SUBMITTED` | Submitted into review. |
| `UNDER_REVIEW` | A reviewer is assessing it. |
| `APPROVED` | Approved; **counts toward readiness**. |
| `REJECTED` | Rejected; excluded from readiness. |
| `ARCHIVED` | Retired/superseded; retained for audit. |

| Transition | Actor |
|---|---|
| `DRAFT → SUBMITTED` | Uploader (`evidence.upload`, in scope) |
| `SUBMITTED → UNDER_REVIEW` | Reviewer (`evidence.approve`) |
| `UNDER_REVIEW → APPROVED` | Reviewer (`evidence.approve`) |
| `UNDER_REVIEW → REJECTED` | Reviewer (`evidence.approve`) |
| `APPROVED/REJECTED → ARCHIVED` | System Administrator / owner |

**A successfully extracted file (`EXTRACTION_READY`) is NOT automatically `APPROVED`.** Only a human with `evidence.approve` moves review status to `APPROVED`.

## 12. Document analysis status **(delta — AI pipeline)**
On `DocumentAnalysis.status`. Describes the **AI job**.
`QUEUED → PROCESSING → COMPLETED`; `PROCESSING → FAILED`. Actor: **system** (worker). A `COMPLETED` analysis produces *suggestions only* — never an approval.

### Relationship of the three concepts
```
Evidence.fileProcessingStatus   (technical: is the file extracted?)
Evidence.reviewStatus           (governance: is the evidence approved?)     ← the only one that affects readiness
DocumentAnalysis.status         (AI job: did analysis run?)                 ← produces suggestions, never approvals
```

---

## 13. Immutable governance records (finalized) **— correction #8**
Once **finalized**, these records are immutable — no silent overwrite:
- `IdeaDecision` (a final decision: approve/reject/convert).
- `ImpactMeasurement` with `verificationStatus = VERIFIED`.
- An approved N/A determination and an approved compliance export (future).

To change a finalized record, one of the following governed actions is required, each written to `AuditLog`:
| Action | Meaning | Actor |
|---|---|---|
| **Correction** | Add a linked correction entry; original preserved. | Authorized reviewer/admin |
| **Superseding version** | Create a new version that supersedes; prior kept read-only. | Authorized reviewer/admin |
| **Documented reopening** | Explicit reopen with a reason; audit records who/why. | System Administrator (or policy approver) |

`verificationStatus` regressions from `VERIFIED` require a documented reopening, not a silent edit.

---

## 14. VerificationStatus (Evidence, ImpactMeasurement)
`UNVERIFIED → PENDING → VERIFIED`; any `→ REJECTED`. `VERIFIED` requires `impact.verify` (for measurements). Post-`VERIFIED` changes follow §13.

## 15. AgreementStatus
`DRAFT → ACTIVE → EXPIRED`; `ACTIVE → TERMINATED`. **Final status change (e.g. → EXPIRED/TERMINATED) is an internal-authority action — never an External Partner** (see `authorization.md`). Actor: `agreement.update` held by an internal user/Admin.

## 16. RenewalStatus (CooperationAgreement)
`NOT_DUE → DUE_SOON → IN_PROGRESS → RENEWED`; `DUE_SOON/IN_PROGRESS → LAPSED`. Drives renewal alerts. Actor: internal responsible user.

## 17. MeetingStatus (AgreementMeeting)
`SCHEDULED → HELD`; `SCHEDULED → MISSED`; `SCHEDULED → CANCELLED`. Actor: internal `meeting.update`; External Partner may confirm attendance / upload minutes on **shared** meetings only.

---

## 18. Alert
- **AlertStatus:** `OPEN → ACKNOWLEDGED → RESOLVED`; `OPEN/ACKNOWLEDGED → DISMISSED` (Actor: assignee / `alert.resolve`).
- **AlertSeverity:** `INFO < WARNING < CRITICAL`.
- **AlertType:** `MEETING_OVERDUE · MEETING_UPCOMING · AGREEMENT_EXPIRY · AGREEMENT_RENEWAL · MISSING_EVIDENCE · INCOMPLETE_SOLUTION · IMPACT_WINDOW · EVALUATION_DEADLINE · APPROVAL_TASK`.

## 19. Notification
`read: false → true`; **NotificationType:** `INFO · SUCCESS · WARNING · DANGER`.

---

## 20. Summary matrix

| Entity / field | Status set | Terminal |
|---|---|---|
| Registration (delta) | PENDING/APPROVED/REJECTED | APPROVED, REJECTED |
| User | ACTIVE/INACTIVE/SUSPENDED | INACTIVE |
| Org/Dept/Objective/Solution | DRAFT/ACTIVE/ARCHIVED | ARCHIVED |
| **Idea** (delta) | DRAFT/SUBMITTED/INITIAL_REVIEW/TECHNICAL_REVIEW/MORE_INFO_REQUESTED/APPROVED_FOR_PILOT/REJECTED/CONVERTED_TO_SOLUTION/WITHDRAWN/ARCHIVED | CONVERTED_TO_SOLUTION, ARCHIVED |
| Solution | MaturityStage / ImplementationStatus | COMPLETED / CANCELLED |
| Activity | PLANNED/ONGOING/COMPLETED/CANCELLED | COMPLETED, CANCELLED |
| **Evidence.fileProcessingStatus** (delta) | UPLOADED/PROCESSING/EXTRACTION_READY/PROCESSING_FAILED | EXTRACTION_READY, PROCESSING_FAILED |
| **Evidence.reviewStatus** (delta) | DRAFT/SUBMITTED/UNDER_REVIEW/APPROVED/REJECTED/ARCHIVED | APPROVED→ARCHIVED, REJECTED→ARCHIVED |
| **DocumentAnalysis.status** (delta) | QUEUED/PROCESSING/COMPLETED/FAILED | COMPLETED, FAILED |
| Verification | UNVERIFIED/PENDING/VERIFIED/REJECTED | VERIFIED, REJECTED |
| Agreement | DRAFT/ACTIVE/EXPIRED/TERMINATED | EXPIRED, TERMINATED |
| Renewal | NOT_DUE/DUE_SOON/IN_PROGRESS/RENEWED/LAPSED | RENEWED, LAPSED |
| Meeting | SCHEDULED/HELD/MISSED/CANCELLED | HELD, MISSED, CANCELLED |
| Alert | OPEN/ACKNOWLEDGED/RESOLVED/DISMISSED | RESOLVED, DISMISSED |
