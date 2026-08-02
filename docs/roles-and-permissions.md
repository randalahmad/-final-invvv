# Roles & Permissions — منصة إدارة الابتكار المؤسسي

Defines the four MVP roles, responsibilities, allowed/forbidden actions (including **field-level and action-level** limits for External Partners and **restricted** Viewer access), and the role × permission matrix. Consistent with `src/modules/auth/permissions.ts` and `authorization.md`.

> **Golden rule:** roles bundle **permissions**; the system authorizes on *permissions + data scope*, never on a bare role label. A permission grant is always evaluated **within a scope** — holding `evidence.view` does not mean "see all evidence," only evidence inside the granted scope.

---

## 1. Role catalogue

### 1.1 System Administrator — `مدير النظام` (`SYSTEM_ADMIN`) — scope `PLATFORM`
User approval & management, role assignment, compliance configuration, official export, audit access, platform oversight. Final human authority.

### 1.2 Internal Editor — `محرر داخلي` (`INTERNAL_EDITOR`) — scope `DEPARTMENT`(×N) / `ORGANIZATION`
Create/maintain ideas & solutions for assigned department(s); upload evidence; update impact; work assigned activities; resolve their alerts.

### 1.3 External Partner — `شريك خارجي` (`EXTERNAL_PARTNER`) — scope `AGREEMENT` / `SOLUTION` (shared only)
Acts **only on explicitly shared** agreements, meetings, and solutions, and **only on permitted fields/actions** (§4).

### 1.4 Viewer — `مطّلع` (`VIEWER`) — scope `PUBLISHED` / explicitly authorized records
**Restricted read-only.** A Viewer does **not** automatically see all ideas, evidence, agreements, or compliance details (§5).

---

## 2. Registration & lifecycle
- Public self-registration only for `INTERNAL_EDITOR`, `EXTERNAL_PARTNER`, `VIEWER`.
- **Nobody** self-registers or self-assigns `SYSTEM_ADMIN`.
- New registrations begin `PENDING` with **no** effective permissions until an Admin approves and assigns role + scope.

---

## 3. Allowed / forbidden (overview)

| Role | Key allowed | Explicitly forbidden |
|---|---|---|
| System Administrator | Approve users; manage roles/scopes; configure compliance; export; view audit; all in-scope CRUD | Bypass audit; hard-delete governance records (archival only); silently overwrite finalized decisions (§ immutability) |
| Internal Editor | Create/update in-scope ideas & solutions; evaluate ideas; upload evidence; update impact; resolve own alerts | Approve evidence / decide ideas unless explicitly granted; manage users/roles; export official package; touch other departments' data |
| External Partner | Only permitted actions on **shared** records (§4) | Everything in §4 "may not" |
| Viewer | View **published** dashboards/reports + explicitly authorized read-only records; download published reports | Any create/update/delete; access to unpublished/raw records; export; user/role management |

---

## 4. External Partner — field-level & action-level restrictions (correction #4)

External Partners operate under `AGREEMENT`/`SOLUTION` scope limited to **explicitly shared** resources. Sharing is an auditable, revocable grant.

### 4.1 They MAY (on shared resources only)
- **Upload meeting minutes** to a shared meeting.
- **Confirm attendance** on a shared meeting.
- **Upload requested evidence** against a shared agreement/solution/meeting.
- **Update allowed contact information** (their own external contact fields only).
- **Respond to information requests** (e.g. a `MORE_INFO_REQUESTED`-style prompt on a shared item).
- **Update explicitly permitted shared-solution fields** — a per-share allow-list of fields, nothing else.

### 4.2 They MAY NOT
- Change official **agreement ownership** (`responsibleUserId`, `partnerOrgId`).
- Change **final agreement status** (`ACTIVE/EXPIRED/TERMINATED`) or renewal status.
- Change **compliance readiness** or any compliance configuration.
- **Approve evidence** (`evidence.approve` is never granted to partners).
- **Modify governance decisions** (ideas/evaluations/decisions).
- **Delete another party's files** (or any file they did not upload).
- **Access unrelated records** (anything not explicitly shared).

### 4.3 Field-level model
- Each partner **share** carries an allow-list of writable fields (`allowedFields`) for that specific solution/agreement. Writes outside the allow-list are rejected server-side.
- Partner-writable contact fields are limited to the partner's **own** contact block.
- Ownership, status, verification, readiness, and approval fields are **never** in a partner allow-list.
- All partner writes are audited with the share id.

---

## 5. Viewer — restricted access (correction #7)

A Viewer's permissions are evaluated within `PUBLISHED` scope (plus any explicitly authorized read-only record). Concretely:
- **Sees:** published dashboards, published reports, and records explicitly marked/authorized as published read-only.
- **Does NOT automatically see:** raw ideas, raw evidence, agreements, meeting minutes, or full compliance detail.
- A Viewer can be *additionally* granted read access to a **specific** record (explicit authorization), which is scoped and audited — it does not widen their default view.
- "Published" is a deliberate act by an authorized user; nothing is published implicitly (definition to be confirmed — see open questions).

