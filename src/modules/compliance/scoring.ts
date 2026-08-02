/**
 * Pure, deterministic compliance-readiness scoring. NO database, NO I/O.
 *
 * This module is the single source of the arithmetic in compliance-rules.md §2–3.
 * It receives ALREADY-EVALUATED items (satisfied/have counts resolved by the
 * service against real records + APPROVED evidence) and produces a per-requirement
 * readiness plus the weighted section/overall rollups.
 *
 * Invariants enforced here (see the memory note `compliance-optional-criteria-rules`):
 *  1. Optional criteria NEVER affect the score — excluded from both numerator and
 *     denominator; they never compensate for an unmet mandatory gate.
 *  2. An unmet mandatory gate caps the requirement at `gateCeiling` (default 69),
 *     regardless of how complete everything else is.
 *  3. Readiness can never exceed 100 or drop below 0.
 *  4. The fields-vs-evidence blend is DERIVED FROM ITEM WEIGHTS (data-driven) —
 *     there is no hard-coded 50/50; a 0.5/0.5 split is only reached as an
 *     explicit, flagged fallback when a dimension carries no weight information.
 *  5. Requirements with no configured scored items are `unconfigured` and are
 *     EXCLUDED from rollups (you cannot score what has no criteria) — surfaced
 *     visibly rather than silently counted as 0 or 100.
 */

export interface ScoredFieldItem {
  key: string;
  label: string;
  weight: number;
  mandatoryGate: boolean;
  optional: boolean;
  satisfied: boolean;
  reason: string | null;
}

export interface ScoredEvidenceItem {
  key: string;
  label: string;
  weight: number;
  minCount: number;
  have: number;
  mandatoryGate: boolean;
  satisfied: boolean;
}

export interface RequirementScoreInput {
  requirementWeight: number;
  gateCeiling: number;
  fields: ScoredFieldItem[];
  evidence: ScoredEvidenceItem[];
}

export interface BlockedItem {
  key: string;
  label: string;
  kind: "FIELD" | "EVIDENCE";
}

export interface RequirementScore {
  /** Final, gated, rounded readiness in [0,100]. */
  estimatedReadiness: number;
  /** Pre-gate readiness (for transparency in the gap report). */
  rawReadiness: number;
  /** Weighted satisfaction of required, non-optional fields (null when none). */
  fieldsScore: number | null;
  /** Weighted satisfaction of required evidence types (null when none). */
  evidenceScore: number | null;
  /** The derived blend weights actually applied (sum to 1 when both present). */
  blend: { fields: number; evidence: number };
  /** Unmet mandatory-gate items that cap the score. Empty when none. */
  blockedByMandatory: BlockedItem[];
  /** True when the gate ceiling was applied. */
  gated: boolean;
  /** True when the requirement has no scored (non-optional) items configured. */
  unconfigured: boolean;
  band: ReadinessBand;
}

export type ReadinessBand = "NOT_READY" | "IN_PROGRESS" | "NEARLY_READY" | "READY";

/** Presentation-only bands (compliance-rules.md §2). Always labelled "estimated". */
export function readinessBand(pct: number): ReadinessBand {
  if (pct >= 90) return "READY";
  if (pct >= 70) return "NEARLY_READY";
  if (pct >= 40) return "IN_PROGRESS";
  return "NOT_READY";
}

const clampPct = (n: number): number => Math.max(0, Math.min(100, n));
const sum = (ns: number[]): number => ns.reduce((a, b) => a + b, 0);

/**
 * Score a single requirement. Optional items are dropped up front so they can
 * never influence the weighting. A dimension with no positive weight contributes
 * nothing and yields a null sub-score; the blend then collapses onto the present
 * dimension (no 50/50 assumption). When BOTH dimensions are absent, the
 * requirement is `unconfigured` and reported as 0 (and excluded from rollups by
 * the caller).
 */
export function scoreRequirement(input: RequirementScoreInput): RequirementScore {
  const gateCeiling = clampPct(input.gateCeiling);

  // (1) Optional items never count toward the score.
  const scoredFields = input.fields.filter((f) => !f.optional && f.weight > 0);
  const scoredEvidence = input.evidence.filter((e) => e.weight > 0);

  const totalFieldWeight = sum(scoredFields.map((f) => f.weight));
  const totalEvidenceWeight = sum(scoredEvidence.map((e) => e.weight));

  const fieldsScore =
    totalFieldWeight > 0
      ? sum(scoredFields.filter((f) => f.satisfied).map((f) => f.weight)) / totalFieldWeight
      : null;
  const evidenceScore =
    totalEvidenceWeight > 0
      ? sum(scoredEvidence.filter((e) => e.satisfied).map((e) => e.weight)) / totalEvidenceWeight
      : null;

  // (4) Blend weights derived from the total item weight of each dimension.
  let wf = 0;
  let we = 0;
  if (fieldsScore !== null && evidenceScore !== null) {
    const total = totalFieldWeight + totalEvidenceWeight;
    wf = totalFieldWeight / total;
    we = totalEvidenceWeight / total;
  } else if (fieldsScore !== null) {
    wf = 1;
  } else if (evidenceScore !== null) {
    we = 1;
  }

  const unconfigured = fieldsScore === null && evidenceScore === null;

  const rawReadiness = unconfigured
    ? 0
    : clampPct(100 * (wf * (fieldsScore ?? 0) + we * (evidenceScore ?? 0)));

  // (2) Mandatory gates: any unmet gate caps the requirement at the ceiling.
  const blockedByMandatory: BlockedItem[] = [
    ...input.fields
      .filter((f) => f.mandatoryGate && !f.satisfied)
      .map((f) => ({ key: f.key, label: f.label, kind: "FIELD" as const })),
    ...input.evidence
      .filter((e) => e.mandatoryGate && !e.satisfied)
      .map((e) => ({ key: e.key, label: e.label, kind: "EVIDENCE" as const })),
  ];

  const gated = blockedByMandatory.length > 0;
  // (3) Clamp + round; the gate ceiling can only ever LOWER the score.
  const estimatedReadiness = gated
    ? Math.min(Math.round(rawReadiness), gateCeiling)
    : Math.round(rawReadiness);

  return {
    estimatedReadiness,
    rawReadiness: Math.round(rawReadiness),
    fieldsScore,
    evidenceScore,
    blend: { fields: Number(wf.toFixed(4)), evidence: Number(we.toFixed(4)) },
    blockedByMandatory,
    gated,
    unconfigured,
    band: readinessBand(estimatedReadiness),
  };
}

export interface RollupItem {
  weight: number;
  readiness: number;
  /** Excluded items (unconfigured, or approved-N/A) do not affect the rollup. */
  excluded: boolean;
}

/**
 * Weighted rollup of contributing items. Excluded items are dropped entirely
 * (an unconfigured requirement or an approved-N/A requirement neither helps nor
 * hurts). Returns null when nothing contributes (so callers can render "—").
 */
export function weightedRollup(items: RollupItem[]): number | null {
  const contributing = items.filter((i) => !i.excluded && i.weight > 0);
  if (contributing.length === 0) return null;
  const totalWeight = sum(contributing.map((i) => i.weight));
  if (totalWeight <= 0) return null;
  const weighted = sum(contributing.map((i) => i.weight * clampPct(i.readiness)));
  return Math.round(weighted / totalWeight);
}
