# Phase 2B — Identity Lifecycle Architecture

Implements the secure identity lifecycle: public registration → PENDING → admin review → APPROVED/REJECTED → login gated on APPROVED + ACTIVE. All state persists in PostgreSQL and every review/account-state action is audited. This document does not modify any Phase 0 blueprint.

**Out of scope (deferred):** data-scope enforcement, ResourceShare/field-level enforcement, immutability guards, evidence upload, document analysis, compliance scoring, business workflows.

---

## 1. Registration lifecycle

`/register` (public) → server action `registerAction` → `submitRegistration(raw)` (Zod) → `registerUser(input)`:

- Email is trimmed + lowercased (`normalizeEmail`); uniqueness enforced (pre-check + DB unique + P2002 race handling).
- Password hashed with **bcrypt (cost 10)** — the algorithm already used by the project.
- Only intake fields are whitelisted (name, email, passwordHash, requestedRoleKey, requestedOrgType, requestedOrganizationName, requestedDepartmentId, registrationNote). **No role, scope, or elevated status is mass-assignable.**
- Account is created with `registrationStatus = PENDING`, `status = INACTIVE`, and **no `UserRole`**.
- Writes `AuditLog(USER_REGISTERED)` in the same transaction.
- Public users may request only `INTERNAL_EDITOR | EXTERNAL_PARTNER | VIEWER`. `SYSTEM_ADMIN` is rejected by the Zod enum **and** defensively by `registerUser` (INVALID_ROLE) even if the Zod layer is bypassed.
- On success → redirect to `/register/submitted` (Arabic confirmation; the user is **not** logged in). States handled: loading (pending submit button, disabled to prevent double-submit), field validation errors, duplicate email, success, general error.

## 2. Authentication checks

