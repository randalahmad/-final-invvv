import { describe, expect, it } from "vitest";
import { canTransition } from "../src/modules/governance-workflow/service";

describe("requirement governance workflow", () => {
  it("supports the amendment and resubmission loop", () => {
    expect(canTransition("UNDER_REVIEW", "RETURNED_FOR_AMENDMENT")).toBe(true);
    expect(canTransition("RETURNED_FOR_AMENDMENT", "RESUBMITTED")).toBe(true);
    expect(canTransition("RESUBMITTED", "PENDING_APPROVAL")).toBe(true);
    expect(canTransition("PENDING_APPROVAL", "APPROVED")).toBe(true);
  });

  it("rejects unsupported workflow shortcuts", () => {
    expect(canTransition("DRAFT", "APPROVED")).toBe(false);
    expect(canTransition("COMPLETED", "IN_PROGRESS")).toBe(false);
  });
});
