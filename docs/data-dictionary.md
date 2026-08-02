# Data Dictionary — منصة إدارة الابتكار المؤسسي

Authoritative description of every major entity: purpose, required/optional fields, relationships, ownership, and validation. This is aligned with the **implemented** `prisma/schema.prisma` and marks, at the end, the **schema deltas** the MVP journey still requires (AI document analysis + registration status). Field names use the Prisma model field names.

**Conventions**
- IDs are `cuid()` strings.
- `createdAt` / `updatedAt` present on mutable records (omitted from "required fields" lists for brevity — they are system-managed).
- "Soft archival" = `archivedAt: DateTime?` and/or a `status` of `ARCHIVED`; governance records are never hard-deleted.
- Arabic display fields use the `...Ar` suffix.

---

## 1. Identity, RBAC & scope

### User
Person who can authenticate.
- **Required:** `name`, `email` (unique), `status` (`ACTIVE|INACTIVE|SUSPENDED`).
- **Optional:** `passwordHash` (null for external IdP), `image`, `jobTitle`, `emailVerified`.
- **Relationships:** `roleAssignments` (UserRole[]), `memberships` (UserMembership[]), owned solutions, submitted ideas, evaluations, decisions, responsible agreements, uploaded evidence, assigned alerts, notifications, audit logs, Auth.js `accounts`/`sessions`.
- **Ownership:** self-owned identity; managed by `user.manage`.
- **Validation:** email format + unique; name non-empty; a user with no `passwordHash` must have an external account.

### Role
Named bundle of permissions.
- **Required:** `key` (unique, e.g. `SYSTEM_ADMIN`), `nameAr`.
- **Optional:** `description`, `isSystem` (system roles undeletable).
- **Relationships:** `permissions` (RolePermission[]), `assignments` (UserRole[]).
- **Validation:** `key` immutable once system; cannot delete `isSystem` roles.

### Permission
Fine-grained capability key.
- **Required:** `key` (unique, e.g. `evidence.approve`), `nameAr`.
- **Optional:** `description`.
- **Relationships:** `roles` (RolePermission[]).
- **Validation:** key from the controlled list in `src/modules/auth/permissions.ts`.

### RolePermission
Join of Role ↔ Permission. **Required:** `roleId`, `permissionId` (composite PK).

### UserRole (role assignment **with scope**)
The unit of authorization: a role granted to a user within a data scope.
- **Required:** `userId`, `roleId`, `scopeType` (`PLATFORM|ORGANIZATION|DEPARTMENT|AGREEMENT|SOLUTION|PUBLISHED`).
- **Optional:** `scopeId` (id of the org/dept/agreement/solution when scoped; null for PLATFORM/PUBLISHED).
- **Validation:** unique `(userId, roleId, scopeType, scopeId)`; `scopeId` required when `scopeType ∈ {ORGANIZATION, DEPARTMENT, AGREEMENT, SOLUTION}`.

### Account / Session / VerificationToken
Auth.js adapter models for future OAuth/Entra ID and session persistence. System-managed.

---

## 2. Organizations & departments

### Organization
Any organizational entity: the owner (KACARE), internal entities, or external partners.
- **Required:** `nameAr`, `type` (`OWNER|INTERNAL|PARTNER|UNIVERSITY|COMPANY|GOVERNMENT|OTHER`), `status` (`DRAFT|ACTIVE|ARCHIVED`).
- **Optional:** `archivedAt`.
- **Relationships:** `departments`, `memberships`, `agreements` (as partner org), `participations` (SolutionOrganization[]).
- **Ownership:** platform-level; managed by Admin.
- **Validation:** exactly one `OWNER` organization expected in MVP.

### Department
A unit inside an organization.
- **Required:** `organizationId`, `nameAr`, `status`.
- **Optional:** `archivedAt`.
- **Relationships:** `memberships`, `solutions`, `activities`, `strategicObjectives`.
- **Ownership:** owning `Organization`.

### UserMembership
Which org/department a user belongs to → feeds data scope.
- **Required:** `userId`.
- **Optional:** `organizationId`, `departmentId` (at least one should be set in practice).
- **Validation:** unique `(userId, organizationId, departmentId)`.

---

## 3. Strategy (5.23.1)

### StrategicObjective
Institutional/innovation objective a solution can align to.
- **Required:** `titleAr`, `status`.
- **Optional:** `code`, `description`, `departmentId`, `kpi`, `targetValue`, `periodStart`, `periodEnd`, `archivedAt`.
- **Relationships:** `department`, `solutions`.
- **Ownership:** owning `Department` (optional) / platform.