---

## 6. Permission keys (source of truth)
Grouped exactly as in `src/modules/auth/permissions.ts`:
- **Solutions:** `solution.view`, `solution.create`, `solution.update`, `solution.archive`
- **Governance:** `idea.view`, `idea.evaluate`, `idea.decide`
- **Impact:** `impact.view`, `impact.update`, `impact.verify`
- **Partners:** `agreement.view`, `agreement.update`, `meeting.update`
- **Evidence:** `evidence.view`, `evidence.upload`, `evidence.approve`
- **Compliance:** `compliance.view`, `compliance.configure`, `compliance.export`
- **Alerts:** `alert.view`, `alert.resolve`
- **Administration:** `user.manage`, `role.manage`, `audit.view`

> Each permission is always applied **within a scope**. The matrix below shows defaults; the effective right = permission ∧ scope-contains-record.

---

## 7. Role × Permission matrix

Legend: **✔** default · **➕** grantable per-user · **—** none. Qualifiers show the scope constraint.

| Permission | SYSTEM_ADMIN | INTERNAL_EDITOR | EXTERNAL_PARTNER | VIEWER |
|---|:---:|:---:|:---:|:---:|
| `solution.view` | ✔ | ✔ (dept) | ✔ (shared only) | ✔ (published/authorized) |
| `solution.create` | ✔ | ✔ (dept) | — | — |
| `solution.update` | ✔ | ✔ (dept) | ➕ (shared, allow-listed fields) | — |
| `solution.archive` | ✔ | ➕ (dept) | — | — |
| `idea.view` | ✔ | ✔ (dept) | — | ➕ (only if explicitly published) |
| `idea.evaluate` | ✔ | ✔ (dept) | — | — |
| `idea.decide` | ✔ | ➕ | — | — |
| `impact.view` | ✔ | ✔ (dept) | — | ✔ (published/authorized) |
| `impact.update` | ✔ | ✔ (dept) | — | — |
| `impact.verify` | ✔ | ➕ | — | — |
| `agreement.view` | ✔ | ✔ (dept/org) | ✔ (shared only) | ➕ (only if explicitly published) |
| `agreement.update` | ✔ | ➕ | ✔ (shared, allow-listed fields only) | — |
| `meeting.update` | ✔ | ➕ | ✔ (shared: minutes/attendance only) | — |
| `evidence.view` | ✔ | ✔ (dept) | ✔ (shared only) | ➕ (only if explicitly published) |
| `evidence.upload` | ✔ | ✔ (dept) | ✔ (shared only) | — |
| `evidence.approve` | ✔ | ➕ | — (never) | — |
| `compliance.view` | ✔ | ✔ (dept) | — | ✔ (published summary only) |
| `compliance.configure` | ✔ | — | — | — |
| `compliance.export` | ✔ | — | — | — |
| `alert.view` | ✔ | ✔ (dept) | ➕ (shared) | ➕ (authorized) |
| `alert.resolve` | ✔ | ✔ (dept) | — | — |
| `user.manage` | ✔ | — | — | — |
| `role.manage` | ✔ | — | — | — |
| `audit.view` | ✔ | — | — | — |

Notes:
- **Viewer** view-permissions are gated to `PUBLISHED`/explicitly-authorized records — not blanket. The change vs. the prior draft: Viewer no longer implicitly sees raw ideas/evidence/agreements/compliance detail.
- **External Partner** never receives `evidence.approve`, `*.decide`, `compliance.*`, ownership/status writes; its updates are field-allow-listed on shared records.
- **`evidence.approve`** and **`idea.decide`** are withheld from the base Internal Editor bundle and granted per-user to reviewers/committee members.

---

## 8. Data scope × role (see `authorization.md`)

| Role | Typical `scopeType` | `scopeId` | Query effect |
|---|---|---|---|
| System Administrator | `PLATFORM` | — | No filter |
| Internal Editor | `DEPARTMENT` (×N) / `ORGANIZATION` | dept/org id | Filtered to owned dept(s)/org |
| External Partner | `AGREEMENT` / `SOLUTION` | shared record id(s) | Only shared records, allow-listed fields |
| Viewer | `PUBLISHED` (+ explicit record grants) | (record id) | Only published/authorized read-only projections |

A user may hold multiple assignments; effective rights = union of (permission within each assignment's scope).

---

## 9. Example seeded users (pilot)

| Name (Ar) | Role | Scope | Purpose |
|---|---|---|---|
| مدير النظام | SYSTEM_ADMIN | PLATFORM | Approves users, configures compliance, exports |
| محرر إدارة التقنية | INTERNAL_EDITOR | DEPARTMENT: تقنية | Ideas, solutions, evidence, impact |
| شريك جامعي | EXTERNAL_PARTNER | AGREEMENT + shared SOLUTION | Uploads minutes/evidence, allow-listed field updates |
| مطّلع قيادي | VIEWER | PUBLISHED | Published readiness dashboards only |

> The seed must not ship a publicly-known admin password in any deployed environment; admin credentials are environment-provided (random generated + printed if unset).
