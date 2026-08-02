# Authorization Design — منصة إدارة الابتكار المؤسسي

Server-enforced authorization combining **RBAC** with **data scope**. The platform never authorizes on a bare role label and never relies on hiding UI. This document is consistent with `src/modules/auth/permissions.ts` and `prisma/schema.prisma`.

---

## 1. Model overview

```
User ──< UserRole >── Role ──< RolePermission >── Permission
             │
             ├─ scopeType  (PLATFORM | ORGANIZATION | DEPARTMENT | AGREEMENT | SOLUTION | PUBLISHED)
             └─ scopeId    (id of the scoped record, when applicable)

User ──< UserMembership >── Organization / Department   (feeds default scope)
```

Authorization decision = **(does the caller hold the required permission)** **AND** **(is the target record inside a scope where that permission was granted)**.

---

## 2. RBAC layer

- **Permissions** are fine-grained capability keys (`solution.update`, `evidence.approve`, `compliance.export`, …) — the controlled list lives in `permissions.ts` and is seeded into `Permission`.
- **Roles** bundle permissions (`Role` + `RolePermission`). The four seeded roles are a starting point; Admins can create roles (`role.manage`) without code changes.
- Code and UI check **permissions**, never role names. (`can(user, "evidence.approve", record)` — not `if role === 'ADMIN'`.)

---

## 3. Data-scope layer

Each `UserRole` assignment carries a `scopeType` and optional `scopeId`:

| scopeType | Meaning | scopeId |
|---|---|---|
| `PLATFORM` | Entire platform | null |
| `ORGANIZATION` | One organization | org id |
| `DEPARTMENT` | One department | department id |
| `AGREEMENT` | One cooperation agreement | agreement id |
| `SOLUTION` | One innovation solution | solution id |
| `PUBLISHED` | Read-only published projections only | null |

A user may hold several assignments (e.g., Editor@DeptA + Editor@DeptB + Viewer@PLATFORM). **Effective authorization is the union**: a permission applies to a record if *any* assignment grants that permission with a scope that contains the record.

### 3.1 Scope containment (per entity)
Given a target record, the server derives its scope keys and checks membership:

- **Organization/Department scope:** record's `owningDepartmentId` / `organizationId` (directly, or via its parent solution/activity) must match an assignment's `scopeId` (department), or belong to the assignment's organization.
- **Agreement scope:** the record is (or belongs to) `scopeId` agreement — covers the agreement, its meetings, and its evidence.
- **Solution scope:** the record is (or belongs to) `scopeId` solution — covers the solution, its impact indicators/measurements, and its evidence.
- **Published scope:** only records/fields explicitly marked published are readable; no writes.
- **Platform scope:** no filter.

---

## 4. Organization / Department scope resolution

- Internal Editors are typically scoped to `DEPARTMENT` (one or more). Queries are filtered so they only see records whose owning department is in their set.
- An organization-lead may be scoped to `ORGANIZATION`, seeing all departments under it.
- `UserMembership` provides the default department/org linkage and can seed scope assignments during Admin approval.

---

## 5. Shared-resource scope (external partners) — field-level & action-level

- External Partners get `AGREEMENT` and/or `SOLUTION` scoped assignments for **only** the records explicitly shared with them. They never receive `DEPARTMENT`/`ORGANIZATION`/`PLATFORM` scope.
- Sharing = creating an auditable, revocable share grant (`UserRole(EXTERNAL_PARTNER, SOLUTION|AGREEMENT, recordId)` + a share record carrying an **`allowedFields` allow-list** and **`allowedActions`**).

### 5.1 Action-level enforcement
The server checks the requested action against the share's `allowedActions`. Permitted partner actions are limited to: upload meeting minutes, confirm attendance, upload requested evidence, update own contact info, respond to information requests, update allow-listed shared-solution fields. Any other action (approve evidence, change ownership, change final agreement/renewal status, change compliance readiness, modify governance decisions, delete another party's files, access unrelated records) is **denied server-side**, regardless of UI.

### 5.2 Field-level enforcement
- Partner writes are validated against the share's `allowedFields`; a write touching any field outside the list is rejected before persistence.
- Ownership (`responsibleUserId`, `partnerOrgId`), status (`AgreementStatus`, `RenewalStatus`), verification, readiness, and approval fields are **never** allow-listable for a partner.
- Partner-writable contact fields are restricted to the partner's **own** contact block.
- Every partner write is audited with the originating share id.

