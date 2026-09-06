import { expect, it } from "vitest";
import { deriveImpactSummary, PREVIEW_IMPACT_MEASUREMENTS, progressTowardTarget } from "../src/modules/impact/preview-data";

it("impact summary is derived only from recorded measurements", () => {
  const summary=deriveImpactSummary();
  expect(summary.measuredSolutions).toBe(1);
  expect(summary.awaitingMeasurement).toBe(1);
  expect(summary.beneficiaries).toBe(18400);
  expect(summary.costReduction).toBe(0);
  expect(summary.missingEvidence).toBe(1);
});

it("progress handles normal and inverse targets", () => {
  expect(progressTowardTarget(PREVIEW_IMPACT_MEASUREMENTS[0])).toBe(86);
  expect(progressTowardTarget({...PREVIEW_IMPACT_MEASUREMENTS[0],baseline:10,target:5,actual:5})).toBe(100);
  expect(progressTowardTarget({...PREVIEW_IMPACT_MEASUREMENTS[0],actual:null})).toBe(0);
});