`authenticateCredentials(email, password)` is the single server-side gate (used by the Credentials provider's `authorize`):

1. Look up user by normalized email; `INVALID_CREDENTIALS` if not found or no password hash.
2. `bcrypt.compare`; `INVALID_CREDENTIALS` if mismatch (never weakened/skipped).
3. **Only after a correct password**, gate on state: `PENDING` → `REJECTED` → `INACTIVE` → `SUSPENDED`. Success requires `registrationStatus = APPROVED` **and** `status = ACTIVE`.

A session is issued only on success. Account state is never disclosed without a correct password (no enumeration by arbitrary users). Specific Arabic messages and blocked-login audit are produced in `loginAction` (which also has request headers for IP/user-agent):

| Reason | Message (Arabic) | Audit |
|---|---|---|
| PENDING | "حسابك قيد المراجعة…" | LOGIN_BLOCKED_PENDING |
| REJECTED | "تم رفض طلب التسجيل…" (no internal notes) | LOGIN_BLOCKED_REJECTED |
| INACTIVE | "الحساب غير مُفعّل حاليًا…" | LOGIN_BLOCKED_INACTIVE |
| SUSPENDED | "تم إيقاف الحساب مؤقتًا…" | LOGIN_BLOCKED_SUSPENDED |
| INVALID_CREDENTIALS | "بريد إلكتروني أو كلمة مرور غير صحيحة" | (none — avoids abuse/enumeration) |

`getAccessContext` (and `loadAccessContextByUserId`) also require APPROVED + ACTIVE, so even a stale session cannot act after suspension/deactivation.

## 3. Approval transaction

`approveRegistration(actor, input)` (Task F), all in one `$transaction`:

1. `actor` must hold `user.manage` (else FORBIDDEN) — actor comes from a valid APPROVED+ACTIVE context.
2. Input validated by Zod (`approveSchema`); role restricted to `APPROVABLE_ROLES` (never SYSTEM_ADMIN).
3. Target must exist and be `PENDING` (else NOT_FOUND / NOT_PENDING → **repeated approval is safely rejected**).
4. Upsert `UserRole(roleId, scopeType, scopeId)`; upsert `UserMembership` when org/department chosen.
5. Update user: `registrationStatus = APPROVED`, `status = ACTIVE`, `approvedById`, `approvedAt`, clear `rejectionReason`.
6. Write `AuditLog(REGISTRATION_APPROVED)`.

The admin chooses role, organization, department, scope type, and scope target in the review UI.

## 4. Rejection flow

`rejectRegistration(actor, input)` (Task G): requires `user.manage`; target must be PENDING; sets `registrationStatus = REJECTED`, `status = INACTIVE`, `approvedById`/`approvedAt` (reviewer/at), and an optional **internal** `rejectionReason` (stored, never shown to the rejected user — the login message is generic). **No role is created.** Writes `AuditLog(REGISTRATION_REJECTED)` with the reason only in metadata.

## 5. Session payload

JWT/session carry only lightweight claims (set by `authorize`'s return, copied in the `jwt`/`session` callbacks): `id`, `name`, `email`, `registrationStatus`, `status`, `roleKeys[]`. **Never** included: password hash, approval notes, full permission lists, raw org records, secrets. Types augmented in `src/types/next-auth.d.ts`. Fine-grained permissions are always re-resolved server-side via `getAccessContext`.

## 6. Password handling

- bcrypt (cost 10) for hashing (registration + seed) and constant-time compare (login).
- Passwords never logged; blocked-login audit stores no password or session token — only actor id, reason, IP, and user-agent.
- Minimum length 8 (Zod), max 128.

## 7. Admin route protection

- `src/app/(app)/admin/layout.tsx` calls `requirePermission("user.manage")` — **server-side** guard over the whole `/admin` subtree. Unauthenticated → `/login`; authenticated-but-unauthorized → FORBIDDEN (error boundary shows "لا تملك صلاحية الوصول"). Verified: a VIEWER hitting `/admin/users/requests` is blocked.
- Server actions (`approveAction`/`rejectAction`/`accountStateAction`) resolve the actor from the session and the **service re-checks `user.manage`** — protection does not rely on hiding the nav link, and direct action invocation by a non-admin fails closed.

## 8. Audit events

Implemented via `src/server/audit.ts` (`writeAudit`, transaction-aware): `USER_REGISTERED`, `REGISTRATION_APPROVED`, `REGISTRATION_REJECTED`, `USER_ACTIVATED`, `USER_DEACTIVATED`, `USER_SUSPENDED`, `USER_RESTORED`, `LOGIN_BLOCKED_{PENDING,REJECTED,INACTIVE,SUSPENDED}`. Stored with actor, entity id, optional org/dept scope, before/after JSON, and (for logins) IP + user-agent. No sensitive data is stored.

## 9. Seed / demo users

Four deterministic demo users (env-driven passwords; **no real password committed**): SYSTEM_ADMIN, INTERNAL_EDITOR, EXTERNAL_PARTNER, VIEWER — all APPROVED + ACTIVE. SYSTEM_ADMIN is assigned only via seed, never public registration. Two extra demo registrations exercise the review UI: one PENDING (`pending@innovation.local`) and one REJECTED (`rejected@innovation.local`). Seed is idempotent (upsert by id/email); demo users are skipped in production unless `SEED_DEMO_PASSWORD` is set.

## 10. Test strategy

`vitest` integration tests (`tests/identity.test.ts`) run against a **disposable PostgreSQL** database, exercising the real service functions (not the HTTP layer) so logic is verified against the true schema:

1. registration creates PENDING/role-less user · 2. SYSTEM_ADMIN not requestable · 3. duplicate email rejected · 4–7. PENDING/REJECTED/INACTIVE/SUSPENDED cannot log in · 8. APPROVED+ACTIVE can · (8b. wrong password rejected) · 9. non-admin cannot approve · 10. approval creates role+scope+membership+activation · 11. repeated approval NOT_PENDING · 12. rejection grants no role · 13. approval & rejection write audit. **14/14 pass.** Pure context resolution was split into `src/server/access-context.ts` (no `next-auth` import) so tests/services don't pull the Auth.js instance.

## 11. Known limitations

- **Rate limiting is NOT implemented** for public registration or credentials login — no suitable dependency (Redis/limiter) exists and an in-memory limiter would be unsafe/ineffective in a serverless/multi-instance deployment. **HIGH-priority remaining risk** — see Phase 2C deferrals.
- No email verification / notification on registration or approval (in-app only; delivery deferred per MVP scope).
- Rejected/duplicate responses reveal that an email is registered (standard for registration UX); no privileged-account details are ever disclosed.
- Session `roleKeys` can lag a mid-session role change; authoritative checks always re-resolve via `getAccessContext`.
- Blocked-login audit is written per attempt (no throttle) — bounded until rate limiting lands.

## 12. Deferred to Phase 2C

- **Rate limiting** on `/register` and login (durable store) — carried as HIGH risk.
- Data-scope enforcement (Layer 3), ResourceShare/field-level enforcement, immutability guards (Layer 5).
- Richer role/scope editing beyond initial approval; bulk user administration.
- Email/notification delivery; audit-log viewer UI.
- Evidence upload, document analysis, compliance scoring, business workflows.
