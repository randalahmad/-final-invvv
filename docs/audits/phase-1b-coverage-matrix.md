# Phase 1B — Coverage Matrix (machine-readable)

Concise requirement-by-requirement matrix backing `phase-1b-foundation-audit.md`.
Scoring baseline: IMPLEMENTED=100 · PARTIALLY_IMPLEMENTED=50 · STUB=20 · MOCK_ONLY=15 · MISSING=0 · CONFLICTS_WITH_BLUEPRINT=0.
Audit is read-only; no code/schema/migration/config was changed.

| # | Requirement | Blueprint ref | Classification | Coverage % | Repository evidence | Gap | Recommended phase |
|---|---|---|---|---|---|---|---|
| 1 | Self-registration (Editor/Partner/Viewer) | mvp-scope §2.1; roles §2 | MISSING | 0 | `modules/auth/actions.ts` (login/logout only) | No register action/page | Sprint A (auth) |
| 2 | Registration PENDING status | data-dict §12.1; status §1 | MISSING | 0 | No field in `schema.prisma User` | Add `registrationStatus` | Sprint A |
| 3 | Admin approval / rejection flow | mvp-scope §2.1; status §1 | MISSING | 0 | No `users` module | Build approve/reject | Sprint A |
| 4 | Block SYSTEM_ADMIN self-registration | roles §2 | MISSING | 0 | Not implemented (vacuously safe) | Enforce on register/assign | Sprint A |
| 5 | Credentials login | mvp-scope §2.1 | IMPLEMENTED | 100 | `auth.ts:24-46` bcrypt.compare | — | Done |
| 6 | Password hashing | authorization §2 | IMPLEMENTED | 100 | `seed.ts:81`; `auth.ts:37` | — | Done |
| 7 | Session → principal resolver | authorization §6 L1 | IMPLEMENTED | 100 | `authz.ts:26 getAccessContext` | — | Done |
| 8 | Route protection | authorization §6 L0 | IMPLEMENTED | 100 | `middleware.ts`; `(app)/layout.tsx requireUser` | — | Done |
| 9 | Logout | — | IMPLEMENTED | 100 | `actions.ts:36` | — | Done |
| 10 | Entra-ID readiness | mvp-scope §3 | IMPLEMENTED | 100 | Prisma adapter `auth.ts:21`; edge split; env placeholders | — | Done |
| 11 | Inactive/suspended enforcement | status §2 | PARTIALLY | 50 | `auth.ts:35`; `authz.ts:38` | Middleware no re-check; no revocation | Sprint A |
| 12 | Users management module | modules P1 | MISSING | 0 | none | Build | Sprint A |
| 13 | Permission catalogue | roles §6 | IMPLEMENTED | 100 | `modules/auth/permissions.ts` | — | Done |
| 14 | Role→permission seed | roles §7 | IMPLEMENTED | 100 | `seed.ts:29-46` | — | Done |
| 15 | `requirePermission` guard adopted | authorization §6 L2 | PARTIALLY | 50 | `authz.ts:61` exists, unused | Wire into handlers | Sprint A/B |
| 16 | Scope-filtered reads (L3) | authorization §6 L3 | MISSING | 0 | No scope filter in code | Build scope builder | Sprint A |
| 17 | Write-time scope containment | authorization §6 L3 | MISSING | 0 | none | Build | Sprint A |
| 18 | Partner share (allowedFields/Actions) | authorization §5; roles §4 | MISSING | 0 | No model/logic | Model + enforce | Evidence/Partners phase |
| 19 | Field-level partner restriction | roles §4.3 | MISSING | 0 | none | Build | Partners phase |
| 20 | Viewer PUBLISHED restriction | roles §5 | MISSING | 0 | `PUBLISHED` scope unused | Build published projections | Reporting phase |
| 21 | Immutability guard (L5) | authorization §6 L5; status §13 | MISSING | 0 | No finalized-record protection | Guard + fields | Sprint B |
| 22 | Audit on mutations (L4) | mvp-scope §2.10 | MISSING | 0 | No `auditLog.create` | Audit writer | Sprint A/B |
| 23 | Identity/RBAC/Org models | data-dict §1–2 | IMPLEMENTED | 100 | `schema.prisma:236-412` | User missing reg fields (row 2) | Done |
| 24 | Strategy + Activity models | data-dict §3–4 | IMPLEMENTED | 100 | `schema.prisma:418-461` | — | Done |
| 25 | Governance models (Idea/Eval/Decision) | data-dict §5 | PARTIALLY | 50 | `schema.prisma:467-513` | Idea statuses + decision immutability | Sprint A/B |
| 26 | Solution + SolutionOrg models | data-dict §6 | IMPLEMENTED | 100 | `schema.prisma:519-569` | — | Done |
| 27 | Impact models | data-dict §7 | PARTIALLY | 50 | `schema.prisma:575-610` | Measurement immutability fields | Sprint A |
| 28 | Partner/Agreement/Meeting models | data-dict §8 | IMPLEMENTED | 100 | `schema.prisma:616-655` | — | Done |
| 29 | Evidence model (status split) | data-dict §10; status §10-12 | CONFLICTS_WITH_BLUEPRINT | 0 | `schema.prisma:180,687` single `EvidenceStatus` | Split into two fields (replacing migration) | Evidence phase |
| 30 | EvidenceLink model | data-dict §10 | IMPLEMENTED | 100 | `schema.prisma:712` | — | Done |
| 31 | DocumentAnalysis model | data-dict §12.4; doc-analysis §4 | MISSING | 0 | none | Add model | AI phase |
| 32 | AnalysisSuggestion model | data-dict §12.4; doc-analysis §4 | MISSING | 0 | none | Add model | AI phase |
| 33 | ComplianceRequirement scoring config | compliance §1; data-dict §9 | PARTIALLY | 50 | `schema.prisma:661` generic Json only | Weights/gates/allowNA + Zod | Compliance phase |
| 34 | ComplianceNA model | compliance §4; data-dict §12.5 | MISSING | 0 | none | Add governed-N/A model | Compliance phase |
| 35 | Alert/Notification/AuditLog models | data-dict §11 | IMPLEMENTED | 100 | `schema.prisma:731-780` | AuditLog never written (row 22) | Done (schema) |
| 36 | Strategy module UI/CRUD | mvp-scope §2.2a; modules P2 | STUB | 20 | `strategy/page.tsx` placeholder | Build CRUD | Sprint B/C |
| 37 | Activities module UI/CRUD | mvp-scope §2.2a | STUB | 20 | `activities/page.tsx` placeholder | Build CRUD | Sprint B/C |
| 38 | Governance workflow (persisted) | mvp-scope §2.3 | MOCK_ONLY | 15 | `kanban-board.tsx:85` local state | Persist + audit + actor rules | Sprint B |
| 39 | Solutions registry CRUD | mvp-scope §2.4 | MOCK_ONLY | 15 | `solutions/page.tsx` + `solutionsMock` | Real queries + forms | Sprint B |
| 40 | Impact indicators/measurements UI | mvp-scope §2.2a §5.24.2 | STUB | 20 | `impact/page.tsx` placeholder | Build | Sprint C |
| 41 | Evidence upload + storage | mvp-scope §2.5 | MISSING | 0 | No storage lib in `package.json` | Storage adapter + upload | Evidence phase |
| 42 | Evidence manual mapping + approval | mvp-scope §2.5 | MISSING | 0 | none | Build; `evidence.approve` gate | Evidence phase |
| 43 | Document-analysis pipeline | mvp-scope §2.6; doc-analysis | MISSING | 0 | No extraction libs/pipeline | Build async pipeline | AI phase |
| 44 | AI human-review UI | doc-analysis §6 | MISSING | 0 | none | Build accept/edit/reject | AI phase |
| 45 | Compliance readiness engine | compliance §2 | MISSING | 0 | Hard-coded % in mock/pages | Build computed engine | Compliance phase |
| 46 | On-screen compliance file | compliance §9; mvp-scope §2.7 | STUB | 20 | `compliance/page.tsx` placeholder | Build | Compliance phase |
| 47 | Print/basic export report | mvp-scope §2.7 | MISSING | 0 | none | Build print/CSV | Compliance phase |
| 48 | Dashboard (readiness/counts) | mvp-scope §2.8 | MOCK_ONLY | 15 | `dashboard/page.tsx` + mock | Real aggregates | Reporting phase |
| 49 | Alerts center | mvp-scope §2.9 | MOCK_ONLY | 15 | `alerts/page.tsx` + `alertsMock` | Rule engine + persistence | from P2 |
| 50 | Audit trail (viewer + writes) | mvp-scope §2.10 | MISSING | 0 | No writes; no viewer | Build | Sprint A/B |
| 51 | Global RTL + Arabic font | mvp-scope §2.11 | IMPLEMENTED | 100 | `app/layout.tsx:24` lang=ar dir=rtl | — | Done |
| 52 | App shell (sidebar/topbar/nav) | Phase 1A | IMPLEMENTED | 100 | `components/layout/*`; `config/navigation.ts` | — | Done |
| 53 | UI primitives (shadcn set) | Phase 1A | IMPLEMENTED | 100 | `components/ui/*` (12 files) | — | Done |
| 54 | Loading/error/not-found | Phase 1A | IMPLEMENTED | 100 | `app/loading.tsx`,`error.tsx`,`not-found.tsx` | — | Done |
| 55 | Solution detail view (prototype) | UI/prototype | MISSING | 0 | No `/solutions/[id]` route | Port from prototype `1d605f9` | Sprint B |
| 56 | Quality gates (lint/typecheck/build) | mvp-scope §2.11 | IMPLEMENTED | 100 | All pass this audit (§ commands) | — | Done |

## Rollup

- Rows: 56. Sum of baseline scores: **2290 / 5600 = 41%** (blended structural+functional).
- **Functional coverage** (behavioral rows only): **790 / 3600 ≈ 22% → reported ~20%**.
- **MVP vertical-slice completion**: **0 / 13 steps = 0%** (first broken step: #1 registration).
- **Structural coverage**: **~57%** (component estimates in the report §3).
- **Security-adjusted readiness**: **~12%** (report §14).

## Classification tallies

| Classification | Count | Rows |
|---|---|---|
| IMPLEMENTED | 19 | 5,6,7,8,9,10,13,14,23,24,26,28,30,35,51,52,53,54,56 |
| PARTIALLY_IMPLEMENTED | 5 | 11,15,25,27,33 |
| STUB | 4 | 36,37,40,46 |
| MOCK_ONLY | 4 | 38,39,48,49 |
| MISSING | 23 | 1,2,3,4,12,16,17,18,19,20,21,22,31,32,34,41,42,43,44,45,47,50,55 |
| CONFLICTS_WITH_BLUEPRINT | 1 | 29 |
