# Phase 5B — AI Document Analysis Pipeline

A bounded, human-in-the-loop assistant that reads an uploaded evidence file and **suggests** field values and a compliance-requirement mapping. It accelerates evidence mapping and never governs. Built on Phase 5A/5A.1 evidence + storage and the Phase 2C authorization layer. No compliance scoring, compliance files, or impact workflows.

Module: `src/modules/document-analysis/`. Uses the existing `DocumentAnalysis` / `AnalysisSuggestion` models — **no migration**.

---

## 1. The two abstractions

The pipeline is built around two independent seams so the deferred provider decision is a config choice, not a rewrite:

### `DocumentExtractor` (`extractor/`)
Turns raw bytes into `{ text, tables[], meta }`. **Extraction always runs locally/server-side** — it is *not* the deferred decision.
- `LocalDocumentExtractor` (default): `pdf-parse` (PDF), `mammoth` (DOCX), `exceljs` (XLSX), dynamically imported so they never reach the client/edge bundle. Detects `needsOCR` (scanned PDF) and `unsupportedStructure` (irregular XLSX) and routes them to manual mapping.
- Registry: `getDocumentExtractor()` / `setDocumentExtractor()` (test hook).

### `AnalysisProvider` (`provider/`)
Turns an extraction + context into `{ documentType?, suggestions[] }`. **This is the seam where the self-hosted-vs-external decision lives.**
- `HeuristicAnalysisProvider` (default): rule-based, deterministic, **offline** — classifies by keywords, suggests title/classification, recommends a requirement mapping by code/keyword match, and (for XLSX) proposes candidate impact rows. Sends nothing to third parties, so it is safe pending the decision and lets tests run without credentials.
- Registry: `getAnalysisProvider()` / `setAnalysisProvider()`. An LLM-backed provider slots in here (e.g. via `ANALYSIS_PROVIDER`) with **no pipeline change**. Per `document-analysis.md` §8, an external provider must not process real institutional documents without KACARE data-residency sign-off.

A provider **only ever proposes** — it cannot approve evidence, mutate official records, or affect readiness.

## 2. Three independent statuses

The pipeline moves three statuses that never conflate (`status-definitions.md` §10–12):

| Status | Field | Movement |
|---|---|---|
| Technical | `Evidence.fileProcessingStatus` | `UPLOADED → PROCESSING → EXTRACTION_READY \| PROCESSING_FAILED` |
| AI job | `DocumentAnalysis.status` | `QUEUED → PROCESSING → COMPLETED \| FAILED` |
| Governance | `Evidence.reviewStatus` | untouched by the pipeline |

**Invariant, enforced and tested: extraction success never implies approval.** `EXTRACTION_READY` / `COMPLETED` mean only that suggestions are ready for a human; `reviewStatus` reaches `APPROVED` solely through the human `evidence.approve` action.

## 3. Pipeline flow

1. **Upload** (Phase 5A) enqueues a `DocumentAnalysis` row (`QUEUED`) for supported formats, inside the upload transaction, attributed to the uploader (`ANALYSIS_QUEUED`).
2. **`runEvidenceAnalysis`** (on demand): sets `fp=PROCESSING` / `an=PROCESSING`, stamps provenance (`provider`, `model`, `extractorVersion`, `promptVersion`), fetches bytes via `getStorage().get(storagePath)`, extracts, analyses against active compliance requirements, then in one transaction **replaces** prior suggestions, persists new ones, sets `fp=EXTRACTION_READY` / `an=COMPLETED` (`ANALYSIS_STARTED` → `ANALYSIS_COMPLETED`).
3. **Failure** (extraction/analysis error): `fp=PROCESSING_FAILED`, `an=FAILED` + reason, `reviewStatus` unchanged, manual mapping remains available (`ANALYSIS_FAILED`).

The "queue" is realised as an on-demand run action (the blueprint permits this); the UI shows `DocumentAnalysis.status` and a run/retry button.

## 4. Human-in-the-loop review

`reviewSuggestion(actor, suggestionId, { outcome, editedValue? })` — the only thing that turns a suggestion into anything official, and even then **it never approves the evidence**:
- **REQUIREMENT_MAP** accept/edit → creates the `EvidenceLink` to the requirement (idempotent) — the sanctioned human mapping (`EVIDENCE_LINKED`).
- **FIELD** accept/edit → applies to the **evidence-owned** field only (`classification` / `title`); other field keys record the outcome without mutating any official record.
- **IMPACT_ROW** accept → records the outcome; creating `ImpactMeasurement` rows belongs to the impact workflow (out of scope).
- Every review stamps `reviewOutcome` + `reviewedById` + `reviewedAt` (+ `reviewedValue` on edit) and audits (`SUGGESTION_ACCEPTED` / `EDITED` / `REJECTED`).

