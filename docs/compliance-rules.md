# Compliance Engine Rules — منصة إدارة الابتكار المؤسسي

How compliance readiness is computed. The engine is **configurable and data-driven**: DGA requirements are stored as `ComplianceRequirement` records, never hard-coded. Weights, gates, and criteria are configured **per requirement**. The MVP output is explicitly an **internal estimated readiness score** — not an official DGA score — until the authoritative DGA scoring methodology is confirmed.

**Non-negotiable principles**
1. Requirements are **data** (add / version / activate / deactivate / group without code changes).
2. Readiness is computed **only** from real records + **human-approved** evidence.
3. AI never sets readiness; a human confirms every evidence mapping first.
4. Every readiness figure is **explainable** (decomposable into satisfied / missing items with deep links).
5. The score is labelled **"مؤشر جاهزية تقديري (داخلي)" / "Estimated readiness (internal)"** everywhere it appears, until DGA methodology sign-off.

---

## 1. The configurable requirement model

There is **no fixed 50/50 rule.** Each `ComplianceRequirement` node configures its own scoring. Proposed configuration (stored as JSON on the requirement; validated with Zod on save under `compliance.configure`):

```jsonc
{
  "entityType": "INNOVATION_SOLUTION",   // record type this requirement inspects
  "requirementWeight": 2,                 // weight of THIS requirement within its section rollup (default 1)
  "fields": [
    { "key": "strategicObjectiveId", "label": "الهدف الاستراتيجي", "rule": "required", "weight": 2, "mandatoryGate": true },
    { "key": "owningDepartmentId",   "label": "الإدارة المالكة",    "rule": "required", "weight": 1, "mandatoryGate": true },
    { "key": "problemStatement",     "label": "وصف المشكلة",        "rule": "minLength:40", "weight": 1 },
    { "key": "notes",                "label": "ملاحظات إضافية",     "rule": "optional", "weight": 0, "optional": true }
  ],
  "evidenceTypes": [
    { "key": "APPROVAL_MEMO", "label": "محضر اعتماد", "min": 1, "weight": 2, "mandatoryGate": true },
    { "key": "IMPACT_REPORT", "label": "تقرير الأثر", "min": 1, "weight": 1 }
  ],
  "sectionWeights": { "fields": null, "evidence": null }  // OPTIONAL override; null = derive from item weights
}
```

Configurable elements (all per requirement):

| Element | Meaning |
|---|---|
| **requirementWeight** | How much this requirement counts in its section's rollup. |
| **required-field weights** | Each field contributes proportional to its `weight`. |
| **required-evidence weights** | Each evidence type contributes proportional to its `weight`. |
| **mandatoryGate** | A hard gate: if unmet, the requirement **cannot exceed a configured ceiling** (default: capped below "Ready", see §3) regardless of other scores. |
| **optional criteria** | `optional: true` / `weight: 0` items inform reviewers but never reduce the score. |
| **fields vs evidence split** | Derived from item weights by default; may be overridden per requirement via `sectionWeights`. **The old global 50/50 is only a fallback default when nothing is configured, and is flagged as unverified.** |

---

## 2. Readiness calculation (weighted, gated)

For an active requirement `R`:

```
fieldsScore   = Σ(weight of satisfied required, non-optional fields)   / Σ(weight of all required, non-optional fields)
evidenceScore = Σ(weight of satisfied required evidence types)         / Σ(weight of all required evidence types)

# fields/evidence blend: use configured sectionWeights if present, else derive from total item weights,
# else fall back to 0.5/0.5 (FLAGGED as an unverified default).
rawReadiness(R) = 100 × ( Wf·fieldsScore + We·evidenceScore )

# Mandatory gates:
if any mandatoryGate item is unmet:
    requirementReadiness(R) = min(rawReadiness(R), GATE_CEILING)   # GATE_CEILING default = 69 (cannot reach "Ready")
else:
    requirementReadiness(R) = round(rawReadiness(R))
```

- Evidence "satisfied" = a matching-classification `Evidence` linked to `R`, in **review status `APPROVED`**, whose file (if any) reached **`EXTRACTION_READY`** or was mapped manually. (Extraction success ≠ approval — see `status-definitions.md`.)
- Optional criteria never reduce a score; they appear as informational checklist items.

### Section rollup (weighted)
```
sectionReadiness(S) = Σ( requirementWeight(R) × requirementReadiness(R) ) / Σ( requirementWeight(R) )
                       over active, in-scope, non-approved-N/A requirements R in section S
```

### Overall readiness (weighted)
```
overallReadiness = Σ( sectionWeight(S) × sectionReadiness(S) ) / Σ( sectionWeight(S) )
```
`sectionWeight` defaults to 1 and is configurable. MVP may use equal section weights, but the mechanism must be weight-driven, not hard-coded.

### Readiness bands (presentation only — labelled "estimated")
| Band | Range | Meaning |
|---|---|---|
| غير جاهز / Not ready | 0–39% | Major gaps |
| قيد الإعداد / In progress | 40–69% | Partial (also the gate ceiling zone) |
| شبه جاهز / Nearly ready | 70–89% | Minor gaps |
| جاهز (تقديري) / Ready (estimated) | 90–100% | Evidence-complete, all gates met |

---

## 3. Mandatory gates vs optional criteria

- **Mandatory gate** (`mandatoryGate: true`): a field or evidence type that is *essential*. If unmet, the requirement is **capped at `GATE_CEILING` (default 69%)** and is reported as **"محجوب ببند إلزامي / blocked by a mandatory item"**, even if everything else is complete. This prevents a requirement from showing "Ready" while a critical item is missing.
- **Optional criteria** (`optional: true` or `weight: 0`): tracked and shown to reviewers, but never lower the score.
- Both the ceiling and which items are gates are **configuration**, not code.

