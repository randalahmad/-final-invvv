# MVP Blueprint — منصة إدارة الابتكار المؤسسي

Enterprise Innovation Management Platform for **King Abdullah City for Atomic and Renewable Energy (KACARE)**.
Central principle: **the compliance standard becomes the platform's data model.**

This folder is the complete, implementation-ready blueprint produced **before** coding. It is documentation only — no application code, schema, or migrations are created in this phase.

## Documents
1. [`mvp-scope.md`](./mvp-scope.md) — in/out/future scope, success criteria, assumptions, risks.
2. [`roles-and-permissions.md`](./roles-and-permissions.md) — roles, allowed/forbidden actions, role×permission matrix, scopes.
3. [`user-journeys.md`](./user-journeys.md) — registration, login, approval, idea/solution/evidence/analysis/compliance flows (Mermaid).
4. [`data-dictionary.md`](./data-dictionary.md) — every entity, fields, relationships, ownership, validation, and required schema deltas.
5. [`status-definitions.md`](./status-definitions.md) — every status value and transition.
6. [`compliance-rules.md`](./compliance-rules.md) — configurable readiness engine, formula, human-approval gates.
7. [`document-analysis.md`](./document-analysis.md) — bounded, human-in-the-loop AI analysis (PDF/DOCX/XLSX).
8. [`authorization.md`](./authorization.md) — RBAC + data scope + server-side enforcement.
9. [`modules.md`](./modules.md) — modules, phases, dependencies.
10. [`technical-decisions.md`](./technical-decisions.md) — stack rationale, alternatives, risks.

## Operational Documents (post-build)
Added after the implementation phase described above. These reflect the platform as actually built, not the pre-coding plan.
11. [`database-freeze.md`](./database-freeze.md) — the frozen schema design for the seven built modules (new tables, enums, indexes, and why each exists).
12. [`architecture.md`](./architecture.md) — how the codebase is actually organized (modules, request flow, module boundaries).
13. [`modules.md`](./modules.md) — updated module-by-module build status.
14. [`permissions.md`](./permissions.md) — the full, current permission catalogue and role defaults, including everything added after `roles-and-permissions.md` was first written.
15. [`audit-events.md`](./audit-events.md) — every `AuditLog` action key and what it records.
16. [`api.md`](./api.md) — the Server Actions surface and the two real HTTP API routes.
17. [`deployment.md`](./deployment.md) — the runbook for applying the frozen migration and first run.
18. [`test-plan.md`](./test-plan.md) — the full post-migration test plan.
19. [`changelog.md`](./changelog.md) — chronological record of what was built, in what order, and why.

---

# Final deliverables

## 1. Final MVP summary
The MVP delivers a single, fully-working governance thread — **register → admin approve → submit idea → evaluate → approve → convert to solution → upload evidence → AI-assisted analysis → human-approved mapping → live compliance readiness → dashboard & compliance file update** — on a Modular-Monolith Next.js/TypeScript/PostgreSQL/Prisma stack, with server-enforced RBAC + data scope, a configurable (data-driven) compliance engine, and a bounded human-in-the-loop AI assistant that may suggest but never decide. The MVP includes an on-screen compliance file plus a print-friendly/basic export; everything outside that thread (SSO, email, bundled ZIP export packages, deep analytics, partner portal) is deliberately deferred.

## 2. Assumptions (consolidated — require confirmation)
1. **Single owning organization for the MVP, with multiple internal departments, external organizations, partner records, and strictly scoped external access** — organizations kept clearly separated for future expansion, without a full SaaS multi-tenant platform.
2. Small pilot user volume; Node self-hosting acceptable (no serverless scaling need).
3. Credentials auth for pilot; Entra ID later as a provider addition.
4. Evidence files modest (≤ ~25 MB); one storage adapter.
5. Initial DGA requirement content derived from the product presentation, not the authoritative DGA document.
6. Compliance scoring is **configurable per requirement** (requirement/field/evidence weights, mandatory gates, optional criteria, `allowNA`); the result is an **internal estimated score** until DGA methodology is confirmed. **No fixed 50/50.** Only `APPROVED` evidence counts.
7. **N/A is a governed, audited exception** (reason + authorized user + approval); absence of a record is a gap by default.
8. **Finalized governance records are immutable** (correction/superseding/reopening only, all audited).
9. **Viewers see only published dashboards/reports + explicitly authorized read-only records** — not raw ideas/evidence/agreements/compliance detail.
10. **File-processing, evidence-review, and AI-analysis are three separate statuses**; extraction success never implies approval.
11. AI analysis is imperfect and async; manual mapping always available; a human is always the final authority.
12. Arabic-only UI for MVP (no English/i18n requirement yet).
13. Extraction should stay self-hostable where feasible; any external AI model needs data-residency sign-off.