## 5A. Published / Viewer scope (restricted)
- `VIEWER` assignments use `PUBLISHED` scope: reads are limited to explicitly **published** projections (published dashboards/reports) plus any record for which the viewer holds an explicit read grant.
- Nothing is published implicitly; publishing is a deliberate, audited act by an authorized user. A Viewer never sees raw ideas/evidence/agreements/full compliance detail by default.
- Explicit per-record viewer grants are scoped and audited and do **not** widen the default published view.

---

## 6. Server-side enforcement strategy

Enforcement is centralized and layered; **every** protected path passes through it.

### Layer 0 — Route protection (middleware)
- Next.js middleware guards authenticated route groups: no valid session → redirect to sign-in. Middleware handles *authentication and coarse gating only*, not fine-grained data authorization.

### Layer 1 — Session → principal
- On each request, the server resolves the caller's **principal**: `userId`, account status (must be `ACTIVE` + registration `APPROVED`), and the set of `{permission, scopeType, scopeId}` grants. Never trusted from the client.

### Layer 2 — Permission guard (server actions / route handlers)
- Each server action / API handler declares the permission it needs: `requirePermission(principal, "solution.update")`. Deny-by-default: absence of a grant = 403.

### Layer 3 — Scope-filtered data access (the critical layer)
- **Reads:** a central query builder injects a **scope filter** (`WHERE` clause) derived from the principal's grants — e.g. `owningDepartmentId IN (…)` — so a user physically cannot fetch out-of-scope rows. Hiding in UI is never the control.
- **Writes/mutations:** load the target record, compute its scope keys, and verify the principal has the permission *within a scope that contains it* before mutating.
- **Polymorphic targets (Evidence/Alert/Audit):** `EvidenceLink.entityId` has no DB FK, so the server validates that the referenced record (a) exists for `entityType`, and (b) is within the caller's scope, before linking or exposing it.

### Layer 4 — Audit
- Every allowed mutating/approval/export action writes an `AuditLog` (actor, entity, action, summary). Denied attempts on sensitive actions are also logged.

### Layer 5 — Immutability guard (finalized governance records)
- Finalized records — a final `IdeaDecision`, a `VERIFIED` `ImpactMeasurement`, an approved N/A determination, an approved export — are **write-protected**. The server rejects silent updates/deletes.
- Changing them requires an explicit governed action — **correction**, **superseding version**, or **documented reopening** — each of which preserves history and writes an `AuditLog` entry (see `status-definitions.md` §13). Reopening a `VERIFIED` result is a privileged, audited action, never an in-place edit.

---

## 7. Enforcement checklist (acceptance)

- [ ] No handler authorizes on a role label; all use permission keys.
- [ ] Every list/read query is scope-filtered server-side (verified by tests hitting the API directly, not the UI).
- [ ] An Internal Editor calling another department's record id via the API receives 403/empty — not the record.
- [ ] External Partner cannot enumerate non-shared records by guessing ids.
- [ ] `SYSTEM_ADMIN` cannot be self-assigned; role/scope changes require `role.manage`/`user.manage` and are audited.
- [ ] Published/Viewer paths expose only published projections; no raw records.
- [ ] External Partner writes are rejected server-side when the field is outside the share's `allowedFields` or the action is outside `allowedActions`.
- [ ] Partners cannot change ownership/final status/renewal/readiness/approval fields or delete files they didn't upload.
- [ ] Finalized governance records cannot be silently overwritten; only correction/superseding/reopening paths mutate them, each audited.
- [ ] Deny-by-default: a missing permission or scope always fails closed.

---

## 8. Implementation notes (for the build phase)

- Put the principal resolver, `requirePermission`, and the scope-filter builder in `src/server/` (single source of truth); modules import them — no ad-hoc checks.
- Represent grants in a compact in-memory structure per request (list of `{permission, scopeType, scopeId}`) to keep guards O(1).
- Keep the four seeded roles, but treat them as data; adding a fifth role or re-mapping permissions must require **no** code change.
- Prefer server components + server actions so authorization runs on the server by construction; client components receive only already-authorized, already-scoped data.
