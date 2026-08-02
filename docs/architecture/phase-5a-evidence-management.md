# Phase 5A — Evidence Management

Evidence registry, upload, governance lifecycle, linking, timeline, and **evidence-only readiness** for Innovation Solutions. Built on the existing Phase 2C authorization layer and audit writer. No AI analysis, compliance scoring, compliance files, impact measurements, or dashboard redesign.

Module: `src/modules/evidence/`. Routes under `/solutions/[id]/evidence`.

---

## 1. Routes

| Route | Purpose |
|---|---|
| `/solutions/[id]/evidence` | Registry: search, status filters, include-archived toggle, readiness card |
| `/solutions/[id]/evidence/new` | Upload form (PDF/DOCX/XLSX) |
| `/solutions/[id]/evidence/[evidenceId]` | Details, lifecycle actions, links panel, timeline |

Plus `loading.tsx` (skeleton) and `error.tsx` (FORBIDDEN-aware) on the evidence route. The solution details page gained an "أدلة الحل" entry point (shown to `evidence.view` holders).

## 2. Services & actions

**Service** (`service.ts`): `listSolutionEvidence`, `getEvidenceById`, `uploadEvidence`, `submitEvidence`, `startEvidenceReview`, `approveEvidence`, `rejectEvidence`, `archiveEvidence`, `linkEvidence`, `unlinkEvidence`, `listEvidenceLinks`, `getEvidenceTimeline`, `computeEvidenceReadiness`, `validateFile`, `computeEvidenceFlags`.

**Actions** (`actions.ts`): `uploadEvidenceAction`, `submitEvidenceAction`, `startReviewAction`, `approveEvidenceAction`, `rejectEvidenceAction`, `archiveEvidenceAction`, `linkEvidenceAction`, `unlinkEvidenceAction` — each resolves the actor from the session, calls the service, maps typed errors to Arabic, revalidates.

## 3. Authorization behavior

All enforcement is server-side; the UI only hides controls it already knows are unavailable.

| Principal | Behavior |
|---|---|
| SYSTEM_ADMIN | Full access across departments (PLATFORM scope). |
| INTERNAL_EDITOR | `evidence.view` + `evidence.upload` within department/organization scope. Cannot approve (no `evidence.approve` by default). |
| EXTERNAL_PARTNER | Reaches a solution only via an **active** `ResourceShare`. Upload requires that share's `allowedActions` to include **`evidence.create`**; otherwise `ACTION_NOT_ALLOWED`. Expired or revoked shares grant nothing (`OUT_OF_SCOPE`). Never approves. |
| VIEWER | Read-only, and only **APPROVED** evidence on solutions visible through the PUBLISHED projection. Non-approved items are not listed and 404 when addressed directly. |

Access mode is resolved per request (`resolveAccessMode`): INTERNAL (platform/department/organization) → PARTNER (active share) → PUBLISHED (viewer). Reads go through `requirePermission("evidence.view")` + `requireScope("INNOVATION_SOLUTION", …)`; uploads add `requireShareAction(…, "evidence.create")` for non-internal callers.

**Note:** the share action key was renamed `upload_evidence` → **`evidence.create`** in `SHAREABLE_ACTIONS` to match this phase's contract (sharing panel label and the Phase 4A test updated accordingly).

## 4. Evidence lifecycle

Governance transitions (`status-definitions.md` §11), enforced by an explicit transition map:

```
DRAFT ──submit──▶ SUBMITTED ──startReview──▶ UNDER_REVIEW ──approve──▶ APPROVED ──archive──▶ ARCHIVED
                                                   └────reject────▶ REJECTED ──archive──▶ ARCHIVED
```

- `submit` needs `evidence.upload` and is limited to the uploader or an internal in-scope user.
- `startReview` / `approve` / `reject` / `archive` need `evidence.approve`.
- Approval stamps `approvedById`/`approvedAt`; review stamps `reviewedById`/`reviewedAt`; archive stamps `archivedAt`/`archivedById`.
- Archive is **soft** — records are never hard-deleted. Any other transition throws `INVALID_TRANSITION`.
- `fileProcessingStatus` starts at `UPLOADED` and remains system-driven; the extraction states (`PROCESSING`, `EXTRACTION_READY`, `PROCESSING_FAILED`) are owned by the Phase 5B pipeline and are intentionally not advanced here. Extraction success never implies approval.

