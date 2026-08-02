# Phase 1B — Foundation Audit Against the Approved Phase 0 Blueprint

**Audit type:** Read-only. No application code, schema, migration, dependency, or configuration was modified. No commits were made.
**Date:** 2026-07-22
**Branch:** `refactor/nextjs-innovation-platform`
**Reference commit (foundation):** `6911feb` (chore hygiene) on top of `7a7992b` (Phase 0 docs)
**Blueprint authority:** `docs/` (Phase 0), treated as the MVP contract.

> **Scoring baseline used throughout:** IMPLEMENTED=100, PARTIALLY_IMPLEMENTED=50, STUB=20, MOCK_ONLY=15, MISSING=0, CONFLICTS_WITH_BLUEPRINT=0. "IMPLEMENTED" requires real persistence **and** server-side enforcement — a page that merely renders is never IMPLEMENTED.

---

## 1. Executive summary

The repository is a **clean, well-structured Next.js 14 App Router shell** with an excellent technical foundation (RTL, Arabic typography, modular-monolith folders, UI primitives, quality gates all green) and a **complete, blueprint-aligned Prisma schema for the "static" half of the domain**. It is, however, a **prototype-oriented shell, not a working product**: every business screen renders **hard-coded mock data**, no domain entity is wired to persistence, and the **entire MVP journey (register → approve → idea → … → compliance) is unimplemented**.

The three most consequential gaps:

1. **The MVP journey does not start.** There is no self-registration (`src/modules/auth/actions.ts` contains only `loginAction`/`logoutAction`) and no `registrationStatus` on `User`. **Step 1 of the one journey that defines the MVP is missing**, and every subsequent step with it.
2. **The authorization spine is half-built.** The RBAC primitive exists (`src/server/authz.ts`: `getAccessContext`, `requirePermission`) but the **critical data-scope layer (Layer 3) and immutability layer (Layer 5) from `authorization.md` are entirely absent** — no scope-filtered queries, no per-record containment, no partner share model, no audit writes. Not currently exploitable (there is no real data behind the guards), but it is the single largest build-before-data risk.
3. **Compliance readiness is faked.** Dashboard/registry/governance show **hard-coded percentages** (`overallReadinessPct = 82`, `readinessCriteria`, `"68%"`, `"70%"`) labelled **"DGA"** — directly contradicting `compliance-rules.md` (readiness must be computed from approved evidence and labelled "estimated/internal").

Nothing Manara-related remains. The schema deltas the blueprint itself flagged (registration status, Evidence status split, `DocumentAnalysis`/`AnalysisSuggestion`, `ComplianceNA`, immutability fields) are **documented but not yet applied** — consistent with `data-dictionary.md` §12, which explicitly defers them.

## 2. Overall readiness

| Dimension | Score | One-line meaning |
|---|---|---|
| **Structural coverage** | **~57%** | Scaffolding, schema, shell and primitives largely exist and match the blueprint shape. |
| **Functional coverage** | **~20%** | Only login/logout, route protection, and seed persistence work end-to-end. |
| **MVP vertical-slice completion** | **0%** | No journey step persists; the first step (registration) is missing. |
| **Security-adjusted readiness** | **~12%** | Functional value discounted for absent audit logging, absent scope enforcement, no rate limiting, and open dependency advisories. |

## 3. Method used to calculate the percentages

