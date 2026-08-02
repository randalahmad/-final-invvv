# Codex Takeover Package

Concise, sufficient handoff for Codex to continue the **Enterprise Innovation Management Platform** (KACARE) after Phase 6. Pair this with `docs/handoffs/current-project-state.md` (full state) — read both first.

---

## A. Repository state
- **Branch:** `refactor/nextjs-innovation-platform` (base branch is `main`).
- **Latest commit at takeover:** the `docs: prepare Codex project takeover` commit (this package). Immediately prior Phase 6 tip: `4988a52`.
- **Tag:** `mvp-phase6-complete` marks the takeover point.
- **Untracked:** `.claude/` (local tooling only).
- **Must NOT be committed:** `.claude/`, `.env`, `.env.local` (gitignored), any real secret, any local DB dump.
- **Remotes:** `fork` → `github.com/Layan-Alghymah/innov` (branch's configured upstream); `origin` → `github.com/randalahmad/innov`. This branch tracks and is pushed to **`fork`**.
- **Deployment status:** **Not deployed.** No CI/CD, managed PostgreSQL, object storage, backups, or monitoring yet.

## B. Completed modules (all under `src/`)
- **Identity & authentication** — `auth.ts`, `auth.config.ts`, `middleware.ts`, `modules/auth/`, `modules/registration/` (self-register → PENDING → admin approve/reject; login gated on APPROVED + ACTIVE; Auth.js v5 credentials + JWT, Entra-ID-ready).
- **Authorization & scopes** — `server/authorization/` (permission, scope, resource-share, field-level, immutability) + `server/authz.ts` + `server/access-context.ts`.
- **Ideas, evaluations, decisions, Kanban** — `modules/ideas/` (create/draft/submit/withdraw/archive, initial/technical evaluation, more-info requests, finalized decisions, supersede/reopen, convert-to-solution) + governance board.
- **Solutions registry & lifecycle** — `modules/solutions/` (CRUD/completeness, record/implementation/maturity transitions, publish/unpublish, real dashboard stats).
- **Partner sharing** — `modules/solutions/sharing-service.ts` (grant/update/revoke shares, allow-listed actions + fields, participating orgs).
- **Evidence management** — `modules/evidence/` (upload, review lifecycle, linking, timeline, approval-rate, versioned replacement).
- **S3-compatible binary storage** — `server/storage/` (S3/R2/MinIO provider + in-memory adapter; server-built opaque keys; signed-URL download).
- **Document extraction & analysis** — `modules/document-analysis/` (local pdf-parse/mammoth/exceljs extractor + heuristic provider behind abstractions; human-in-the-loop suggestion review). LLM provider **not** selected (KACARE data-residency gate).
- **Compliance readiness engine** — `modules/compliance/` (pure `scoring.ts`/`rules.ts` core; per-solution file, governed N/A, versioned config, CSV export; internal-only). See `docs/architecture/phase-6-compliance-engine.md`.

## C. Critical invariants (never break)
1. **Server-side authorization only** — guards run in services/actions/routes; UI hiding is never the control.
2. **Deny-by-default scope filtering** — reads go through `*ScopeWhere`/`requireScope`; no grant ⇒ no rows.
3. **Extraction success never implies approval** — the analysis pipeline never touches `Evidence.reviewStatus`.
4. **AI output never modifies official approved records autonomously** — suggestions are separate; a human confirms; accepting a suggestion never sets `reviewStatus=APPROVED`.
5. **Only APPROVED evidence counts toward compliance** — AI confidence is excluded from readiness.
6. **Readiness is internal/estimated, never official DGA** — labelled "مؤشر جاهزية تقديري (داخلي)" everywhere.
7. **Finalized decisions and verified measurements are immutable** — change only via supersede/reopen (audited).
8. **No hard deletion of governed records** — archive (soft) only.
9. **Every mutation is audited** — `writeAudit` inside the same transaction as the change.

## D. Known issues, ordered by priority

**Quick trust/integrity fixes**
1. Replace the **fabricated dashboard "(DGA)" readiness** (`app/(app)/dashboard/page.tsx` + `modules/dashboard/mock.ts`) with a real internal **estimated** aggregate from `modules/compliance/service.ts`; relabel; drop the fake delta. *(HIGH — violates invariant C6.)*
2. Make **decision reopen/supersede atomic** — `modules/ideas/decision-service.ts` runs the immutability guard in its own tx, then a separate `idea.update` outside it. Thread one transaction. *(MEDIUM.)*
3. **Fix immutability audit entity references** — `server/authorization/immutability.ts` writes audits with no `entityType` and `entityId = decisionId/measurementId` (orphaned from the idea/measurement timeline). *(MEDIUM.)*
4. **Add server-side authorization to `listUsersByRegistration`** (`modules/admin/users/service.ts`) — currently relies only on the page guard; returns PII. *(MEDIUM.)*
5. **Add durable login & registration rate limiting** (`modules/auth/actions.ts`, `modules/registration/service.ts`) — brute-force/enumeration/DoS. *(HIGH.)*

**MVP breadth** (models exist + seeded; no service/UI)
6. **Strategic direction** module — list/create objectives + link (§2.2a).
7. **Innovation activities** module — list/create activities + link (§2.2a).
8. **Impact measurement** module — indicators + record/verify measurements + surface (§2.2a; honor verified-measurement immutability).
9. **Partners/agreements** operational UI (`CooperationAgreement`/`AgreementMeeting`).
10. **Real alerts** + remaining dashboard aggregates (replace `modules/alerts/mock.ts`, `modules/dashboard/mock.ts`; §2.8/§2.9).

**Consistency/performance**
11. **Unify service/action error conventions** — some services throw typed errors, registration/admin return `{ok:false}`. Pick throw + a shared mapper.
12. **Remove duplicated action & scope utilities** — per-action `MSG` maps + `if(!ctx)` boilerplate; duplicated `listOwnableDepartments`; repeated band/bucket thresholds.
13. **Add optimistic concurrency** — draft edits and `upsertRequirementConfig` are last-write-wins (config version bumps but doesn't guard).
14. **Batch/cache compliance & scope queries** — `listComplianceOverview` is O(N) file computations; `getActiveShareSolutionIds` refetched multiple times per request.

**Production hardening**
15. **Malware scanning** of uploaded binaries (upload path in `modules/evidence/service.ts`).
16. **E2E and route-handler tests** — no coverage for sharing, admin state, lifecycle publish, conversion-failure, or the download/compliance-export route handlers; no E2E.
17. **Dependency remediation** — Next.js line advisories; `next-auth` is a beta.
18. **CI/CD, managed PostgreSQL, object storage, backups, monitoring, deployment.**

## E. Recommended Codex execution order
- **Sprint 1 — Integrity and Trust:** items 1–5.
- **Sprint 2 — MVP Breadth:** items 6–10.
- **Sprint 3 — Consistency and Performance:** items 11–14.
- **Sprint 4 — Production Hardening and Deployment:** items 15–18.

## F. First files Codex must read
1. `docs/handoffs/current-project-state.md`
2. `docs/handoffs/codex-takeover.md`
3. `docs/compliance-rules.md`
4. `docs/authorization.md`
5. `docs/roles-and-permissions.md`
6. `docs/architecture/phase-6-compliance-engine.md`
7. `prisma/schema.prisma`
8. `package.json`

## G. Restore commands (Windows PowerShell)
Verified local setup. Uses a disposable PostgreSQL 16 container **`innov-postgres` on host port 5433** (Docker Desktop must be running). Do **not** commit any of these values.

```powershell
# 1) Disposable PostgreSQL 16
docker run --name innov-postgres -e POSTGRES_USER=innov -e POSTGRES_PASSWORD=innov -e POSTGRES_DB=innovation -p 5433:5432 -d postgres:16-alpine

# 2) Point tooling at it (gitignored .env.local recommended for `npm run dev`)
$env:DATABASE_URL = "postgresql://innov:innov@localhost:5433/innovation?schema=public"
$env:STORAGE_DRIVER = "memory"

# 3) Install, generate, migrate, seed
npm install
npx prisma generate
npx prisma migrate deploy
npm run db:seed        # NODE_ENV != production seeds admin/editor/partner/viewer demo users

# 4) Run the app
npm run dev            # http://localhost:3000
```
Seeded dev logins: `admin@innovation.local` / `Admin@12345`; `editor|partner|viewer@innovation.local` / `Demo@12345`.

## H. Quality commands
`DATABASE_URL` must point at the running DB (tests use a disposable PostgreSQL).
```powershell
npm test               # vitest — 272 passing at takeover
npm run lint           # clean
npm run typecheck      # clean
npm run build          # 22 routes
```

## I. Acceptance criteria for the next sprint (Sprint 1 — Integrity and Trust)
- Dashboard shows a **real, scope-filtered internal estimated** readiness (computed from `modules/compliance`), correctly labelled, with **no "(DGA)"** wording and no fabricated deltas.
- Decision reopen/supersede performs the guard write **and** the idea-status update in **one transaction** (add a test for the failure path).
- Immutability-path audit rows carry the correct `entityType` + parent `entityId` and are discoverable from the idea/measurement timeline.
- `listUsersByRegistration` enforces `user.manage` **inside the service**.
- Login and registration are **rate-limited** with a durable store, with lockout audited; a test demonstrates throttling.
- All quality gates stay green: `npm test` (≥ 272), `npm run lint`, `npm run typecheck`, `npm run build`.
- **No invariant in §C regressed.**
