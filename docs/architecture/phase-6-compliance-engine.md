# Phase 6 — Compliance Readiness Engine

A configurable, data-driven engine that computes an **internal estimated readiness** per compliance requirement from **real records + human-APPROVED evidence only**, rolls it up (weighted) to sections and overall, and renders an explainable on-screen **compliance file** per solution with a print view and a basic CSV export. It never sets readiness autonomously, never treats AI confidence as signal, and is labelled "estimated / internal" everywhere until DGA methodology sign-off.

Module: `src/modules/compliance/`. Uses the existing `ComplianceSection` / `ComplianceRequirement` / `RequirementFieldRule` / `RequirementEvidenceRule` / `ComplianceNA` / `ComplianceRequirementVersion` models — **no migration**.

---

## 1. Shape of the module

| File | Responsibility |
|---|---|
| `rules.ts` | **Pure** evaluation of one `RequirementFieldRule.rule` string (`required`, `minLength:N`, `min:N`, `optional`, unknown→required) against a value. No I/O. |
| `scoring.ts` | **Pure** arithmetic: `scoreRequirement`, `weightedRollup`, `readinessBand`. The single source of the compliance-rules.md §2–3 math. No I/O. |
| `schema.ts` | Arabic labels + bands + Zod validators (N/A request/decision, requirement/section config). |
| `service.ts` | DB-backed: `getComplianceFile`, `listComplianceOverview`, governed N/A (`requestNA`/`approveNA`/`rejectNA`/`revokeNA`), configuration (`upsertSection`/`upsertRequirementConfig`/`setRequirementActive`/`listRequirementConfig`). |
| `export.ts` | **Pure** CSV builder for the basic exportable report (BOM + CRLF; carries the estimated-internal banner). |
| `actions.ts` | Server actions for the N/A lifecycle (thin wrappers over the service). |
| `components/compliance-file.tsx` | The on-screen file (readiness bars, gaps, gates, optional criteria, N/A controls, deep links, print button, CSV button). |

Pages: `/compliance` (overview of internally-reachable solutions), `/solutions/[id]/compliance` (the file), `/solutions/[id]/compliance/export` (CSV route handler).

**The pure core is deliberately DB-free** so the scoring invariants are unit-tested in isolation, without a database.

## 2. What is scored, and against what