---

## 4. N/A (Not Applicable) is a governed decision — never automatic

**A requirement is NOT classified N/A merely because no target record exists.** Absence of a record is, by default, a **gap** that lowers readiness. N/A is an explicit, audited exception.

### 4.1 N/A requires ALL of:
1. **A reason** (free text, mandatory).
2. **An authorized user** (holds `compliance.configure`; higher-privilege approver may be required by policy).
3. **Approval** — N/A is a *request → approval* action, not a self-serve toggle (proposer and approver may need to differ per policy).
4. **Audit history** — `AuditLog(COMPLIANCE_NA_REQUESTED)` and `AuditLog(COMPLIANCE_NA_APPROVED/REJECTED)` with actor + timestamp + reason.

### 4.2 Behaviour
- Only an **approved** N/A excludes a requirement from rollups (shown as "غير منطبق — معتمد / N/A — approved" with the reason and approver visible).
- A **pending** N/A request does **not** exclude the requirement; it still counts as a gap until approved.
- Some requirements are configured so that **absence of a record is always a gap and can never be N/A** (`allowNA: false` on the requirement). For these, "no record" = explicit missing item, never N/A.
- Revoking an N/A returns the requirement to normal scoring and is itself audited.

### 4.3 Requirement config additions
```jsonc
{ "allowNA": false }   // when false: absence of a record is a gap, N/A is not permitted for this requirement
```

---

## 5. Missing-information behaviour

Per requirement the engine emits a **gap report**:
```jsonc
{
  "requirement": "5.24.1",
  "estimatedReadiness": 62,
  "blockedByMandatory": ["APPROVAL_MEMO"],
  "missingFields":   [ { "key": "problemStatement", "label": "وصف المشكلة", "reason": "أقل من 40 حرفًا", "gate": false } ],
  "missingEvidence": [ { "key": "APPROVAL_MEMO", "label": "محضر اعتماد", "have": 0, "need": 1, "gate": true } ],
  "missingRecords":  [ { "note": "لا يوجد سجل حل مطابق — يُحتسب كنقص (غير مؤهل كـ N/A)" } ],
  "validationErrors":[ { "recordId": "sol_123", "message": "تاريخ الانتهاء قبل تاريخ البدء" } ],
  "naStatus": { "state": "NONE", "reason": null, "approvedBy": null },
  "sourceLinks":     [ { "entityType": "INNOVATION_SOLUTION", "entityId": "sol_123" } ]
}
```
Missing information renders as an actionable checklist with deep links; it never errors the page. "Absent record" appears as `missingRecords`, distinct from N/A.

---

## 6. Confidence handling (interaction with AI)
- AI confidence `∈ [0,1]` per suggestion (see `document-analysis.md`).
- **Confidence has zero effect on readiness.** Only human-approved mappings/values count.
- Below a configurable threshold (default `0.7`), values are flagged "يتطلب مراجعة" and cannot be bulk-accepted.

---

## 7. Human-approval requirements (hard gates)

| Action that moves readiness | Required human permission |
|---|---|
| Evidence counts toward a requirement | `evidence.approve` (review status → `APPROVED`) |
| Requirement definition / weights / gates / `allowNA` change | `compliance.configure` |
| N/A request | `compliance.configure` |
| N/A approval | authorized approver (per policy; audited) |
| Impact measurement treated as verified | `impact.verify` |
| Official export of the compliance package (future) | `compliance.export` |

No automated process (including AI) performs any of the above. Each writes an `AuditLog` entry.

---

## 8. Recomputation triggers
Readiness for a requirement recomputes when: a linked record's scored fields change; an `EvidenceLink` is added/removed or its evidence **review status** changes to/from `APPROVED`; the requirement's config changes (fields/evidence/weights/gates/`allowNA`/active/version); or an N/A state is approved/revoked. MVP computes readiness **on read** for correctness; caching may be added later behind the same interface.

---

## 9. On-screen compliance file (in MVP — see `mvp-scope.md` §2.7)
The compliance module MUST ship, in the MVP, an **on-screen compliance file** that shows, per requirement: estimated readiness, mandatory-gate status, missing data, missing evidence, missing records, N/A state (with reason/approver), validation errors, and **deep links to source records**. It MUST also provide a **print-friendly / basic exportable report** (e.g. print view or simple PDF/CSV). Advanced ZIP export-package generation and historical snapshots remain future scope.

---

## 10. Scoring assumptions (MUST be confirmed with KACARE/DGA)
1. Readiness is an **internal estimate** until DGA methodology is confirmed — labelled as such in the UI.
2. Weights (requirement / field / evidence / section) are **configuration**; any default (incl. the 50/50 fallback and the 69% gate ceiling) is unverified and flagged.
3. **Absence of a record is a gap by default**, not N/A; N/A is an approved, audited exception and can be disabled per requirement.
4. Only `APPROVED` evidence counts; impact-dependent requirements also require `VERIFIED` measurements.
5. The initial requirement set derives from the product presentation, not the authoritative DGA document.
6. Readiness reflects **current** state; trend/snapshots are future scope.

---

## 11. Configurability guarantees (acceptance)
- Admin can create/adjust a requirement's **weights, gates, optional criteria, and `allowNA`** with **no deploy**, and readiness reflects it.
- Deactivating a requirement removes it from rollups immediately.
- Versioning preserves prior versions for audit.
- No requirement code, weight, threshold, gate, or field list is embedded in TypeScript — all read from the database.
- The readiness label always communicates "estimated / internal" until DGA sign-off.
