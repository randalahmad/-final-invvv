import { describe, it, expect } from "vitest";

import {
  scoreRequirement,
  weightedRollup,
  readinessBand,
  type ScoredFieldItem,
  type ScoredEvidenceItem,
} from "@/modules/compliance/scoring";
import { evaluateFieldRule, isPresent } from "@/modules/compliance/rules";

const field = (o: Partial<ScoredFieldItem> & { key: string }): ScoredFieldItem => ({
  label: o.key,
  weight: 1,
  mandatoryGate: false,
  optional: false,
  satisfied: true,
  reason: null,
  ...o,
});
const ev = (o: Partial<ScoredEvidenceItem> & { key: string }): ScoredEvidenceItem => ({
  label: o.key,
  weight: 1,
  minCount: 1,
  have: 1,
  mandatoryGate: false,
  satisfied: true,
  ...o,
});

describe("scoreRequirement — invariants", () => {
  it("all satisfied fields + evidence → 100, never above", () => {
    const s = scoreRequirement({
      requirementWeight: 1,
      gateCeiling: 69,
      fields: [field({ key: "a", weight: 2 })],
      evidence: [ev({ key: "E", weight: 2 })],
    });
    expect(s.estimatedReadiness).toBe(100);
    expect(s.band).toBe("READY");
    expect(s.gated).toBe(false);
  });

  it("blend is DERIVED from item weights, not a fixed 50/50", () => {
    // fields weight 3 (satisfied) + evidence weight 1 (unmet) → 75, not 50.
    const s = scoreRequirement({
      requirementWeight: 1,
      gateCeiling: 69,
      fields: [field({ key: "a", weight: 3, satisfied: true })],
      evidence: [ev({ key: "E", weight: 1, have: 0, satisfied: false })],
    });
    expect(s.estimatedReadiness).toBe(75);
    expect(s.blend.fields).toBeCloseTo(0.75, 4);
    expect(s.blend.evidence).toBeCloseTo(0.25, 4);
  });

  it("an unmet mandatory gate caps the score at gateCeiling, however complete the rest", () => {
    const s = scoreRequirement({
      requirementWeight: 1,
      gateCeiling: 69,
      fields: [field({ key: "a", weight: 9, satisfied: true })],
      evidence: [ev({ key: "E", weight: 1, have: 0, satisfied: false, mandatoryGate: true })],
    });
    expect(s.rawReadiness).toBe(90);
    expect(s.estimatedReadiness).toBe(69); // capped
    expect(s.gated).toBe(true);
    expect(s.blockedByMandatory).toHaveLength(1);
    expect(s.blockedByMandatory[0]).toMatchObject({ key: "E", kind: "EVIDENCE" });
  });

  it("optional criteria NEVER affect the score and never compensate a gate", () => {
    // A large unsatisfied OPTIONAL field must not lower a fully-satisfied requirement.
    const s = scoreRequirement({
      requirementWeight: 1,
      gateCeiling: 69,
      fields: [
        field({ key: "req", weight: 2, satisfied: true }),
        field({ key: "opt", weight: 50, satisfied: false, optional: true }),
      ],
      evidence: [],
    });
    expect(s.estimatedReadiness).toBe(100);

    // And an optional satisfied item cannot lift a gated requirement above the ceiling.
    const gated = scoreRequirement({
      requirementWeight: 1,
      gateCeiling: 69,
      fields: [
        field({ key: "gate", weight: 1, satisfied: false, mandatoryGate: true }),
        field({ key: "opt", weight: 99, satisfied: true, optional: true }),
      ],
      evidence: [],
    });
    expect(gated.estimatedReadiness).toBeLessThanOrEqual(69);
    expect(gated.gated).toBe(true);
  });

  it("a requirement with no scored items is unconfigured (readiness 0)", () => {
    const s = scoreRequirement({ requirementWeight: 1, gateCeiling: 69, fields: [], evidence: [] });
    expect(s.unconfigured).toBe(true);
    expect(s.estimatedReadiness).toBe(0);
    expect(s.fieldsScore).toBeNull();
    expect(s.evidenceScore).toBeNull();
  });

  it("a single dimension collapses the blend onto itself (no phantom 50%)", () => {
    const fieldsOnly = scoreRequirement({
      requirementWeight: 1,
      gateCeiling: 69,
      fields: [field({ key: "a", weight: 1, satisfied: false })],
      evidence: [],
    });
    expect(fieldsOnly.estimatedReadiness).toBe(0);
    expect(fieldsOnly.blend).toEqual({ fields: 1, evidence: 0 });
  });

  it("gate ceiling can only lower, never raise (met-gate low score stays low)", () => {
    const s = scoreRequirement({
      requirementWeight: 1,
      gateCeiling: 69,
      fields: [field({ key: "a", weight: 1, satisfied: false })],
      evidence: [ev({ key: "E", weight: 1, have: 0, satisfied: false })],
    });
    expect(s.estimatedReadiness).toBe(0);
    expect(s.gated).toBe(false);
  });
});

