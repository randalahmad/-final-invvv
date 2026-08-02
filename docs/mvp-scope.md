# MVP Scope — منصة إدارة الابتكار المؤسسي

**Product:** Enterprise Innovation Management Platform
**Owner:** King Abdullah City for Atomic and Renewable Energy (KACARE / ك.أ.ذ.م)
**Type:** Enterprise innovation governance & compliance system
**Central principle:** *The compliance standard becomes the platform's data model.*

> This document defines what the MVP **is** and, just as importantly, what it **is not**. It is the contract that scopes every other blueprint document.

---

## 1. The MVP is defined by one journey

The MVP is **not** the full feature list. It is successful if and only if this end-to-end journey works, with real persistence, server-side authorization, and audit at every step:

```
Register (self-service) → Admin approval → Submit idea → Evaluate → Approve
→ Convert to Innovation Solution → Upload evidence file → Analyze file (AI)
→ Review AI suggestions → Approve evidence mapping → Compliance readiness updates
→ Dashboard updates → Compliance file reflects the change
```

Everything in scope below exists to make that single thread work convincingly for a real KACARE reviewer. Everything else is deferred.

---

## 2. In scope (MVP)

### 2.1 Identity, access & onboarding
- Self-service registration for **Internal Editor**, **External Partner**, **Viewer** (never System Administrator).
- New accounts start `PENDING`; a System Administrator approves/rejects.
- Credentials-based login for local/pilot; architecture kept Entra-ID-ready.
- Server-enforced RBAC + **data scope** (platform / organization / department / agreement / solution / published). See `authorization.md`.

### 2.2 Organizations & departments
- Owner organization (KACARE), internal departments, external partner organizations.
- **Single owning organization for the MVP, with multiple internal departments, external organizations, partner records, and strictly scoped external access.** The data model keeps organizations clearly separated so future expansion is possible — **without** implementing a full SaaS multi-tenant platform now.
- User membership → feeds data scope.
- Minimal admin CRUD (create/edit/archive; no hard delete of governance records).

### 2.2a All five DGA modules are CORE to the MVP (correction #5)
The MVP must **not** collapse into only ideas + solutions + evidence. All five DGA-oriented modules are core, and the MVP data model + module boundaries must include at least `StrategicObjective`, `InnovationActivity`, `ImpactIndicator`, and `ImpactMeasurement`:

- **5.23.1 Strategic Direction** — `StrategicObjective` records; solutions align to objectives. *(In scope: create/list objectives + link from solution. Deferred: KPI analytics.)*
- **5.23.2 Innovation Methodologies & Activities** — `InnovationActivity` records; activities produce ideas/solutions. *(In scope: create/list activities + link. Deferred: full event logistics.)*
- **5.23.3 Innovation Governance** — ideas → evaluation → decision → convert (§2.3).
- **5.24.1 Innovation Solutions Registry** — the registry (§2.4).
- **5.24.2 Impact Measurement** — `ImpactIndicator` + `ImpactMeasurement` (indicator with baseline/target; measurements over time with verification). *(In scope: create indicators + record/verify measurements + surface on the solution and dashboard. Deferred: advanced trend analytics.)*

Advanced features within any module may be delayed, but the **module boundaries and core entities of all five must exist in the foundation.**

### 2.3 Governance — idea lifecycle (5.23.3)
- Idea submission (optionally linked to an innovation activity).
- Evaluation records (stage + score + notes).
- Decision records (approve / reject / request info / convert).
- Persisted Kanban board reflecting `IdeaStatus` (board is a **view over data**, not the source of truth).
- Convert an approved idea into an Innovation Solution (one-to-one link preserved).

### 2.4 Innovation solutions registry (5.24.1)
- Central registry of solutions with the core governance fields.
- Ownership: owning department + responsible owner user.
- Strategic alignment (link to a Strategic Objective).
- Completion % and evidence-readiness % surfaced on the record.
- "What's missing to be usable as formal evidence" indicator.

### 2.5 Evidence management
- Upload an evidence file attached to a business record (solution, agreement, meeting, idea, activity, impact measurement, requirement).
- Polymorphic linking via `(entityType, entityId)` + optional mapping to a `ComplianceRequirement`.
- Evidence lifecycle statuses (see `status-definitions.md`).
- **Human approval** of the mapping is mandatory before evidence counts toward readiness.