## 3. Open questions (must be answered before/at start of relevant phase)
1. **DGA source of truth:** who provides the authoritative 5.23/5.24 requirement text, required fields, and evidence types, and in what format?
2. **Readiness weighting:** does KACARE accept equal weights + 50/50, or are per-requirement weights mandatory for MVP?
3. **AI model & data residency:** may evidence content be processed by an external model, or must extraction be fully on-prem/self-hosted?
4. **Evidence storage:** local disk (self-host) vs. S3-compatible/UploadThing — and retention/security requirements for sensitive documents?
5. **Deployment target:** self-hosted Node/Docker on KACARE infrastructure, or a managed host? (affects DB pooling + AI hosting)
6. **Registration approval routing:** all approvals to any System Admin, or department-scoped approvers?
7. **"Published" definition:** what exactly is a Viewer allowed to see (which dashboards/reports become "published")?
8. **Partner sharing model:** is per-record `UserRole(SOLUTION/AGREEMENT)` sharing sufficient, or is a separate share/invitation flow required?
9. **Scanned documents:** is OCR needed within MVP, or is manual mapping acceptable for scanned PDFs?
10. **Idea status granularity:** keep the finer schema stages (`INITIAL_REVIEW`/`TECHNICAL_REVIEW`) or collapse to `UNDER_REVIEW`? (Now retained, with `DRAFT`/`WITHDRAWN` added.)
11. **N/A approver policy:** must the N/A requester and approver differ, and who is the authorized approver?
12. **Immutability reopening authority:** who may perform a documented reopening of a finalized decision / verified impact?
13. **Basic export format:** is a print-friendly view + CSV sufficient for the MVP compliance file, or is a simple PDF required?

## 4. Risks (top, consolidated)
| # | Risk | Mitigation |
|---|---|---|
| R1 | Low AI accuracy on Arabic/scanned docs erodes trust | Confidence thresholds, mandatory human approval, manual fallback, OCR later |
| R2 | Readiness formula gives false assurance | Transparent per-field breakdown, versioned configurable rules, documented assumptions, KACARE sign-off |
| R3 | Data-scope enforcement gaps → cross-department/partner leakage | Central server-side scope guard, deny-by-default, API-level tests |
| R4 | Scope creep toward a full innovation suite | Explicit out-of-scope list; success = the one journey |
| R5 | Schema deltas (AI analysis, registration status) surface mid-build | Documented in `data-dictionary.md` §12; additive migrations sequenced by phase |
| R6 | Sensitive evidence handling | Scope-checked downloads, checksums, no public storage, audit on access, residency sign-off |
| R7 | Arabic RTL regressions in tables/charts/dnd | RTL checklist + wrappers; verified in shell |

## 5. Recommended implementation order
Foundation (**auth → users → organizations**) → Core, **all five DGA modules** (**strategy + activities + governance → solutions → impact**) → **evidence** → **document-analysis** → **compliance** → **reports**, with **alerts/audit** wired from Phase 1 and **partners** in P3. Authorization primitives (`src/server/`) are built once in Phase 1 and reused everywhere. See `modules.md`.

## 6. Recommended sprint plan (2-week sprints, indicative)
| Sprint | Goal | Key outputs |
|---|---|---|
| **S1** | Foundation & auth | Apply schema deltas (registration status; idea `DRAFT`/`WITHDRAWN`; evidence status split; immutability fields); credentials login; registration→PENDING; middleware route protection; principal resolver + `requirePermission` + scope-filter in `src/server/`; audit + immutability guards |
| **S2** | Users, orgs, scope | Admin approval/reject + role+scope assignment; organizations/departments/memberships; **partner share model (allowedFields/allowedActions)**; **published/Viewer scope**; scope-filtered reads proven via API tests |
| **S3** | Governance + strategy + activities | Ideas (incl. `DRAFT`/`WITHDRAWN`) + evaluations + decisions (immutable finalized) + persisted Kanban with actor rules; **`StrategicObjective`** + **`InnovationActivity`** CRUD; convert-to-solution |
| **S4** | Solutions + impact | Registry, ownership, strategic alignment, completeness %; **`ImpactIndicator` + `ImpactMeasurement`** (baseline/target/actual + verification, immutable when verified); incomplete-solution alerts |
| **S5** | Evidence | Upload + polymorphic `EvidenceLink` + manual mapping + approve (`reviewStatus`); scope-checked download; readiness input hook |
| **S6** | Document analysis (AI) | `DocumentAnalysis`/`AnalysisSuggestion` with full traceability; async extract/classify PDF/DOCX/structured-XLSX; review UI with confidence + sourceRef; human-approve (extraction ≠ approval) |
| **S7** | Compliance engine | Configurable requirements CRUD (weights/gates/optional/`allowNA`); governed `ComplianceNA`; weighted readiness + gap reports; **on-screen compliance file + print-friendly/basic export**; deep links; "estimated" labelling |
| **S8** | Reports + hardening | Dashboards (readiness/counts/trends); audit view; end-to-end journey demo; RTL/a11y/security pass (incl. partner field-level + immutability tests); `install/lint/build` green |

(Partners/agreements/meetings slot into S3–S5 as capacity allows; ZIP export package + email remain future scope.)

## 7. Decisions required before coding starts
1. Confirm **assumptions** (§2) and answer **open questions** (§3) — especially DGA source (Q1), readiness weighting/gates (Q2), AI/data-residency (Q3), N/A + reopening authority (Q11–Q12).
2. Approve the **schema deltas** in `data-dictionary.md` §12 (registration status; idea `DRAFT`/`WITHDRAWN`; **evidence status split**; `DocumentAnalysis`/`AnalysisSuggestion` with traceability; compliance scoring config + `ComplianceNA`; immutability fields).
3. Confirm the **compliance scoring assumptions** in `compliance-rules.md` §10 (estimated label, configurable weights/gates, N/A governance).
4. Confirm **deployment target** + **evidence storage** + **AI hosting** (affects infra tickets in S1/S6).
5. Sign off this blueprint as the build contract; changes after sign-off go through change control to protect the MVP boundary.