---

## 4. Activities & events (5.23.2)

### InnovationActivity
An innovation event/program (hackathon, camp, workshop, challenge, ideation, open innovation, competition).
- **Required:** `nameAr`, `type` (`InnovationActivityType`), `status` (`PLANNED|ONGOING|COMPLETED|CANCELLED`).
- **Optional:** `description`, `startDate`, `endDate`, `organizerDepartmentId`, `archivedAt`.
- **Relationships:** `ideas` (produced), `solutions` (produced), `organizerDepartment`.
- **Validation:** `endDate >= startDate` when both set.

---

## 5. Governance (5.23.3)

### Idea
A proposal entering governance.
- **Required:** `titleAr`, `status` (`IdeaStatus`).
- **Optional:** `description`, `activityId`, `submittedById`, `departmentId`, `archivedAt`.
- **Relationships:** `activity`, `submittedBy`, `evaluations`, `decisions`, `solution` (0..1 via `SolutionFromIdea`).
- **Ownership:** submitting user + owning department.
- **Validation:** status transitions restricted, each with an allowed actor (see `status-definitions.md` §4.1).
- **Delta:** `IdeaStatus` gains **`DRAFT`** (author pre-governance) and **`WITHDRAWN`** (author retracts pre-decision). `DRAFT`/`WITHDRAWN` transitions are author-initiated only.

### IdeaEvaluation
A single evaluation event on an idea.
- **Required:** `ideaId`, `stage` (`INITIAL|TECHNICAL|COMMITTEE`).
- **Optional:** `evaluatorId`, `score`, `notes`.
- **Validation:** `score` within an agreed range (e.g. 0–100) when present.

