# Database Freeze — Strategic Planning, Activities, Governance, Challenges

**Status: FROZEN.** This document is the authoritative record of the schema
design approved for `prisma/migrations/20260731140000_challenges_committees_strategy_documents`.
It has NOT been applied to any database yet (no `migrate deploy`, no `db push`,
no Neon connection — see `migration.sql` header). Once applied, this becomes
the foundation the modules below are built on.

Scope note: I do not expect further schema changes within the current
requirements scope. If a genuinely new requirement appears outside that scope
during implementation, it will be raised explicitly before any schema change
— this is not a claim that the schema can never change again.

This document covers only the **new and modified** entities from this freeze.
Pre-existing entities (`User`, `Role`, `Department`, `Organization`,
`Evidence`, `EvidenceLink`, `ComplianceRequirement`, `Idea`,
`InnovationSolution`, `Alert`, `Notification`, `AuditLog`, etc.) are already
documented in `docs/data-dictionary.md` and are referenced here only where a
new table relates to them.

---

## 1. New tables

### 1.1 `Challenge` (`challenges`)

**Purpose:** Lets a department register a challenge it faces, as a standalone
record — independent of the Idea and Solution pipelines. Supports the
**إدارة التحديات** module.

**Why this table exists:** The original requirement asks for challenges to be
logged directly by departments and displayed as cards, then optionally linked
to one or more proposed solutions. No existing entity modeled "a problem a
department is facing" as a first-class, trackable record.

| Field | Type | Notes |
|---|---|---|
| `id` | String (cuid) | PK |
| `titleAr` | String | required |
| `description` | String? | |
| `departmentId` | String | FK → `Department`, required |
| `category` | String? | free text (domain/classification), no locked enum |
| `submittedById` | String? | soft ref → `User.id` |
| `status` | `ChallengeStatus` | default `NEW` |
| `createdAt` / `updatedAt` | DateTime | |
| `archivedAt` / `archivedById` | DateTime? / String? | soft archive, **kept separate from `status`** so restoring a challenge never loses its last operational state |

**Relationships:** `Department 1—N Challenge`; `Challenge N—M InnovationSolution` via `ChallengeSolution`.

**Indexes:** `departmentId`, `status`.

**Depended on by:** إدارة التحديات (primary), الحلول الابتكارية (challenge↔solution linking), ملف الامتثال (future reporting).

### 1.2 `ChallengeSolution` (`challenge_solutions`)

**Purpose:** Many-to-many join between a challenge and the solution(s)
proposed against it — a challenge may have multiple proposed solutions, and a
solution may address multiple challenges.

**Why this table exists:** A direct FK on either side would force a 1:1 or
1:N assumption the requirements explicitly do not make. This mirrors the
existing `AgreementSolution` join-table pattern already used in this schema.

| Field | Type | Notes |
|---|---|---|
| `challengeId` | String | FK → `Challenge`, `onDelete: Cascade` |
| `solutionId` | String | FK → `InnovationSolution`, `onDelete: Cascade` |
| `linkedAt` | DateTime | default now |
| `linkedById` | String? | soft ref → `User.id` |

**Primary key:** composite `(challengeId, solutionId)`.

**Depended on by:** إدارة التحديات, الحلول الابتكارية.

### 1.3 `Committee` (`committees`)

**Purpose:** A governance committee (e.g. the innovation committee). Supports
**حوكمة الابتكار**.

**Why this table exists:** Governance requires tracking a committee's
formation, membership, and meeting history as durable, auditable state — none
of which existed before this freeze.

| Field | Type | Notes |
|---|---|---|
| `id` | String (cuid) | PK |
| `nameAr` | String | required |
| `category` | String? | free-text purpose/type — no locked enum, since committee types are open-ended |
| `organizationId` | String | FK → `Organization`, required |
| `decisionNumber` | String? | formation decision number (structured, searchable) |
| `decisionDate` | DateTime? | formation decision date |
| `status` | `CommitteeStatus` | default `PROPOSED` |
| `createdAt` / `updatedAt` | DateTime | |
| `archivedAt` / `archivedById` | DateTime? / String? | soft archive |

**Design note — multiple committees:** the schema places no uniqueness
constraint forcing a single committee; any number of committees can coexist
as independent rows, per the explicit requirement to support this.

**Design note — formation decision file:** the decision *file* is not a
column here — it is an `Evidence` record linked via
`EvidenceLink(entityType: COMMITTEE, entityId: committee.id)`, avoiding a
duplicate file-storage mechanism.

**Relationships:** `Organization 1—N Committee`; `Committee 1—N CommitteeMember`; `Committee 1—N CommitteeMeeting`.

