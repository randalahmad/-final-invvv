import { describe, expect, it } from "vitest";

import { PREVIEW_IDEA_SUBMISSIONS, PREVIEW_INTAKE_PAGES } from "@/modules/solutions/intake-preview-data";

describe("5.24.1 idea and solution intake preview", () => {
  it("contains the three intake-page examples", () => {
    expect(PREVIEW_INTAKE_PAGES.map((page) => page.name)).toEqual([
      "بوابة الابتكار العامة",
      "مقترحات تحسين الخدمات الرقمية",
      "أفكار موظفي الجهة",
    ]);
  });

  it("demonstrates the six requested review outcomes", () => {
    expect(PREVIEW_IDEA_SUBMISSIONS).toHaveLength(6);
    expect(PREVIEW_IDEA_SUBMISSIONS.map((row) => row.status)).toEqual(expect.arrayContaining([
      "قيد المراجعة",
      "يحتاج استكمال",
      "محالة للإدارة المختصة",
      "قيد التقييم",
      "مقبولة",
      "مكرر / موجود مسبقًا",
    ]));
  });
});
