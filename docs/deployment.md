# Deployment Runbook — Database Integration & First Run

**Scope of this document:** operational steps only. No schema, migration, or application code is touched by this document or by following it. Run these steps locally, on your machine, where a real `DATABASE_URL` pointing at Neon is available.

Prerequisite: `.env` (or `.env.local`) contains a valid `DATABASE_URL` for your Neon database, and the frozen migration `prisma/migrations/20260731140000_challenges_committees_strategy_documents/` is present and unmodified.

---

## 1. Commands, in order

```bash
# 1. Apply the frozen migration to Neon
npm run db:deploy          # = npx prisma migrate deploy

# 2. Regenerate the Prisma Client against the new schema
npm run db:generate        # = npx prisma generate

# 3. Seed permissions, roles, and role-permission links
npm run db:seed            # = tsx prisma/seed.ts

# 4. Start the app
npm run dev                # = next dev
```

Run them one at a time, in this exact order, and confirm success (§2) before moving to the next. Do not run `npm run db:push` or `npm run db:migrate` (dev) instead of `db:deploy` — those are for local schema iteration, not for applying a frozen, reviewed migration to a real database.

---

## 2. How to confirm each step succeeded

### Step 1 — `prisma migrate deploy`
**Success looks like:**
```
Applying migration `20260731140000_challenges_committees_strategy_documents`
The following migration(s) have been applied:
migrations/
  └─ 20260731140000_challenges_committees_strategy_documents/
    └─ migration.sql

All migrations have been successfully applied.
```
**Verify independently** (don't just trust the log):
```bash
npx prisma migrate status
```
should report "Database schema is up to date!" with the migration listed as applied. You can also open `npx prisma studio` and confirm the new tables exist: `challenges`, `challenge_solutions`, `committees`, `committee_members`, `committee_meetings`, `compliance_requirement_assignments`, `strategy_documents`.

### Step 2 — `prisma generate`
**Success looks like:** ends with `✔ Generated Prisma Client ... in XXXms`, no errors.
**Verify independently:**
```bash
npm run typecheck
```
**This is the decisive check.** Every TypeScript error this project currently has (documented at length in prior sessions) traces to one root cause: the Prisma Client wasn't generated against the real schema in the sandbox this project was developed in. After a real `prisma generate` here, **`npm run typecheck` must report 0 errors.** If it doesn't, that's a real bug — see §4.

### Step 3 — `prisma db seed`
**Success looks like:** the seed script's own console output completes without throwing, ending with its normal exit.
**Verify independently** — this is the specific check you asked about (Permissions/Roles/RolePermissions):
```bash
npx prisma studio
```
Open, in order:
1. **`Role`** table → 4 rows: `SYSTEM_ADMIN`, `INTERNAL_EDITOR`, `EXTERNAL_PARTNER`, `VIEWER`.
2. **`Permission`** table → one row per permission key defined in `src/modules/auth/permissions.ts` `PERMISSIONS` object (count them: `grep -c '": "' src/modules/auth/permissions.ts` gives a rough figure — every key should have a matching row).
3. **`RolePermission`** table → cross-reference against `DEFAULT_ROLE_PERMISSIONS` in the same file. `SYSTEM_ADMIN` should have a row for **every** permission (it maps to `all`). `INTERNAL_EDITOR` should have rows only for the permissions explicitly listed in its array (e.g. `strategy.objective.view` present, `strategy.objective.manage` **absent** — that's correct, it's a per-user grant, not a role default).
4. Log in as a `SYSTEM_ADMIN` test account once the app is running (§1 step 4) and confirm you can reach `/admin/users`, `/audit`, and `/governance/committees/new` without a FORBIDDEN error — this is the practical proof the seed worked.

### Step 4 — `npm run dev`
**Success looks like:** `✓ Ready in XXXXms` with no red error block, and `http://localhost:3000` (or whatever port it prints) loads the login/dashboard.

---

## 3. If a step fails

| Step | If it fails | What to do |
|---|---|---|
| `migrate deploy` | Command exits non-zero, or reports a migration error | **Do not retry blindly and do not run `migrate reset`** (that would drop data). Read the exact error (see §4 for the specific ones likely here), fix only what the error identifies, and re-run `npx prisma migrate status` to confirm the failed migration didn't get marked as partially applied. If it did, you may need `npx prisma migrate resolve` — read the Prisma docs for that command before running it; it changes migration bookkeeping, not your schema. |
| `generate` | Fails to download engines / network error | Check your machine's network access to `binaries.prisma.sh` (unrelated to Neon — this is Prisma's own engine CDN). This is very likely the same block that prevented me from running these commands in the earlier sandbox sessions — if you're also behind a restrictive proxy/firewall, this is why. |
| `db seed` | Script throws | Read the stack trace — it will point at the exact `prisma.X.create(...)` call that failed. Since the seed script (`prisma/seed.ts`) was not touched this session, a failure here most likely means step 1 didn't fully apply (re-check `migrate status` first) rather than a seed script bug. |
| `npm run dev` | Fails to start, or starts but pages 500 | Check the terminal output first — Next.js prints the actual server-side error and file/line. Cross-reference against §4. If it's a page you don't recognize from `docs/test-plan.md`, note it — it may be a genuine new bug requiring the "found a Bug" protocol we agreed on. |

**General rule for this whole runbook:** if a step fails, stop, read the actual error text, and only take the specific action that error calls for. Don't skip ahead, and don't run any destructive command (`reset`, `push` with data-loss warnings accepted, manual `DROP`/`DELETE`) to "just get past it."

---

## 4. Expected Prisma error patterns and how to read them