**Indexes:** `organizationId`.

**Depended on by:** حوكمة الابتكار (primary), ملف الامتثال (5.23.3 future reporting).

### 1.4 `CommitteeMember` (`committee_members`)

**Purpose:** A committee member's name, title/designation, and email.

| Field | Type | Notes |
|---|---|---|
| `id` | String (cuid) | PK |
| `committeeId` | String | FK → `Committee`, `onDelete: Cascade` |
| `name` | String | required |
| `title` | String? | role/designation on the committee |
| `email` | String? | notification target (see §5) |
| `userId` | String? | soft ref → `User.id` — optional, since a member need not be a platform user |
| `joinedAt` | DateTime | default now |
| `leftAt` | DateTime? | membership end — **members are never deleted**, only marked as having left, so the committee's historical composition is always reconstructable |

**Indexes:** `committeeId`.

**Depended on by:** حوكمة الابتكار.

### 1.5 `CommitteeMeeting` (`committee_meetings`)

**Purpose:** A single committee meeting, sequentially numbered per committee
(محضر 1، 2، 3...).

**Why sequencing is enforced at the database level:** `sequenceNumber` +
`@@unique([committeeId, sequenceNumber])` guarantees the number is unique
*for the life of the committee* — including archived meetings, so a number is
**never reused**, even after a mistaken meeting is archived. This is a plain
unique index (not partial) precisely because reuse must be permanently
forbidden here, unlike the partial-unique cases in §1.6–1.7.

**Why the first meeting isn't a schema constraint:** enforcing "meeting #1 is
mandatory before the committee is ACTIVE" as a foreign-key or check
constraint would freeze that specific business rule into the database
forever. It is enforced by the service layer instead (blocking the
`PROPOSED → ACTIVE` transition), so the rule can evolve without a migration.

| Field | Type | Notes |
|---|---|---|
| `id` | String (cuid) | PK |
| `committeeId` | String | FK → `Committee`, `onDelete: Cascade` |
| `sequenceNumber` | Int | unique per committee |
| `meetingDate` | DateTime | required |
| `agenda` | String? | |
| `topicsDiscussed` | String? | |
| `decisionsAndRecommendations` | String? | |
| `status` | `CommitteeMeetingStatus` | default `SCHEDULED` |
| `createdAt` / `updatedAt` | DateTime | |
| `archivedAt` / `archivedById` | DateTime? / String? | lets a mistakenly-added meeting be hidden without deleting it or freeing its number |

**Design note — minutes and attachments:** not columns here — they are
`Evidence` records linked via `EvidenceLink(entityType: COMMITTEE_MEETING, entityId: meeting.id)`.

**Design note — member notification:** no new schema needed. `Alert` and
`Notification` (pre-existing, generic) already support arbitrary
`entityType`/`entityId` targets; `COMMITTEE_MEETING` was added to
`LinkedEntityType` (§4) specifically so the existing alert engine can raise
"meeting overdue/upcoming" without a new table. Actual email delivery is out
of scope for this freeze (per the explicit decision to prepare the structure
only).

**Indexes:** unique `(committeeId, sequenceNumber)`.

**Depended on by:** حوكمة الابتكار.

### 1.6 `ComplianceRequirementAssignment` (`compliance_requirement_assignments`)

**Purpose:** The **sole source of truth** for "which department is
responsible for satisfying which compliance requirement, in the context of
which strategic objective (if any)." Supports **إدارة التخطيط الاستراتيجي**
and feeds **ملف الامتثال**.

**Why this table exists:** a compliance requirement can legitimately be
assigned to more than one department, each independently tracked (own status,
own due date). A single `responsibleDepartmentId` column on
`ComplianceRequirement` was considered and rejected for exactly this reason
(see chat history) — it cannot represent one requirement owned by multiple
departments, cannot give each department its own due date, and would force
duplicating `ComplianceRequirement` rows per department.

**Why `strategicObjectiveId` lives here, not on `StrategyDocument`:** the
objective context is fixed for the life of the assignment (the same
requirement×department pairing serves one strategic objective throughout),
so it is set once at assignment time and inherited by whatever document
fulfills it — never re-litigated per document.

| Field | Type | Notes |
|---|---|---|
| `id` | String (cuid) | PK |
| `complianceRequirementId` | String | FK → `ComplianceRequirement`, required |
| `departmentId` | String | FK → `Department`, required |
| `strategicObjectiveId` | String? | FK → `StrategicObjective`, optional |
| `assignedAt` | DateTime | default now |
| `assignedById` | String? | soft ref → `User.id` |
| `dueDate` | DateTime? | per-assignment due date |
| `createdAt` / `updatedAt` | DateTime | |
| `archivedAt` / `archivedById` | DateTime? / String? | soft archive |