## 5. Evidence readiness rules

```
evidenceReadinessPct = round( APPROVED evidence ÷ tracked evidence × 100 )
tracked = evidence linked to the solution whose reviewStatus ∉ { ARCHIVED, REJECTED }
```

Recomputed inside the same transaction as every lifecycle change and persisted to `InnovationSolution.evidenceReadinessPct`. Zero evidence → 0%.

**This is evidence readiness only.** The UI labels it **"جاهزية الأدلة فقط"** and states explicitly that it is *not* compliance readiness, *not* DGA readiness, and *not* an estimated readiness score.

## 6. Evidence linking

Reuses `EvidenceLink` with the whitelisted `LinkedEntityType`. Supported targets: `COMPLIANCE_REQUIREMENT`, `INNOVATION_SOLUTION`, `STRATEGIC_OBJECTIVE`, `INNOVATION_ACTIVITY`, `IMPACT_MEASUREMENT`, plus an optional `requirementId` mapping. Target existence is application-validated (no polymorphic FK), duplicates are blocked by the unique constraint, and the owning-solution link cannot be removed.

> The requested "ImpactIndicator" target is not in the approved `LinkedEntityType` whitelist; `IMPACT_MEASUREMENT` is the available impact target and was used instead (no schema redesign).

## 7. Timeline

Read-only, derived from the append-only `AuditLog` (`entityType = EVIDENCE`) — uploads, submissions, review starts, approvals, rejections, archives, links/unlinks, with actor and timestamp. No separate history model.

## 8. Migration

One additive migration: `20260723101704_evidence_audit_entity_type` adds `EVIDENCE` to the `LinkedEntityType` enum so evidence audit rows are properly typed and queryable. No table or column changes.

**Field mapping (no new columns):** `Evidence` has no `description` column, so the description is stored in `notes` — documented, consistent with earlier phases.

## 9. Tests

`tests/evidence.test.ts` — **37 integration tests** against a disposable PostgreSQL DB: upload/metadata/type/size validation (5), lifecycle incl. invalid transitions (6), scope and role enforcement (5), partner restrictions incl. missing action, expired and revoked shares (6), viewer published-only reads (3), linking incl. duplicates and bad references (4), readiness math and denominator rules (2), registry search/filter/archived (4), timeline and audit (2). **Full suite: 192 passing.**

## 10. Limitations

- **Binary file retention is not implemented.** The upload reads the real file server-side to derive its true `sizeBytes` and a SHA-256 `checksum`, validates type and the 25 MB ceiling, and persists metadata — but the bytes are not stored and `storagePath` stays null, because no storage provider has been chosen (an open Phase 0 decision: S3-compatible vs UploadThing vs local disk). There is therefore **no download**. This was deferred deliberately rather than committing to an unreviewed storage architecture.
- Archiving requires `evidence.approve`; an uploader cannot archive their own rejected evidence without it.
- Evidence versioning (`version` column) is present but not exercised — no supersede/replace flow yet.
- Viewer visibility is derived from the solution's published projection plus `reviewStatus = APPROVED`; there is no separate per-evidence publish flag.
- Link targets are typed by the existing whitelist; adding `EVIDENCE`-to-`EVIDENCE` or agreement/meeting targets was out of scope.

## 11. Deferred to Phase 5B

- Storage provider decision + binary persistence, signed/scoped download URLs, and access-audited retrieval.
- The extraction pipeline that drives `fileProcessingStatus` (`PROCESSING` → `EXTRACTION_READY` / `PROCESSING_FAILED`).
- `DocumentAnalysis` / `AnalysisSuggestion` population, confidence, source references, and the human accept/edit/reject review surface — AI output must stay separate from official data until a human approves.
- Compliance scoring, compliance files, and impact workflows remain out of scope for 5B as well.