These are anticipated based on this project's own history (documented in `docs/database-freeze.md` and this session's design discussions) — not guesses.

| Error text (or shape) | What it means here | What to do |
|---|---|---|
| `P3009: migrate found failed migrations in the target database` | An earlier partial apply attempt exists | Check `npx prisma migrate status` for which migration is marked failed, resolve per Prisma's own guidance for that specific migration — do not reset the whole database |
| `55P04: unsafe use of new value of enum type` | Postgres forbids using a newly `ALTER TYPE ... ADD VALUE`'d value in the *same transaction* it was added in | This project's own migration history already hit this once (see `prisma/migrations/20260722130001_ideas_status_default_draft/migration.sql` and its header comment) — the frozen migration for this integration was specifically checked to **not** trip this (no new enum value is used as a `DEFAULT` or in any `INSERT`/`UPDATE` in the same file). If you see this error anyway, it means the migration file was modified after the freeze — compare it against `docs/database-freeze.md` before doing anything else |
| `P2021: table does not exist` (at runtime, in the app, not during migrate) | The app is running against Prisma Client types that expect a table `migrate deploy` hasn't actually created yet | Re-run `npx prisma migrate status` — deploy likely didn't fully succeed even if it looked like it did |
| `Module '"@prisma/client"' has no exported member 'X'` (TypeScript) | Prisma Client wasn't regenerated after the migration, or `generate` failed silently | Re-run `npm run db:generate` and re-check `npm run typecheck` |
| `Unique constraint failed on the fields: (...)` on `compliance_requirement_assignments` or `strategy_documents` | You're trying to create a second **active** assignment/document for the same pair — this is the partial unique index working as designed (`WHERE archivedAt IS NULL`), not a bug | Archive the existing active one first (this is exactly `F-STR-08`/`F-STR-10`/`F-STR-12` in `docs/test-plan.md`) |
| `FOREIGN KEY constraint` error referencing `compliance_requirement_assignments`/`departments`/`organizations` | A referenced row (department, organization, compliance requirement) doesn't exist yet | Seed/create the referenced record first — this is a data-ordering issue, not a schema bug |
| App shows **FORBIDDEN** on a page you expect to access | Not a Prisma error — your test account's role doesn't have the needed permission | Check the exact permission key the page requires against `docs/data-dictionary.md` / `src/modules/auth/permissions.ts`, and confirm via Prisma Studio (§2 step 3.3) that your account's `UserRole` → `RolePermission` chain actually grants it |

---

## 5. First Smoke Tests to run immediately after `npm run dev` succeeds

Do these five, in order, before opening `docs/test-plan.md` at all — they're the fastest way to catch a broken deploy/generate/seed before investing time in the full plan:

1. Open the app root and log in as your `SYSTEM_ADMIN` test account.
2. Open `/dashboard` — confirm it loads with no error screen.
3. Open `/strategy` — confirm the objectives list loads (empty is fine; a crash is not).
4. Open `/governance/committees` — confirm it loads. **This is the single best canary for the whole migration**, since `Committee` is a brand-new table with no legacy data path — if this page works, the new tables exist and Prisma Client knows about them.
5. Open `/admin/users` and `/audit` — confirm both load and show real data (users list, and at least the audit entries generated by your own actions in steps 1-4).

If all five pass, the deploy/generate/seed cycle worked. If any one fails, stop and diagnose that specific failure via §3/§4 before running anything else.

---

## 6. Order for executing `docs/test-plan.md`

Run the five sections in this order — each builds on data/state created by the previous one, so running them out of order will produce false failures (missing prerequisites), not real bugs:

1. **Smoke Tests (§1 of test-plan.md)** — confirms every route loads at all. Do this first and fully; if a route fails here, every Functional/Integration test that depends on it will fail for the same reason, so there's no point running them yet.
2. **Functional Tests (§2 of test-plan.md)**, in this sub-order:
   1. الأفكار → 2. الحلول والأدلة (`F-SOL-*`, `F-EVD-01..04`) → 3. التخطيط الاستراتيجي (`F-STR-*`) → 4. المنهجيات الابتكارية (`F-ACT-*`, `F-EVD-05/06`) → 5. حوكمة الابتكار (`F-COM-*`) → 6. إدارة التحديات (`F-CHL-*`) → 7. الأدلة/الوثائق المتبقية (`F-EVD-07..09`) → 8. ملف الامتثال (`F-CMP-*`) → 9. المستخدمون (`F-USR-*`) → 10. التنبيهات (`F-ALT-*`) → 11. التقارير (`F-RPT-*`) → 12. سجل التدقيق (`F-AUD-*`).
      Reason for this order: Strategy/Activities/Committees/Challenges tests create the department, objective, committee, and challenge records that the later Compliance and Reports counters (`F-CMP-*`, `F-RPT-*`) need to show non-zero, meaningful numbers. Running Compliance/Reports tests first will "pass" trivially on empty data and hide real bugs.
3. **Permission Tests (§3)** — run *after* Functional Tests, using the real records those tests created, so scope-isolation checks (`P-02`, `P-09`) have actual cross-department/cross-partner data to verify isolation against.
4. **Integration Tests (§4)** — run last among the positive-path suites; they re-use everything above end-to-end. Pay special attention to `INT-09`, which is *expected to fail* (documents the alert-automation gap) — do not "fix" anything to make it pass.
5. **Regression Tests (§5)** — run at the very end, as a final confirmation sweep, ideally on a second pass after a short break, to catch anything the first pass's momentum might have glossed over.

Log every failure with: test ID, exact error/screenshot, and the account/role used — that's what turns a test-plan run into an actionable bug report under the "found a Bug" protocol already agreed for this project.