**Why "active" uniqueness is a partial index, not `@@unique`:** a plain
unique constraint on `(complianceRequirementId, departmentId)` would permanently
block reassigning the same requirement to the same department in a later
planning cycle, even after the prior assignment is archived and no longer
relevant. The **partial** unique index (`WHERE archivedAt IS NULL`) allows
exactly one *active* assignment per pair at a time, while permitting
reassignment once the old one is archived.

**Planning-cycle timeframe:** deliberately not a field here. When
`strategicObjectiveId` is set, the cycle is read from that objective's
existing `periodStart`/`periodEnd` — no duplicate "cycle" concept was added.

**Relationships:** `ComplianceRequirement 1—N Assignment`; `Department 1—N Assignment`; `StrategicObjective 1—N Assignment` (optional); `Assignment 1—1 StrategyDocument` (in practice, see §1.7).

**Indexes:** `(complianceRequirementId, departmentId)`, `departmentId`, `strategicObjectiveId`, plus the partial unique index below.

```sql
CREATE UNIQUE INDEX compliance_requirement_assignments_active_pair_key
  ON compliance_requirement_assignments ("complianceRequirementId", "departmentId")
  WHERE "archivedAt" IS NULL;
```

**Depended on by:** إدارة التخطيط الاستراتيجي (primary), ملف الامتثال (fulfillment rollups).

### 1.7 `StrategyDocument` (`strategy_documents`)

**Purpose:** The document a department uploads to evidence fulfillment of an
assigned requirement.

**Why it links to `Assignment` and not directly to `Department` /
`StrategicObjective` / `ComplianceRequirement`:** those three are already
fully determined by the assignment. Repeating them here would create two
competing sources of truth with no way to guarantee they stay consistent
short of a database trigger — which was explicitly rejected in favor of the
simpler, single-source design once it was confirmed (by checking actual
requirements) that this platform has no real use case for a "general"
strategy document unrelated to any assignment. `assignmentId` is therefore
**required, not optional**.

**Why "1:1 with its assignment" is a partial index, not `@@unique`:** same
reasoning as §1.6 — a plain unique constraint would permanently block
uploading a replacement document after a mistaken one is archived. The
partial index allows exactly one *active* document per assignment, while
still permitting a new one after archival — approval status corrections and
replacement documents flow through the *same* assignment's history rather
than creating a second competing document, matching the existing DRAFT →
PENDING_APPROVAL → APPROVED/REJECTED lifecycle already modeled on
`approvalStatus`.

**`approvalStatus` semantics:** this is a **record of an approval that
happens outside the platform**, not a platform-internal approval workflow.
A document can be created directly as `APPROVED` (with `approvedAt`/
`approvedById` set at creation) when it already arrived pre-approved — the
schema imposes no forced sequence through the enum's other values.

| Field | Type | Notes |
|---|---|---|
| `id` | String (cuid) | PK |
| `titleAr` | String | required |
| `documentType` | String | free text — matches the `evidenceTypeKey` pattern already used by `RequirementEvidenceRule`, not a locked enum |
| `description` | String? | short description of the document's content |
| `assignmentId` | String | FK → `ComplianceRequirementAssignment`, **required** |
| `documentDate` | DateTime? | |
| `approvalStatus` | `DocumentApprovalStatus` | default `DRAFT` |
| `notes` | String? | |
| `uploadedById` | String? | soft ref → `User.id` |
| `approvedById` | String? | soft ref → `User.id` — optional; approval is often external |
| `approvedAt` | DateTime? | |
| `createdAt` / `updatedAt` | DateTime | |
| `archivedAt` / `archivedById` | DateTime? / String? | soft archive |

**Fulfillment (FULFILLED / IN_PROGRESS / NOT_STARTED):** computed, never
stored. An assignment is:
- `NOT_STARTED` if it has no active (non-archived) document;
- `IN_PROGRESS` if it has an active document that is not (`APPROVED` **and**
  backed by a real `Evidence` record);
- `FULFILLED` only when the active document is `APPROVED` **and** at least
  one `Evidence` is linked via `EvidenceLink(entityType: STRATEGY_DOCUMENT, entityId: document.id)`.

A document record with `approvalStatus = APPROVED` but no attached file is
therefore `IN_PROGRESS`, not `FULFILLED` — a real uploaded file is required.
"Overdue" is a UI badge computed from `dueDate < now() AND status ≠ FULFILLED`,
not a fourth stored/computed state.