### 2.6 AI document analysis (bounded, human-in-the-loop)
- Supported formats: **PDF, DOCX, XLSX**.
- Pipeline: extract text/tables → classify document → **suggest** field values and requirement mapping → produce confidence scores.
- The AI may **suggest / extract / recommend**. It may **never approve, reject, or modify** an official record autonomously. A human always confirms.
- If analysis fails, the evidence remains usable via fully manual mapping.

### 2.7 Compliance readiness (configurable engine) + on-screen compliance file
- `ComplianceRequirement` records store required fields + required evidence types **with per-requirement weights, mandatory gates, optional criteria, and `allowNA`** (data, not code). **No fixed 50/50 rule.**
- Readiness is an **internal estimated score** (labelled as such) until DGA methodology is confirmed; computed per requirement and rolled up (weighted) to sections and overall.
- **N/A is never automatic** — absence of a record is a gap by default; N/A requires reason + authorized user + approval + audit (`ComplianceNA`).
- **On-screen compliance file (in MVP)** shows, per requirement: estimated readiness, mandatory-gate status, missing data, missing evidence, missing records, validation errors, N/A state, and **deep links to source records**.
- **Print-friendly / basic exportable report (in MVP)** — e.g. print view or simple PDF/CSV. Advanced ZIP export-package generation + historical snapshots remain future scope (correction #11).

### 2.8 Dashboards
- Overall compliance readiness + readiness by requirement.
- Counts: solutions (by maturity/department), activities, agreements status, open alerts, evidence completeness.
- Recent activity feed.

### 2.9 Alerts
- Rule-generated alerts (missing evidence, incomplete solution, agreement expiry/renewal, upcoming/overdue meeting, evaluation deadline, approval task).
- Severity + status (`OPEN → ACKNOWLEDGED → RESOLVED / DISMISSED`), assignee, deep link to the affected record.
- In-app only for MVP (email delivery deferred).

### 2.10 Audit trail
- Append-only log of significant actions (create/update/archive/status-change/approve/reject/export/role-change).
- Viewable by System Administrator.

### 2.11 Non-functional (MVP baseline)
- Arabic-first, correct RTL throughout.
- Server Components by default; Client Components only where interaction requires it.
- No secrets in client bundles; env secrets out of Git.
- `npm install` / `npm run lint` / `npm run build` pass cleanly.

---

## 3. Out of scope (explicitly NOT in the MVP)

- **Microsoft Entra ID / organizational SSO** (architecture is ready; integration deferred).
- **Email / SMS notification delivery** (alerts are in-app only).
- **Advanced compliance export-package generation** (bundled ZIP) — the on-screen compliance file **and** a print-friendly / basic export (PDF/CSV) **are in scope** (§2.7); only the bundled official ZIP package is deferred.
- **Historical export snapshots / versioned compliance packages.**
- **Full impact analytics** beyond storing indicators + measurements and a simple trend.
- **Partner self-service portal** beyond the restricted shared-record access already scoped.
- **Meetings scheduling automation / calendar integration** (records only).
- **Bulk import** of legacy evidence/spreadsheets.
- **Fine-grained field-level workflow approvals** beyond the idea + evidence flows.
- **Mobile apps / offline mode.**
- **Multi-tenancy** (single owning organization for now).
- **Advanced AI**: autonomous decisioning, summarization of governance outcomes, cross-document reasoning, RAG chat. (Only bounded document analysis is in.)
- **Anything from the removed Manara domain**: AI project scoring, health scores, project-health dashboards, employee management.

---

## 4. Future scope (post-MVP roadmap candidates)

| Theme | Item |
|---|---|
| Auth | Entra ID SSO, SCIM provisioning, MFA policy |
| Compliance | Official export package (PDF+ZIP), snapshot history, requirement versioning UI, auditor "review mode" |
| Notifications | Email/Teams delivery, digest scheduling, escalation rules |
| Impact | Trend charts, target-vs-actual analytics, verification workflow |
| Partners | External partner portal, agreement renewal workflow, meeting minutes templates |
| Data | Bulk import, external system connectors (SharePoint/email ingestion) |
| AI | Higher-accuracy extraction models, table-to-indicator mapping, multilingual OCR, reviewer assistance |
| Platform | Multi-organization tenancy, configurable dashboards, saved reports |

---

## 5. MVP success criteria

The MVP is **accepted** when all of the following are demonstrably true on a clean environment:

1. **The core journey completes** end-to-end (section 1) using seeded roles, with data persisted in PostgreSQL.
2. **Authorization is server-enforced**: an Internal Editor cannot read/modify another department's records via direct API calls, not just hidden UI.
3. **Registration → approval works**: a self-registered user cannot access protected data until an Admin approves them; nobody can self-assign System Administrator.
4. **Evidence mapping requires a human**: AI suggestions never change readiness until a human approves the mapping.
5. **Readiness is computed from data**: changing/approving evidence or completing required fields visibly moves the requirement's readiness and the dashboard, with no manual recalculation.
6. **Configurability proven**: an Admin can add/deactivate a `ComplianceRequirement`, set its **weights / mandatory gates / optional criteria / `allowNA`**, **without a code change**, and readiness reflects it. The score is labelled **estimated/internal**.
7. **All five DGA modules present**: `StrategicObjective`, `InnovationActivity`, `ImpactIndicator`, `ImpactMeasurement` exist and are reachable, not just ideas/solutions/evidence.
8. **N/A is governed**: a requirement cannot be N/A without reason + authorized user + approval + audit; absence of a record shows as a gap by default.
9. **Immutability holds**: a finalized decision / verified impact cannot be silently overwritten; only correction/superseding/reopening paths mutate them, all audited.
10. **Viewer is restricted**: a Viewer cannot reach raw ideas/evidence/agreements/compliance detail via API — only published/authorized projections.
11. **Audit present**: every approval, status change, and export attempt appears in the audit log with actor + timestamp.
12. **Quality gates pass**: `npm install`, `npm run lint`, `npm run build` succeed; no TypeScript errors; Arabic RTL intact.

---

## 6. MVP assumptions

1. **Single owning organization for the MVP, with multiple internal departments, external organizations, partner records, and strictly scoped external access.** Organizations stay clearly separated in the data model so future expansion is possible, without building a full SaaS multi-tenant platform now.
2. Pilot user volume is small (tens of concurrent users); no horizontal scaling needed.
3. Local/pilot deployment uses credentials auth; production SSO comes later.
4. Evidence files are modest in size (target ≤ 25 MB/file) and stored via a single storage adapter (local disk or S3-compatible/UploadThing).
5. The **initial** DGA requirement content is derived from the product presentation; official wording will be loaded later into the same configurable model. **Readiness is an internal estimated score until DGA scoring methodology is confirmed.**
6. AI analysis runs asynchronously and may be imperfect; manual mapping is always available as fallback; extraction success never implies approval.
7. Arabic is the primary UI language; no full i18n/English UI required for MVP.
8. A human reviewer (Admin or authorized Editor) is always the final authority on compliance-affecting actions.
9. **Viewers see only published dashboards/reports + explicitly authorized read-only records** — not all ideas/evidence/agreements/compliance detail.
10. Finalized governance records (final decisions, verified impact) are **immutable**; changes go through correction/superseding/reopening with audit.

---

## 7. Risks (summary — full treatment in the deliverables section of the blueprint)

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| R1 | AI extraction accuracy is low on Arabic scanned PDFs | Reviewer distrust, rework | Confidence thresholds, mandatory human approval, manual fallback, OCR later |
| R2 | Compliance readiness formula misrepresents true readiness | False assurance before a DGA assessment | Transparent per-field breakdown, versioned rules, admin-configurable weights, documented assumptions |
| R3 | Data-scope enforcement gaps | Confidentiality breach across departments/partners | Central server-side scope guard, deny-by-default, tests on API layer |
| R4 | Scope creep back toward "innovation suite" | Missed MVP | This document is the contract; out-of-scope list is explicit |
| R5 | Schema deltas needed for AI analysis (new models/statuses) not yet in current schema | Rework mid-build | Documented in `data-dictionary.md` §deltas before coding |
| R6 | Evidence storage/security (sensitive institutional docs) | Compliance/data risk | Access-scoped download URLs, checksum, no public storage, audit on access |
| R7 | Arabic RTL regressions in third-party components (tables/charts/dnd) | UX defects | RTL test checklist, wrapper components, verified in shell already |

---

## 8. Traceability

Every in-scope capability maps to a DGA area and a module:

| Capability | DGA area | Module (`modules.md`) |
|---|---|---|
| Strategic direction | 5.23.1 | strategy |
| Activities & events | 5.23.2 | activities |
| Idea governance | 5.23.3 | governance |
| Solutions registry | 5.24.1 | solutions |
| Impact measurement | 5.24.2 | impact |
| Partners & agreements | supporting | partners |
| Evidence + AI analysis | supporting | evidence + document-analysis |
| Readiness & export view | supporting | compliance |
| Alerts / audit / reports | supporting | alerts / audit / reports |