### IdeaDecision
A governance decision on an idea.
- **Required:** `ideaId`, `decision` (`APPROVE_FOR_PILOT|REJECT|REQUEST_MORE_INFO|CONVERT_TO_SOLUTION|DEFER`).
- **Optional:** `decidedById`, `notes`.
- **Validation:** requires `idea.decide`; `CONVERT_TO_SOLUTION` only from `APPROVED_FOR_PILOT`.
- **Immutability (correction #8):** a **final** decision is immutable — no silent overwrite. Changes require a linked **correction**, a **superseding** decision, or a **documented reopening**, each preserving history and writing `AuditLog`. Proposed additive fields: `supersedesId?`, `correctionOf?`, `reopenedFromId?`, `finalizedAt?`.

---

## 6. Solutions registry (5.24.1)

### InnovationSolution
Central record of an innovation solution.
- **Required:** `nameAr`, `source` (`ACTIVITY|INTERNAL_PROPOSAL|EXTERNAL_PARTNERSHIP`), `maturityStage`, `implementationStatus`, `status` (`DRAFT|ACTIVE|ARCHIVED`), `completionPct`, `evidenceReadinessPct`.
- **Optional:** `description`, `problemStatement`, `activityId`, `ideaId` (unique), `owningDepartmentId`, `strategicObjectiveId`, `ownerUserId`, `startDate`, `targetEndDate`, `actualEndDate`, `cost` (Decimal 14,2), `targetBeneficiaries`, `technologies`, `risks`, `notes`, `archivedAt`.
- **Relationships:** `activity`, `idea`, `owningDepartment`, `strategicObjective`, `owner`, `participatingOrganizations` (SolutionOrganization[]), `impactIndicators`.
- **Ownership:** `owningDepartment` + `owner` user.
- **Validation:** `completionPct`/`evidenceReadinessPct` in 0–100 (system-computed); `ideaId` unique.

### SolutionOrganization
Participating external orgs on a solution. **Required:** `solutionId`, `organizationId` (composite PK).

---

## 7. Impact (5.24.2)

### ImpactIndicator
A measurable indicator on a solution.
- **Required:** `solutionId`, `nameAr`, `type` (`ImpactType`).
- **Optional:** `unit`, `baselineValue`, `targetValue` (Decimal 16,4), `measurementMethod`.
- **Relationships:** `solution`, `measurements`.

### ImpactMeasurement
A measurement of an indicator at a point/period in time.
- **Required:** `indicatorId`, `verificationStatus` (`UNVERIFIED|PENDING|VERIFIED|REJECTED`).
- **Optional:** `actualValue`, `periodStart`, `periodEnd`, `measuredAt`, `dataSource`, `notes`.
- **Validation:** `periodEnd >= periodStart`; verification requires `impact.verify`.
- **Immutability (correction #8):** once `verificationStatus = VERIFIED`, the result is finalized and write-protected. Corrections use a **superseding** measurement or a **documented reopening** (privileged, audited); no in-place edit of a verified value. Proposed additive fields: `supersedesId?`, `verifiedAt?`, `reopenReason?`.

---

## 8. Partners, agreements & meetings

### Partner (Organization of type PARTNER/UNIVERSITY/COMPANY/GOVERNMENT)
Partners are `Organization` records classified by `type` (no separate table). Ownership: platform.

### CooperationAgreement
Agreement with a partner organization.
- **Required:** `partnerOrgId`, `titleAr`, `type` (`MOU|PARTNERSHIP|RESEARCH|SERVICE|OTHER`), `renewalStatus`, `status` (`DRAFT|ACTIVE|EXPIRED|TERMINATED`).
- **Optional:** `effectiveDate`, `expiryDate`, `responsibleUserId`, `externalContact`, `meetingFrequencyMonths`, `archivedAt`.
- **Relationships:** `partnerOrg`, `responsibleUser`, `meetings`.
- **Validation:** `expiryDate >= effectiveDate`; expiry drives `AGREEMENT_EXPIRY` / `AGREEMENT_RENEWAL` alerts.

### AgreementMeeting
A meeting under an agreement.
- **Required:** `agreementId`, `status` (`SCHEDULED|HELD|MISSED|CANCELLED`).
- **Optional:** `scheduledDate`, `actualDate`, `minutes`, `decisions`, `nextMeetingDate`.
- **Validation:** overdue/upcoming states drive `MEETING_OVERDUE` / `MEETING_UPCOMING` alerts.

---

## 9. Compliance (configurable)

### ComplianceRequirement
A configurable requirement node (data, not code).
- **Required:** `code` (unique, e.g. `5.24.1`), `sectionCode` (e.g. `5.24`), `titleAr`, `version`, `isActive`.
- **Optional:** `description`, `parentId` (tree), `requiredFields` (Json), `requiredEvidenceTypes` (Json).
- **Relationships:** `parent`/`children` (self-tree), `evidenceLinks`, `naDeterminations` (ComplianceNA[]).
- **Ownership:** platform; managed by `compliance.configure`.
- **Validation:** `code` unique; JSON shapes validated (see `compliance-rules.md` §1).
- **Delta — per-requirement scoring config (correction #1):** the JSON now carries `requirementWeight`, per-field `weight` + `mandatoryGate` + `optional`, per-evidence `weight` + `mandatoryGate`, optional `sectionWeights`, and **`allowNA`** (when false, absence of a record is always a gap and N/A is forbidden). Add `sectionWeight?` and `gateCeiling?` (default 69). There is **no fixed 50/50 rule** — it is only an unverified fallback.

### ComplianceNA (delta — governed Not-Applicable determination, correction #1)
An audited exception marking a requirement N/A. **N/A is never automatic.**
- **Required:** `requirementId`, `reason`, `state` (`REQUESTED|APPROVED|REJECTED|REVOKED`), `requestedById`.
- **Optional:** `scopeRef` (Json — which records/scope the N/A applies to), `approvedById`, `approvedAt`, `revokedById`, `revokedAt`.
- **Validation:** only an **`APPROVED`** determination excludes the requirement from rollups; requester and approver may need to differ per policy; every state change writes `AuditLog`. Not permitted when the requirement's `allowNA = false`.

---

## 10. Evidence (polymorphic)

### Evidence
An uploaded evidence document. **Correction #3: file-processing and review statuses are SEPARATE fields — never one enum.**
- **Required:** `title`, `fileProcessingStatus` (delta: `UPLOADED|PROCESSING|EXTRACTION_READY|PROCESSING_FAILED`), `reviewStatus` (delta: `DRAFT|SUBMITTED|UNDER_REVIEW|APPROVED|REJECTED|ARCHIVED`), `verificationStatus`.
- **Optional:** `fileName`, `fileType`, `storagePath`, `version`, `uploadedById`, `checksum`, `notes`, `archivedAt`, `analysis` (0..1 DocumentAnalysis).
- **Relationships:** `uploadedBy`, `links` (EvidenceLink[]), `analysis` (DocumentAnalysis?).
- **Ownership:** uploader + the linked record's owner.
- **Validation:** at least one `EvidenceLink` before `reviewStatus` can be `APPROVED`; checksum recorded on upload; **`fileProcessingStatus = EXTRACTION_READY` does NOT imply `reviewStatus = APPROVED`** — approval is a separate human `evidence.approve` action. The current single `EvidenceStatus` enum is replaced by these two fields (see §12).

### EvidenceLink (polymorphic mapping)
Maps one evidence item to one target record and optionally a requirement.
- **Required:** `evidenceId`, `entityType` (`LinkedEntityType` enum whitelist), `entityId`.
- **Optional:** `requirementId`.
- **Validation:** unique `(evidenceId, entityType, entityId)`; `entityId` integrity is **application-enforced** (no DB FK) — must reference an existing record of `entityType`. See `compliance-rules.md` and `authorization.md`.

---

## 11. Alerts, notifications & audit

### Alert
A time/action obligation pointing to a record.
- **Required:** `type` (`AlertType`), `severity` (`INFO|WARNING|CRITICAL`), `status` (`OPEN|ACKNOWLEDGED|RESOLVED|DISMISSED`), `title`.
- **Optional:** `message`, `entityType`, `entityId`, `assignedToUserId`, `dueDate`, `resolvedAt`.
- **Validation:** deep-link target `(entityType, entityId)` must resolve; resolve requires `alert.resolve`.

### Notification
Per-user in-app message.
- **Required:** `userId`, `title`, `type` (`INFO|SUCCESS|WARNING|DANGER`), `read`.
- **Optional:** `message`.

### AuditLog (append-only)
Record of a significant action.
- **Required:** `action` (e.g. `CREATE|UPDATE|ARCHIVE|STATUS_CHANGE|APPROVE|REJECT|EXPORT|ROLE_CHANGE`).
- **Optional:** `actorUserId`, `entityType`, `entityId`, `summary`, `metadata` (Json).
- **Validation:** immutable; never updated or deleted.

---

## 12. Schema deltas required by the MVP journey (not yet in `schema.prisma`)

These are **documented for implementation**, not applied in this phase:

1. **Registration/approval status on `User`** — current `UserStatus` is `ACTIVE|INACTIVE|SUSPENDED`. Add `registrationStatus: PENDING|APPROVED|REJECTED` (+ `approvedById`/`approvedAt`). Needed for self-register → admin-approve.
2. **Idea status additions (correction #2)** — extend `IdeaStatus` with **`DRAFT`** and **`WITHDRAWN`**; full value set and per-transition actors in `status-definitions.md` §4.
3. **Evidence status split (correction #3)** — **replace** the single `EvidenceStatus` with two fields:
   - `Evidence.fileProcessingStatus`: `UPLOADED|PROCESSING|EXTRACTION_READY|PROCESSING_FAILED` (technical).
   - `Evidence.reviewStatus`: `DRAFT|SUBMITTED|UNDER_REVIEW|APPROVED|REJECTED|ARCHIVED` (governance).
4. **AI document analysis models (corrections #3, #9, #10)**:
   - `DocumentAnalysis` (id, evidenceId, format `PDF|DOCX|XLSX`, **status `QUEUED|PROCESSING|COMPLETED|FAILED`**, provider, model, extractorVersion, promptVersion?, processedAt, error?, timestamps).
   - `AnalysisSuggestion` (id, analysisId, kind, fieldKey?, suggestedValue, targetEntityType?, suggestedRequirementId?, confidence 0–1, **sourceRef** page/section/cell/textRange, **reviewOutcome `PENDING|ACCEPTED|EDITED|REJECTED`**, editedValue?, reviewedById?, reviewedAt?). Keeps AI output separate from confirmed values with full traceability.
5. **Compliance scoring config + N/A governance (correction #1)** — extend `ComplianceRequirement` JSON with `requirementWeight`, per-field/-evidence `weight`+`mandatoryGate`+`optional`, `sectionWeight?`, `gateCeiling?`, **`allowNA`**; add **`ComplianceNA`** model (governed Not-Applicable: reason + requester + approver + state + audit).
6. **Governance immutability (correction #8)** — additive fields on `IdeaDecision` (`supersedesId?`, `correctionOf?`, `reopenedFromId?`, `finalizedAt?`) and `ImpactMeasurement` (`supersedesId?`, `verifiedAt?`, `reopenReason?`) to support correction / superseding / documented reopening without overwrite.
7. **Report/export snapshot model (future)** — `ComplianceSnapshot` for historical exports (out of MVP; noted for continuity).

Each delta is additive/backward-compatible **except #3** (replacing the combined `EvidenceStatus` with two fields), which is a deliberate split. Sequencing is in `modules.md` and the sprint plan.