```sql
CREATE UNIQUE INDEX strategy_documents_active_assignment_key
  ON strategy_documents ("assignmentId")
  WHERE "archivedAt" IS NULL;
```

**Depended on by:** إدارة التخطيط الاستراتيجي (primary), ملف الامتثال (fulfillment rollups).

---

## 2. Modified existing tables (additive only)

### 2.1 `InnovationActivity`

| Change | Type | Reason |
|---|---|---|
| `+ objectivesAr` | String? | event objectives/goals, per requirements |
| `+ eventUrl` | String? | external event link |

No existing column altered or dropped. `status = COMPLETED` (already
existing) is reused to represent "closed" — no new column needed. Evidence
during/after the event reuses `EvidenceLink(entityType: INNOVATION_ACTIVITY)`,
already supported before this freeze.

**Depended on by:** إدارة المنهجيات الابتكارية.

---

## 3. New enums

| Enum | Values | Used by |
|---|---|---|
| `ChallengeStatus` | `NEW, UNDER_REVIEW, SOLUTION_PROPOSED, IN_PROGRESS, RESOLVED, CLOSED_WITHOUT_SOLUTION` | `Challenge.status` — deliberately excludes an `ARCHIVED` value; archival is tracked separately (`archivedAt`) so restoring a challenge never loses its last real status |
| `CommitteeStatus` | `PROPOSED, ACTIVE, DISSOLVED` | `Committee.status` |
| `CommitteeMeetingStatus` | `SCHEDULED, HELD, CANCELLED` | `CommitteeMeeting.status` |
| `DocumentApprovalStatus` | `DRAFT, PENDING_APPROVAL, APPROVED, REJECTED` | `StrategyDocument.approvalStatus` |

## 4. Modified existing enums (additive values only)

| Enum | Added values | Reason |
|---|---|---|
| `InnovationActivityType` | `MEETING, PROGRAM, INITIATIVE` | the three activity kinds named in requirements that had no existing enum value (لقاءات، برامج، مبادرات) |
| `LinkedEntityType` | `CHALLENGE, COMMITTEE, COMMITTEE_MEETING, STRATEGY_DOCUMENT` | lets the existing generic `EvidenceLink`, `Alert`, and `AuditLog` mechanisms target the four new entity kinds without any new linking table |

No enum value was removed; existing rows referencing any pre-existing value
are unaffected.

## 5. New foreign keys (summary)

`Challenge → Department` · `ChallengeSolution → Challenge, InnovationSolution`
(both `onDelete: Cascade`, join-table pattern) · `Committee → Organization` ·
`CommitteeMember → Committee` (`onDelete: Cascade`) · `CommitteeMeeting →
Committee` (`onDelete: Cascade`) · `ComplianceRequirementAssignment →
ComplianceRequirement, Department, StrategicObjective (optional)` ·
`StrategyDocument → ComplianceRequirementAssignment`.

`onDelete`/`onUpdate` behavior on every new FK matches the convention already
used throughout this schema: `Restrict`/`Cascade` (Prisma defaults) for
required parent references, `SetNull`/`Cascade` for optional ones, and
explicit `Cascade` only for true child/join records (members, meetings,
challenge-solution links) — never for a record's owning
department/organization.

## 6. Module dependency matrix

| Module | Tables it primarily reads/writes |
|---|---|
| إدارة التخطيط الاستراتيجي | `StrategicObjective` (pre-existing), `ComplianceRequirementAssignment`, `StrategyDocument`, `Evidence`/`EvidenceLink` |
| إدارة المنهجيات الابتكارية | `InnovationActivity`, `Evidence`/`EvidenceLink` |
| حوكمة الابتكار | `Committee`, `CommitteeMember`, `CommitteeMeeting`, `Evidence`/`EvidenceLink`, `Alert`/`Notification` |
| إدارة التحديات | `Challenge`, `ChallengeSolution`, `Evidence`/`EvidenceLink` |
| الحلول الابتكارية والأدلة | `InnovationSolution` (pre-existing), `ChallengeSolution`, `Evidence`/`EvidenceLink` |
| ملف الامتثال | `ComplianceRequirement` and its rule tables (pre-existing), plus read-only rollups over `ComplianceRequirementAssignment`, `StrategyDocument`, `InnovationActivity`, `Committee` |

---

*Once `20260731140000_challenges_committees_strategy_documents` is applied
and `@prisma/client` is regenerated, this document should be read alongside
`docs/data-dictionary.md`, which will need its own update pass to fold these
entities into the single living reference.*
