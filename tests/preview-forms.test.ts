import { describe, expect, it } from "vitest";

import { PREVIEW_FORM_KINDS } from "@/modules/ux-preview/preview-form";

describe("preview form coverage", () => {
  it("provides every major stakeholder-review form", () => {
    expect(PREVIEW_FORM_KINDS).toEqual(expect.arrayContaining(["activity", "challenge", "innovation", "solution", "committee", "impact", "evidence", "partner", "agreement", "user", "report"]));
  });
});