The compliance file is computed **per solution** (the MVP journey ties readiness to a solution's records + evidence). For each **active** requirement:

- **Fields** — each `RequirementFieldRule` reads a value from a whitelisted solution column (`SOLUTION_SELECT`) and is evaluated by `rules.ts`. Optional items (`optional: true`, `rule: "optional"`, or `weight: 0`) are tracked but never scored.
- **Evidence** — each `RequirementEvidenceRule` counts **APPROVED** `Evidence` whose `classification` equals the `evidenceTypeKey`, that is linked to **both** the solution (`EvidenceLink → INNOVATION_SOLUTION`) **and** the requirement (`EvidenceLink → COMPLIANCE_REQUIREMENT`). `have ≥ minCount` ⇒ satisfied.

**Only `reviewStatus = APPROVED` evidence counts** — the central Phase 5/6 invariant. Extraction status and AI confidence are irrelevant to readiness.

## 3. The math (all data-driven — no hard-coded 50/50)

For a requirement `R` (`scoring.ts::scoreRequirement`):

```
fieldsScore   = Σ(weight of satisfied non-optional fields)  / Σ(weight of non-optional fields)      (null if none)
evidenceScore = Σ(weight of satisfied evidence types)       / Σ(weight of evidence types)            (null if none)

# Blend Wf/We DERIVED from each dimension's total item weight:
Wf = ΣfieldWeight / (ΣfieldWeight + ΣevidenceWeight),  We = 1 − Wf
# One dimension absent ⇒ the blend collapses onto the present one (no phantom 50%).
rawReadiness = 100 × (Wf·fieldsScore + We·evidenceScore)

# Mandatory gates:
requirementReadiness = anyUnmetGate ? min(round(raw), gateCeiling) : round(raw)   # ceiling default 69
```

**Invariants enforced in code + unit-tested** (memory `compliance-optional-criteria-rules`):
1. Optional criteria never affect the score (dropped from numerator and denominator) and never compensate for an unmet gate.
2. An unmet mandatory gate caps the requirement at `gateCeiling` regardless of everything else; the ceiling can only *lower*, never raise.
3. Readiness is clamped to `[0,100]`.
4. The fields/evidence blend comes from item weights, not a constant.
5. A requirement with no scored items is `unconfigured` → **excluded** from rollups (surfaced as "غير مُهيّأ", never silently counted as 0 or 100).

**Rollups** (`weightedRollup`): section = Σ(reqWeight·reqReadiness)/Σ(reqWeight) over active, non-excluded requirements; overall = Σ(sectionWeight·sectionReadiness)/Σ(sectionWeight) over sections with ≥1 contributing requirement. Excluded = approved-N/A **or** unconfigured. Readiness is computed **on read** (compliance-rules.md §8); caching can be added later behind the same interface.

**Bands** (presentation only, always "تقديري"): <40 Not ready · 40–69 In progress · 70–89 Nearly ready · 90–100 Ready.

## 4. Governed N/A (never automatic)

Absence of a record is a **gap by default**. N/A is an explicit, audited exception on `ComplianceNA` scoped to `{ solutionId }`:

- `requestNA` requires the requirement to permit it (`allowNA = true`, else `NA_NOT_ALLOWED`) → state `REQUESTED`.
- `approveNA` / `rejectNA` (`REQUESTED →`) and `revokeNA` (`APPROVED →`) are the only transitions.
- **Only an APPROVED N/A excludes** the requirement from rollups; a pending request still counts as a gap.
- Every transition writes an `AuditLog` (`COMPLIANCE_NA_REQUESTED/APPROVED/REJECTED/REVOKED`).

MVP uses a single `compliance.configure` gate for both request and decision (audited); enforcing proposer≠approver separation is a policy-config follow-up.

## 5. Configuration (no deploy, versioned)

`upsertRequirementConfig` / `upsertSection` / `setRequirementActive` (all `compliance.configure` **+ platform scope**) let an admin add/adjust requirements, weights, gates, optional criteria, `allowNA`, and active state as **data**. Every requirement upsert **bumps `version`**, replaces the field/evidence rules atomically, and writes an immutable `ComplianceRequirementVersion` snapshot for audit. Deactivating a requirement removes it from rollups on the next read. **No requirement code, weight, threshold, gate, or field list lives in TypeScript.**

## 6. Authorization

Compliance **detail is internal-only** (MVP §5.10 — viewers must not reach raw compliance detail):

- `getComplianceFile` / export → `compliance.view` **+ solution scope + internal reach** (department/organization/platform). Partners (share) and viewers (published) resolve to `NOT_INTERNAL`; pages/route return 404 without distinguishing "forbidden" from "absent".
- CSV export additionally requires `compliance.export`; the attempt is audited (`COMPLIANCE_EXPORTED`).
- N/A + configuration require `compliance.configure`; configuration also requires platform scope.
- `listComplianceOverview` returns only internally-reachable solutions — viewers/partners get an empty list.

## 7. On-screen file + export

`/solutions/[id]/compliance` renders, per requirement: estimated readiness bar + band, mandatory-gate block reason, missing fields (with reasons) and missing evidence (`have/need`), optional criteria (informational), validation errors (e.g. end-date before start-date), N/A state + controls, and deep links to the solution and its evidence. A prominent Arabic banner states it is an **internal estimate, not an official DGA assessment**. A **print** button (print-clean layout) and a **CSV export** satisfy the "print-friendly / basic export" requirement; the bundled official ZIP package remains out of MVP scope.

## 8. Tests

- `tests/compliance-scoring.test.ts` — **15 pure** tests (no DB): gate ceiling caps, optional-never-affects (both directions), weight-derived blend (75% not 50%), clamp, unconfigured, single-dimension collapse, rollup exclusion/weighting, band thresholds, and the full field-rule grammar.
- `tests/compliance.test.ts` — **18 integration** tests against a disposable PostgreSQL with in-memory storage: versioned configuration + non-admin denial, gate-capped readiness, APPROVED-evidence lifts to ready, **only-APPROVED-counts** invariant, missing mandatory field, optional-informational, `minLength` failure, N/A request→approve→revoke (with rollup exclusion) + `allowNA=false` refusal + non-admin denial, internal-only authorization (viewer/partner/cross-department/in-department), overview scoping, CSV estimated-label, and immediate deactivation. **Full suite: 272 passing (was 239).**

## 9. Limitations & deferred

- Readiness is an **internal estimate**; weights/gates/ceiling/blend defaults are unverified pending DGA methodology (labelled throughout).
- Field rules read a **whitelisted set of solution columns**; requirements inspecting other entity types (e.g. an impact-measurement record) are represented via evidence rules or N/A, not per-field record inspection yet.
- N/A proposer≠approver **separation of duty** is not enforced (single `compliance.configure`); it is audited.
- Overview computes each solution's file **on read** (fine at pilot volume); no caching/materialisation yet.
- Export is **CSV + print** only; the bundled official ZIP package and historical/trend snapshots remain future scope.
- Dashboard integration (overall readiness tile) is not wired in this phase — the `/compliance` overview and per-solution file are the Phase 6 surfaces.