1. Every MVP requirement in the Phase 0 docs was enumerated into a matrix of **56 requirement rows** (see `phase-1b-coverage-matrix.md`).
2. Each row was classified by direct code inspection (file + symbol evidence) and given the **baseline score** for its classification.
3. **Functional coverage** = mean baseline score over the **behavioral** rows (identity flows, authz enforcement, module workflows, evidence/AI/compliance behavior, dashboard-live, audit writes, solution detail) — the rows where IMPLEMENTED strictly means "persists + enforces". Computed: **790 / 3600 ≈ 22%**, reported as **~20%**. Auth *mechanics* (login/session/logout/route-guard) are the only large functional wins and account for almost all of it.
4. **MVP vertical-slice completion** is scored separately and literally: of the 13 journey steps in `mvp-scope.md` §1, **0** persist → **0%**.
5. **Structural coverage** = presence/shape of the scaffolding (models, types, folders, pages, primitives, shell, tooling) regardless of whether behavior is wired. Component estimates: repo/shell/RTL/primitives/quality ≈ 95%; DB schema ≈ 69%; auth scaffold ≈ 70%; authorization scaffold ≈ 30%; module scaffolds ≈ 50%. Blended ≈ **57%**.
6. **Security-adjusted readiness** = functional coverage discounted for security posture (§14): no audit logging despite the model, no data-scope enforcement layer (fails `mvp-scope.md` success criterion #2), no login rate limiting, and 4 high / 2 moderate `npm audit` advisories → **~12%**.

These are transparent estimates derived from the classification matrix, not measurements; the matrix rows are the auditable unit.

---

## 4. Architecture findings

**Strengths**
- **App Router structure is clean and correct.** Route group `src/app/(app)/*` for the authenticated shell; `src/app/login`, `error.tsx`, `loading.tsx`, `not-found.tsx`, `api/auth/[...nextauth]/route.ts` all present. One root layout (`src/app/layout.tsx`), one global stylesheet (`globals.css`), one public dir.
- **Server/Client split is disciplined.** Only 10 `"use client"` files (the interactive leaves: `login-form`, `kanban-board`, `error`, UI primitives). Pages and the app layout are Server Components; `src/app/(app)/layout.tsx` calls `requireUser()` on the server.
- **Edge-safe auth split is correct.** `auth.config.ts` (no Prisma/bcrypt) is consumed by `middleware.ts`; the Node-only instance lives in `auth.ts`. This is the right shape for Entra-ID readiness.
- **Modular-monolith boundaries exist** (`src/modules/*`), and shared server primitives are centralized in `src/server/` per `authorization.md` §8.
- **Single source of truth for permissions** in `src/modules/auth/permissions.ts`, consumed by both the seed and `authz.ts`.

**Conflicts**
- **Prototype-oriented, not production-oriented.** Business pages import from `*/mock.ts` (`solutionsMock`, `alertsMock`, `readinessCriteria`). No page reads Prisma except the auth path.
- **`authz.ts` implements RBAC but not scope.** `authorization.md` §6 mandates a scope-filter query builder (Layer 3) and an immutability guard (Layer 5). Neither exists. `hasPlatformScope()` is defined but unused.

**Technical debt**
- `requirePermission` and `can()` exist but are **called nowhere** — dead until modules use them.
- `prisma/migrations/` is **untracked** in Git (see §15/§17) — the schema is committed but its migration is not, a deploy-time drift hazard.
- `next.config.mjs` is bare (`reactStrictMode` only) — acceptable now; image/security headers will be needed later.

**Recommended architectural corrections (do not implement in this phase)**
1. Build the **scope-filter builder** + **write-time scope containment** in `src/server/` before any module ships real queries.
2. Add the **immutability guard** and **`AuditLog` writer** as server primitives, consumed by every mutation.
3. Replace `*/mock.ts` imports with scoped Prisma queries module-by-module; keep mock files only as typed fixtures for tests.
4. Track `prisma/migrations/` (after review) so `migrate deploy` has something to apply.

---

## 5. Database coverage matrix

Structural coverage of the schema (`prisma/schema.prisma`) vs `data-dictionary.md` / `status-definitions.md`. **Schema structural coverage ≈ 69%** (2150 / 3100 over 31 required entities/fields).

| Entity (blueprint) | Current model | Class | Score | Gap / evidence |
|---|---|---|---|---|
| User | `User` | PARTIALLY | 50 | Missing `registrationStatus (PENDING/APPROVED/REJECTED)`, `approvedById/At` (delta #1). `schema.prisma:236`. |
| Registration/approval state | — | MISSING | 0 | No enum/field anywhere. Blocks the MVP journey. |
| Role | `Role` | IMPLEMENTED | 100 | `schema.prisma:268`. |
| Permission | `Permission` | IMPLEMENTED | 100 | `schema.prisma:284`. |
| RolePermission | `RolePermission` | IMPLEMENTED | 100 | Composite PK. |
| UserRole (scoped) | `UserRole` | IMPLEMENTED | 100 | `scopeType/scopeId`, unique. `schema.prisma:306`. |
| Organization | `Organization` | IMPLEMENTED | 100 | `schema.prisma:364`. |
| Department | `Department` | IMPLEMENTED | 100 | `schema.prisma:381`. |
| UserMembership | `UserMembership` | IMPLEMENTED | 100 | `schema.prisma:400`. |
| Data scope | `ScopeType` enum + UserRole | IMPLEMENTED | 100 | Model present; **enforcement absent** (see §7). |
| StrategicObjective | `StrategicObjective` | IMPLEMENTED | 100 | `schema.prisma:418`. |
| InnovationActivity | `InnovationActivity` | IMPLEMENTED | 100 | `schema.prisma:443`. |
| Idea | `Idea` | PARTIALLY | 50 | `IdeaStatus` missing `DRAFT`, `WITHDRAWN` (delta #2). `schema.prisma:77`. |
| IdeaEvaluation | `IdeaEvaluation` | IMPLEMENTED | 100 | `schema.prisma:488`. |
| IdeaDecision | `IdeaDecision` | PARTIALLY | 50 | Missing immutability fields `supersedesId/correctionOf/reopenedFromId/finalizedAt` (delta #6). |
| InnovationSolution | `InnovationSolution` | IMPLEMENTED | 100 | Rich; `schema.prisma:519`. |
| SolutionOrganization | `SolutionOrganization` | IMPLEMENTED | 100 | Composite PK. |
| ImpactIndicator | `ImpactIndicator` | IMPLEMENTED | 100 | `schema.prisma:575`. |
| ImpactMeasurement | `ImpactMeasurement` | PARTIALLY | 50 | Missing `supersedesId/verifiedAt/reopenReason` (delta #6). |
| Partner org | `Organization` (type) | IMPLEMENTED | 100 | By design, no separate table. |
| CooperationAgreement | `CooperationAgreement` | IMPLEMENTED | 100 | `schema.prisma:616`. |
| AgreementMeeting | `AgreementMeeting` | IMPLEMENTED | 100 | `schema.prisma:640`. |
| **Partner share** (allowedFields/Actions) | — | MISSING | 0 | Required by `authorization.md` §5; no model. |
| Evidence | `Evidence` | **CONFLICTS** | 0 | Still a single `EvidenceStatus` enum; must be split into `fileProcessingStatus` + `reviewStatus` (delta #3). `schema.prisma:180,687`. |
| EvidenceLink | `EvidenceLink` | IMPLEMENTED | 100 | Polymorphic, unique. `schema.prisma:712`. |
| File-processing status | — | MISSING | 0 | No `fileProcessingStatus` field. |
| Evidence-review status | — | MISSING | 0 | No `reviewStatus` field (conflated into `status`). |
| DocumentAnalysis | — | MISSING | 0 | Delta #4; no model. |
| AnalysisSuggestion | — | MISSING | 0 | Delta #4; no model. |
| ComplianceRequirement | `ComplianceRequirement` | PARTIALLY | 50 | Has generic `requiredFields/requiredEvidenceTypes` Json but **no weight/gate/`allowNA`/`gateCeiling`/`sectionWeight` structure** and no Zod validation (delta #5). `schema.prisma:661`. |
| ComplianceNA | — | MISSING | 0 | Delta #5; no governed-N/A model. |
| Alert | `Alert` | IMPLEMENTED | 100 | `schema.prisma:731`. |
| Notification | `Notification` | IMPLEMENTED | 100 | `schema.prisma:752`. |
| AuditLog | `AuditLog` | IMPLEMENTED* | 100 | Model present & append-only by convention, but **nothing writes to it** (functional 0). `schema.prisma:766`. |

**Migration risk:** the deltas are additive/backward-compatible **except the Evidence status split (#3)**, which replaces a column and requires a data migration. `prisma/migrations/20260722005753_init/migration.sql` matches the current schema exactly (no drift), but is **untracked**.

## 6. Authentication coverage matrix

Inspected `auth.ts`, `auth.config.ts`, `middleware.ts`, `modules/auth/*`, `server/authz.ts`, `prisma/seed.ts`.

| Item | Class | Score | Evidence |
|---|---|---|---|
| Credentials auth | IMPLEMENTED | 100 | `auth.ts:24` Credentials provider; `bcrypt.compare` at `auth.ts:37`. |
| Password hashing | IMPLEMENTED | 100 | `bcrypt.hash(...,10)` seed `seed.ts:81`; compare on login. |
| User lookup | IMPLEMENTED | 100 | `prisma.user.findUnique({where:{email}})` `auth.ts:34`. |
| Session strategy | IMPLEMENTED | 100 | JWT `auth.ts:22`; `jwt/session` callbacks `auth.config.ts:33`. |
| Session payload | IMPLEMENTED | 100 | `uid` only; permissions resolved server-side via `getAccessContext`. `types/next-auth.d.ts`. |
| Registration | **MISSING** | 0 | No `registerAction`; `actions.ts` has only login/logout. |
| PENDING approval status | **MISSING** | 0 | No `registrationStatus`; login gates on `status==='ACTIVE'` only (`auth.ts:35`). |
| Admin approval flow | **MISSING** | 0 | No `users` module UI/action. |
| Rejection flow | **MISSING** | 0 | Same. |
| Prevent public SYSTEM_ADMIN registration | MISSING (unbuilt) | 0 | Vacuously safe (no registration exists), but the control is not implemented. |
| Inactive/suspended enforcement | PARTIALLY | 50 | Blocked at login (`auth.ts:35`) and in `getAccessContext` (`authz.ts:38`); **middleware does not re-check**, and there is no session revocation — a live JWT survives suspension until expiry (server pages re-block via `requireUser`). |
| Logout | IMPLEMENTED | 100 | `logoutAction` `actions.ts:36`. |
| Protected routes | IMPLEMENTED | 100 | `middleware.ts` + `authorized` callback + `requireUser()` in app layout. |
| Protected route handlers | PARTIALLY | 50 | Only the NextAuth handler exists; `requirePermission` is defined but used by no handler. |
| Error handling | IMPLEMENTED | 100 | Login error states; `error.tsx` special-cases `FORBIDDEN`. |
| Secrets / env | IMPLEMENTED | 100 | `AUTH_SECRET` via env; `.env` untracked; `.env.example` documents keys. |
| Entra-ID readiness | IMPLEMENTED | 100 | Prisma adapter wired `auth.ts:21`; edge-safe config split; Entra env placeholders in `.env.example`. |

**Verdict:** login/session/logout/route-protection are genuinely solid; the **registration + approval half of the auth blueprint is entirely absent**, which is what breaks the MVP journey at step 1.

## 7. Authorization coverage matrix

Inspected against `roles-and-permissions.md` + `authorization.md`. **Structural ≈ 30%, functional ≈ 10%.**

| Layer (authorization.md) | Client | Server | Query-scoped | Class | Evidence |
|---|---|---|---|---|---|
| L0 Route protection | — | ✅ | n/a | IMPLEMENTED | `middleware.ts`, `authorized` callback. |
| L1 Session→principal | — | ✅ | n/a | IMPLEMENTED | `getAccessContext` `authz.ts:26`. |
| L2 Permission guard | — | ⚠️ exists, unused | n/a | PARTIALLY | `requirePermission` `authz.ts:61` — called by no module. |
| L3 **Scope-filtered reads/writes** | — | ❌ | ❌ | **MISSING** | No scope-filter builder; no `owningDepartmentId IN (...)` anywhere. |
| L3 Per-record write containment | — | ❌ | ❌ | **MISSING** | No load-record-then-check logic. |
| Partner share (allowedFields/Actions) | — | ❌ | ❌ | **MISSING** | No share model or field/action allow-list. |
| Viewer PUBLISHED restriction | — | ❌ | ❌ | **MISSING** | `PUBLISHED` scope unused; a Viewer would see the same mock as everyone. |
| L4 Audit on mutations | — | ❌ | n/a | **MISSING** | No `auditLog.create` calls. |
| L5 Immutability guard | — | ❌ | n/a | **MISSING** | No finalized-record protection; no `finalizedAt`/`verifiedAt` fields. |

**Code-inspection answers to the mandated probes** (all currently *vacuous* because pages render one global mock with no data layer — but each will be a live breach the moment real queries land without L3/L5):
- *Internal Editor reads another department's data?* No scope filter exists → **would leak** once queries are real. Today: everyone sees identical mock.
- *External Partner reads unrelated agreement/solution?* No share/scope model → **no protection**.
- *External Partner modifies restricted official fields?* No write path and no allow-list → **would be unprotected**.
- *Viewer reads unpublished records?* No published/scope distinction → **would leak**.
- *Bypass UI via direct route/action call?* Only `loginAction`/`logoutAction` exist; both are safe. No business actions to bypass **yet**.
- *Finalized decision silently overwritten?* No decision write path and no immutability guard → **would be unprotected**.
- *Verified impact silently overwritten?* Same.

**IDOR risk:** none exploitable today (no id-addressed data routes). **HIGH latent risk** the moment evidence/solution/agreement routes are added without L3.

## 8. Core-module coverage matrix

| # | Module (DGA) | Models | Page | Persist | Workflow | Class | Score |
|---|---|---|---|---|---|---|---|
| 5.23.1 | Strategic Direction | ✅ `StrategicObjective` | `strategy/page.tsx` = `ModulePlaceholder` | ❌ | ❌ | STUB | 20 |
| 5.23.2 | Activities | ✅ `InnovationActivity` | `activities/page.tsx` = placeholder | ❌ | ❌ | STUB | 20 |
| 5.23.3 | Governance | ✅ Idea/Eval/Decision | Kanban with mock; **drag = local `useState` only** (`kanban-board.tsx:85`) | ❌ | ❌ | MOCK_ONLY | 15 |
| 5.24.1 | Solutions Registry | ✅ `InnovationSolution` | `SolutionsTable` over `solutionsMock`; no create/edit | ❌ | ❌ | MOCK_ONLY | 15 |
| 5.24.2 | Impact | ✅ Indicator/Measurement | `impact/page.tsx` = placeholder | ❌ | ❌ | STUB | 20 |

Every module fails the "usable workflow" test: no forms, no validation beyond `loginSchema`, no server actions, no status transitions, no evidence links, no audit, no scope. Empty/loading states exist generically (`loading.tsx`, Kanban empty text); error state is global. Mock data is preserved from the Vite prototype and clearly labelled as such in the files.

## 9. MVP vertical-slice trace

`mvp-scope.md` §1 journey, traced through code. **First broken step: Step 1 (Registration).** All subsequent steps are also unbuilt.

| # | Step | Entry point | Behavior | Persist | Authz | Class |
|---|---|---|---|---|---|---|
| 0 | Login (pre-req) | `login/page.tsx` → `loginAction` | Works | ✅ (reads User) | session | IMPLEMENTED |
| 1 | **Register** | — | **none** | ❌ | — | **MISSING ← first break** |
| 2 | Admin approval | — | none | ❌ | — | MISSING |
| 3 | Idea submission | Kanban (mock) | visual only | ❌ | — | MISSING |
| 4 | Evaluation | — | none | ❌ | — | MISSING |
| 5 | Decision | — | none | ❌ | — | MISSING |
| 6 | Convert→Solution | — | none | ❌ | — | MISSING |
| 7 | Upload evidence | — | no upload UI/route/storage | ❌ | — | MISSING |
| 8 | Analyze file (AI) | — | no pipeline/model | ❌ | — | MISSING |
| 9 | Review suggestions | — | none | ❌ | — | MISSING |
| 10 | Approve mapping | — | none | ❌ | — | MISSING |
| 11 | Readiness updates | dashboard/mock | hard-coded % | ❌ | — | MOCK_ONLY / CONFLICTS |
| 12 | Dashboard updates | `dashboard/page.tsx` | static mock | ❌ | — | MOCK_ONLY |
| 13 | Compliance file updates | `compliance/page.tsx` | placeholder | ❌ | — | STUB |

**Blocking dependency chain:** Step 1 blocks 2; Steps 3–6 need governance persistence + scope; Step 7 needs a storage adapter (none declared); Step 8 needs `DocumentAnalysis`/extraction libs (none); Step 11 needs the readiness engine (none). **Journey completion = 0%.**

## 10. File / evidence findings

- **Upload UI / route / action:** MISSING. No upload component, no route handler, no server action.
- **Storage provider:** **NONE** — `package.json` declares no S3/UploadThing/multer/formidable. Uploaded files are **not stored, not even simulated**; the capability does not exist.
- **Validation / size / type config:** MISSING.
- **Metadata persistence:** `Evidence`/`EvidenceLink` models exist (`storagePath`, `checksum`, `version` columns) but are never written.
- **Signed/private access, download authz:** MISSING.
- **Versioning / checksums:** columns exist; no code computes or checks them.
- **File-processing status / review status:** MISSING (single `EvidenceStatus` enum — see §5 CONFLICT).
- **Human approval:** MISSING (`evidence.approve` permission defined but unused).
- **Audit trail / deletion-archive / dangerous-file handling:** MISSING.

## 11. Document-analysis findings

Entirely **MISSING**. No `DocumentAnalysis`/`AnalysisSuggestion` models, no extraction libraries (no `pdf-parse`/`mammoth`/`exceljs`), no async job, no classification, no confidence, no `sourceRef`, no provider/model traceability, no review UI, no accept/edit/reject, no manual-mapping fallback (nothing to fall back from).

**Can AI modify official records without human approval?** **No — vacuously**, because no AI subsystem exists. When built, the blueprint's separation (`AnalysisSuggestion` rows, human `evidence.approve`) must be honored; today there is nothing to violate it and nothing to enforce it.

## 12. Compliance-engine findings

- **Requirements in DB:** PARTIAL — `ComplianceRequirement` model + 5 seeded rows (`seed.ts:107`, codes 5.23.1–5.24.2) exist, but seeded with only `code/sectionCode/titleAr` — **no weights, gates, `allowNA`, required fields/evidence config**.
- **Versioning:** `version` column exists; no versioning logic.
- **Configurable weights / field weights / evidence weights / mandatory gates / optional criteria / `allowNA`:** **MISSING** — the scoring config from `compliance-rules.md` §1 is not modeled beyond a generic `Json` column, and no Zod validator exists.
- **`ComplianceNA` (governed N/A) + approval/audit:** MISSING.
- **Readiness calculation / gap report / deep links:** MISSING.
- **On-screen compliance file:** STUB (`compliance/page.tsx` = `ModulePlaceholder`).
- **Print-friendly / basic export:** MISSING.
- **Internal-estimate label / approved-evidence-only / AI-confidence-exclusion rules:** MISSING and **CONTRADICTED** — see below.

**Hard-coded readiness found (exactly what the audit warns against):**
- `dashboard/mock.ts`: `overallReadinessPct = 82`; `readinessCriteria` = 82/91/68/70/100.
- `governance/page.tsx:9`: `"68%"`. `solutions/page.tsx:12`: `"70%"`.
- Dashboard labels the figure **"الجاهزية الإجمالية للامتثال (DGA)"** (`dashboard/page.tsx:19`) and the nav labels compliance **"ملف الامتثال (DGA)"** — **CONFLICTS_WITH_BLUEPRINT**: `compliance-rules.md` principle #5 requires the label **"مؤشر جاهزية تقديري (داخلي) / Estimated readiness (internal)"** until DGA sign-off. No fixed 50/50 assumption was found in code (there is no engine at all), which is the one small positive.

## 13. UI / prototype findings

**Preserved from the Vite prototype (in Git history at `1d605f9`):** navigation structure + Arabic terminology (`config/navigation.ts`), dashboard layout (`dashboard/page.tsx`), alerts design (`AlertsCenter`/`AlertItem`), governance Kanban (`kanban-board.tsx`), solutions registry table (`SolutionsTable`), global RTL + IBM Plex Sans Arabic (`app/layout.tsx`), typed mock data.

**Lost / not yet ported:**
- **Solution detail view + its interaction patterns** — no `/solutions/[id]` route exists. This is the most significant lost prototype interaction.
- Any create/edit forms, registry filtering/search, and real drag-persistence.

**Quality of the shell:** RTL global ✅; typography ✅; sidebar/topbar ✅; responsive grid utilities present; accessibility partial (some `aria-label`, `role="alert"`, password-visibility toggle labelled); loading/error/not-found ✅; empty state in Kanban ✅; **all interactions are mock**. **No Manara or unrelated product concepts remain** (verified by grep — the only "Manara" string is in `docs/mvp-scope.md` documenting its removal).

## 14. Security findings by severity

> Framing: the app is mock-only, so several issues are **latent** (not exploitable today) but become live the instant real data/queries are added. They are graded on MVP impact, not current exploitability alone. No destructive testing was performed.

**HIGH**
- **H1 — No data-scope authorization layer.** `authz.ts` enforces permissions but never scope; `authorization.md` L3 and `mvp-scope.md` success-criterion #2 are unmet. The moment any module queries real data, cross-department/partner/viewer leakage and IDOR are unguarded. *(Latent; architectural.)*
- **H2 — Next.js dependency advisories.** `npm audit`: 4 high on `next@14.2.35` (DoS via image optimizer `remotePatterns`, RSC request-deserialization DoS, rewrite request-smuggling, image-cache exhaustion) + `glob` command-injection via the ESLint plugin (dev-only). Fixes require Next 16 (breaking). Some relate to features not currently used (custom `remotePatterns`).

**MEDIUM**
- **M1 — No audit logging.** `AuditLog` model exists but nothing writes to it; `mvp-scope.md` §2.10 and success-criterion #11 require audit on every approval/status-change/export. No login/logout audit either.
- **M2 — No rate limiting on credentials login.** `loginAction`/`authorize` have no throttling → brute-force exposure once deployed.
- **M3 — Moderate advisories:** `next-auth@5.0.0-beta.25` (email misdelivery) and `postcss` (<8.5.10 XSS in stringify). Beta `next-auth` is itself a supply-chain consideration for production.

**LOW**
- **L1 — Dev fallback admin password** `"Admin@12345"` when `NODE_ENV!==production` and no env (`seed.ts:76`). Acceptable (dev-only; prod path generates a random secret), but worth a lint/guard.
- **L2 — Client error logging** `console.error(error)` in `error.tsx` may surface stack details in the browser console.
- **L3 — Validation surface thin:** only `loginSchema`; fine now, but every future server action must ship Zod validation (currently there is no pattern to copy beyond login).

**Positive:** no `dangerouslySetInnerHTML`/`eval`/`new Function`; `.env` untracked; secrets via env; bcrypt with a sane cost; JWT carries only `uid`.

## 15. Deployment-readiness findings

| Target | Status | Note |
|---|---|---|
| GitHub workflow | ⚠️ | Repo ready; **no `.github/` CI** present. |
| Vercel | ⚠️ | Next 14 App Router deploys; `build` runs `prisma generate && next build` ✅; needs `DATABASE_URL` + `AUTH_SECRET`. |
| Managed PostgreSQL | ✅ (schema) | `datasource` = postgres; `db:deploy` = `prisma migrate deploy` present. |
| Object storage | ❌ | **None configured.** Evidence upload cannot work; on Vercel the serverless FS is ephemeral/read-only, so local-disk storage would fail anyway — must be S3/UploadThing (not built). |
| Environment variables | ✅ | `.env.example` documents required keys. |
| Prisma generation | ✅ | `postinstall` + `build` both run `prisma generate`. |
| Prisma migrations | ❌ **risk** | `prisma/migrations/` is **untracked** — `migrate deploy` in CI/Vercel would find no migrations → schema never applied, or drift. Must be reviewed and tracked. |
| Seed accounts | ⚠️ | Admin seed with env/random password ✅; **only admin** seeded (no Editor/Partner/Viewer example users from `roles-and-permissions.md` §9). |
| Preview deployments | ⚠️ | UI previews fine; DB-backed features need a branch database. |
| Production | ❌ | No real features, no storage, no audit; not production-viable as a product. |
| Self-hosted Docker | ❌ | No `Dockerfile`/compose. |

**Would fail/be unsafe on Vercel:** (a) any local-disk evidence storage (ephemeral FS) — not built yet, but the plan must target object storage; (b) untracked migrations → `migrate deploy` no-ops; (c) at scale, Prisma on serverless needs pooling (PgBouncer/Accelerate) — note for later; (d) the Next.js image/DoS advisories (H2) matter more for self-hosted than Vercel.

## 16. Technical debt

1. `prisma/migrations/` untracked while `schema.prisma` is committed (deploy drift).
2. `requirePermission`/`can`/`hasPlatformScope` implemented but unused (dead until modules adopt them).
3. Hard-coded readiness/labels in mock + pages mislabelled "DGA" (must become computed + "estimated/internal").
4. Only one seeded user; the four-role pilot matrix in `roles-and-permissions.md` §9 is not seeded, so RBAC/scope can't be exercised end-to-end.
5. `EvidenceStatus` enum will need a **replacing** migration (not additive) for the status split.
6. No test harness at all (no vitest/jest/playwright) — yet `authorization.md` §7 mandates API-level authorization tests as acceptance.

## 17. Contradictions with Phase 0

| Blueprint says | Code does | Severity |
|---|---|---|
| Readiness labelled "estimated/internal", computed from approved evidence (`compliance-rules.md` §5, #10) | Hard-coded % labelled **"DGA"** (`dashboard/*`, `navigation.ts`) | **CONFLICT** |
| Evidence has **two** separate fields `fileProcessingStatus` + `reviewStatus` (delta #3, `status-definitions.md` §10–12) | Single `EvidenceStatus` enum | **CONFLICT** |
| Every query scope-filtered server-side (`authorization.md` §6 L3) | No scope filtering | **CONFLICT** (latent) |
| Every mutation writes `AuditLog` (`authorization.md` L4) | No audit writes | **CONFLICT** |
| Finalized records immutable (L5, `status-definitions.md` §13) | No immutability, no `finalizedAt`/`verifiedAt` | **CONFLICT** |
| Self-register → PENDING → admin approve (`mvp-scope.md` §2.1) | No registration; login gates on `ACTIVE` only | **CONFLICT** |

Note: most of these are the very deltas `data-dictionary.md` §12 **explicitly defers** — so they are *known, documented* gaps, not surprises. The active contradiction that needs a decision now is the **"DGA" readiness labelling** on shipped pages.

## 18. Recommended correction order (do not implement in this phase)

1. **Apply the schema deltas** (`data-dictionary.md` §12): registration status on `User`; Idea `DRAFT`/`WITHDRAWN`; Evidence status split; `DocumentAnalysis`/`AnalysisSuggestion`; `ComplianceNA` + requirement scoring config; immutability fields — then generate & **track** a migration.
2. **Build the authorization spine in `src/server/`**: scope-filter builder (L3), write-time containment, immutability guard (L5), `AuditLog` writer (L4). Adopt `requirePermission` everywhere.
3. **Registration → approval** (auth + users modules): register action, PENDING gating, admin approve/reject, block SYSTEM_ADMIN self-assignment; seed the four pilot users.
4. **Governance vertical slice** on real data (idea→evaluate→decide→convert) with persisted Kanban + audit.
5. **Evidence** (storage adapter + upload + manual mapping + approve → readiness input).
6. **Compliance engine** (configurable weights/gates/`allowNA`, readiness calc, on-screen file, "estimated/internal" label) — replaces the hard-coded numbers.
7. **Document analysis** (bounded, human-in-the-loop).
8. Cross-cutting: relabel readiness immediately once the engine exists; add API-level authz tests; add CI.

## 19. Recommended sprint reordering

The build order in `modules.md` is sound. The only reordering the audit recommends: **pull the `AuditLog` writer and the scope-filter/immutability guards forward into the same sprint as the first data-backed module** (governance), rather than treating audit/scope as "wired incrementally" — because retrofitting scope onto existing queries is the classic source of the H1/IDOR risk. Concretely: Sprint A = schema deltas + `src/server/` authz spine + registration/approval + seeded pilot users; Sprint B = governance on real data (first to exercise scope+audit+immutability end-to-end); then evidence → compliance → AI as per `modules.md`.

## 20. Features that should be preserved

- The entire **technical shell**: `app/layout.tsx` RTL setup, `globals.css`, UI primitives (`components/ui/*`), `app-sidebar`/`topbar`, `loading/error/not-found`, `config/site.ts` + `config/navigation.ts`.
- The **auth mechanics**: edge-safe config split, `authz.ts` `getAccessContext`/`requirePermission`, permission catalogue `modules/auth/permissions.ts`, seed structure.
- The **Prisma schema** for all IMPLEMENTED entities (identity/RBAC/org/strategy/activity/solution/impact/partner/alert/audit).
- Mock files — **as typed fixtures for tests**, once real queries replace them in pages.

## 21. Features that should be replaced

- **All `*/mock.ts` imports inside pages** → scoped Prisma queries.
- **Hard-coded readiness numbers + "DGA" label** → computed engine output + "estimated/internal" label.
- **Single `EvidenceStatus`** → the two-field split (a replacing migration).
- **Kanban local-state drag** → server action that respects `status-definitions.md` §4 actor rules + audit.

## 22. Files that need review before modification

- `prisma/schema.prisma` — central; delta changes ripple (esp. Evidence split = replacing migration).
- `prisma/migrations/` — **untracked**; decide to track (after review) or regenerate cleanly before any `migrate deploy`.
- `src/server/authz.ts` — the authorization seam every module will consume; change carefully.
- `src/auth.ts` / `src/auth.config.ts` / `src/middleware.ts` — the edge/Node split must be preserved when adding registration/Entra.
- `prisma/seed.ts` — admin-credential handling and requirement seeding; extend, don't break the env-password logic.
- `.claude/` and `.env` — local-only; **do not commit** (per Phase 1A instructions).

## 23. Open questions

1. **"DGA" labelling** — relabel shipped pages to "estimated/internal" now (small change, but this phase is audit-only), or wait until the engine lands? (Blueprint mandates the label.)
2. **Migrations** — should `prisma/migrations/` be tracked as-is, or regenerated after the deltas so history starts clean?
3. **Storage provider** — S3-compatible vs UploadThing vs local-disk-for-dev-only? Drives the evidence sprint and Vercel viability.
4. **Document-analysis extraction path** — self-hosted/local (data residency) vs external model with KACARE sign-off? (`document-analysis.md` §8 flags this as needing approval.)
5. **Definition of "published"** for Viewer scope — still open in `roles-and-permissions.md` §5.
6. **Next.js upgrade** — accept the breaking Next 16 bump to clear H2, or mitigate individual advisories on the 14.2 line?

---

*End of Phase 1B foundation audit. No code, schema, migration, dependency, or configuration was modified; nothing was committed.*
