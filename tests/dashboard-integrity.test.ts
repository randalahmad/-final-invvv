import { describe, expect, it } from "vitest";
import { DGA_TOTALS, DGA_UNITS } from "@/modules/dga/source-of-truth";

describe("DGA readiness shell", () => {
  it("contains exactly the five approved units", () => { expect(DGA_UNITS.map((unit) => unit.code)).toEqual(["5.23.1", "5.23.2", "5.23.3", "5.24.1", "5.24.2"]); });
  it("contains the approved requirement counts", () => { expect(DGA_UNITS.map((unit) => unit.requirements.length)).toEqual([3, 4, 5, 0, 0]); expect(DGA_TOTALS.requirements).toBe(12); });
  it("does not invent formal requirements for 5.24.1 or 5.24.2", () => { expect(DGA_UNITS[3].boundaryNote).toContain("لم تحدد المراجع"); expect(DGA_UNITS[4].boundaryNote).toContain("لم تحدد المراجع"); });
});