describe("weightedRollup", () => {
  it("weights contributing items and drops excluded ones", () => {
    expect(
      weightedRollup([
        { weight: 2, readiness: 80, excluded: false },
        { weight: 1, readiness: 50, excluded: false },
      ]),
    ).toBe(70);
    // An excluded (unconfigured / approved-N/A) item does not change the rollup.
    expect(
      weightedRollup([
        { weight: 2, readiness: 80, excluded: false },
        { weight: 1, readiness: 50, excluded: false },
        { weight: 9, readiness: 0, excluded: true },
      ]),
    ).toBe(70);
  });

  it("returns null when nothing contributes", () => {
    expect(weightedRollup([])).toBeNull();
    expect(weightedRollup([{ weight: 1, readiness: 90, excluded: true }])).toBeNull();
  });
});

describe("readinessBand thresholds", () => {
  it("maps ranges per compliance-rules.md §2", () => {
    expect(readinessBand(0)).toBe("NOT_READY");
    expect(readinessBand(39)).toBe("NOT_READY");
    expect(readinessBand(40)).toBe("IN_PROGRESS");
    expect(readinessBand(69)).toBe("IN_PROGRESS");
    expect(readinessBand(70)).toBe("NEARLY_READY");
    expect(readinessBand(89)).toBe("NEARLY_READY");
    expect(readinessBand(90)).toBe("READY");
    expect(readinessBand(100)).toBe("READY");
  });
});

describe("evaluateFieldRule", () => {
  it("required: present vs absent", () => {
    expect(evaluateFieldRule("required", "x").satisfied).toBe(true);
    expect(evaluateFieldRule("required", "").satisfied).toBe(false);
    expect(evaluateFieldRule("required", null).satisfied).toBe(false);
    expect(evaluateFieldRule("required", 0).satisfied).toBe(true); // 0 is present
  });

  it("minLength:N", () => {
    expect(evaluateFieldRule("minLength:40", "short").satisfied).toBe(false);
    expect(evaluateFieldRule("minLength:5", "abcdef").satisfied).toBe(true);
    expect(evaluateFieldRule("minLength:5", null).satisfied).toBe(false);
  });

  it("min:N (numeric)", () => {
    expect(evaluateFieldRule("min:5", 4).satisfied).toBe(false);
    expect(evaluateFieldRule("min:5", 5).satisfied).toBe(true);
    expect(evaluateFieldRule("min:5", "7").satisfied).toBe(true);
  });

  it("optional always satisfied; unknown rule defaults to required", () => {
    expect(evaluateFieldRule("optional", null).satisfied).toBe(true);
    expect(evaluateFieldRule("weird-rule", null).satisfied).toBe(false);
    expect(evaluateFieldRule("weird-rule", "v").satisfied).toBe(true);
  });

  it("isPresent handles strings, numbers, arrays", () => {
    expect(isPresent("  ")).toBe(false);
    expect(isPresent("a")).toBe(true);
    expect(isPresent([])).toBe(false);
    expect(isPresent([1])).toBe(true);
    expect(isPresent(undefined)).toBe(false);
  });
});