`acceptHighConfidence` bulk-accepts **only** pending suggestions with confidence ≥ 0.85; medium/low items require individual action. Confidence bands: HIGH ≥ 0.85, MEDIUM 0.7–0.85, LOW < 0.7 (`confidenceBand`).

## 5. Authorization

Analysis and suggestion review are **internal actions**: the caller must reach the solution through department/organization/platform scope (`requireInternalEvidence`) — never merely a partner share or the published projection.
- Read (`getEvidenceAnalysis`): `evidence.view` + scope + internal.
- Run / review / bulk-accept: `evidence.upload` (mapping-level) + scope + internal, **and the evidence must not be APPROVED or ARCHIVED**.
- Partners → `EVIDENCE_LOCKED` (not internal); viewers → `FORBIDDEN`; cross-department → `OUT_OF_SCOPE`. The details page simply shows no analysis panel to a non-internal reader.

**Invariant, enforced and tested: AI output never mutates approved records.** Running analysis or reviewing suggestions on an `APPROVED`/`ARCHIVED` evidence item is rejected (`EVIDENCE_LOCKED`).

## 6. Traceability

Per `document-analysis.md` §4A, every analysis records provider/model/extractorVersion/promptVersion + timestamps + `extractedTextMeta`; every suggestion records confidence, per-format source refs (`sourcePage`/`sourceSection`/`sourceCell`/`sourceExcerpt`), and the reviewer + outcome (+ edited value). AI suggestions live in their own table, so the official record is only ever written on human acceptance, with a full "what the AI said, from where, with what confidence, and what the human did" trail.

## 7. UI

`AnalysisPanel` on the evidence details page (`/solutions/[id]/evidence/[evidenceId]`): status + provenance, a run/retry button, "accept all high-confidence", and a per-suggestion review row (kind, confidence band, source ref, accept / edit / reject; edit box for FIELD suggestions). A prominent Arabic note states the invariant: *الاقتراحات مساعِدة فقط ولا تُعتمد تلقائيًا. نجاح الاستخراج لا يعني اعتماد الدليل*.

## 8. Error handling & fallbacks

| Failure | Behaviour |
|---|---|
| Unsupported/oversized/corrupt file | Rejected at upload (Phase 5A), before analysis |
| Extraction/classification error | `an=FAILED` + reason, `fp=PROCESSING_FAILED`, manual mapping offered, `reviewStatus` unaffected |
| Scanned PDF (no text) | `needsOCR` flagged; low/zero suggestions; manual mapping; OCR is future scope |
| Unsupported XLSX structure | `unsupportedStructure` flagged; manual mapping |
| Provider/service unavailable | Run fails cleanly; retry allowed; manual mapping always available |

## 9. Tests

`tests/document-analysis.test.ts` — **23 tests** against a disposable PostgreSQL DB with injected fakes (extractor + in-memory storage) so no external services or credentials are needed: enqueue-on-upload, the full run, the extraction-success-≠-approval invariant, provenance stamping, failure handling, re-run replacement, authorization (viewer/cross-department/partner/APPROVED-locked), suggestion review (requirement-link creation, field application, edit, reject), the never-approves invariant, bulk high-confidence acceptance, confidence bands, `formatFromMime`, and **two real `LocalDocumentExtractor` XLSX round-trips** (structured + numeric-only header). **Full suite: 239 passing.**

## 10. Environment variables

None required for the default (local extraction + heuristic provider). When the provider decision lands, an `ANALYSIS_PROVIDER` (+ any model/endpoint/key vars) will be added at the provider registry — documented then.

## 11. Limitations

- Extraction is text-layer only: **OCR for scanned PDFs is out of scope** (flagged `needsOCR`).
- XLSX handles a single structured header block; complex/merged/macro/protected workbooks are flagged `unsupportedStructure`.
- The run is on-demand/synchronous within the action (no separate worker/queue infrastructure); large files could exceed a serverless function budget — a background worker is future work.
- The default `HeuristicAnalysisProvider` is intentionally simple (keyword rules); an LLM provider will materially improve suggestion quality once the data-residency decision is made.
- IMPACT_ROW acceptance records the outcome only; turning rows into `ImpactMeasurement` records is the impact workflow (future).
- No re-analysis is auto-triggered on file replacement — the reviewer re-runs analysis explicitly.

## 12. Deferred / next

- The **provider decision** (self-hosted vs external LLM) and the concrete `AnalysisProvider` behind it.
- OCR; async worker/queue; impact-row → `ImpactMeasurement` conversion; the compliance readiness engine (which will consume approved evidence + confirmed mappings).
