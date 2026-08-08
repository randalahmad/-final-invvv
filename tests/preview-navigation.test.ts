import { describe, expect, it } from "vitest";

import { navGroupsForPermissions } from "@/config/navigation";
import {
  permissionsForPreviewPersona,
  previewPersonaFromSearch,
  UX_PREVIEW_PERSONAS,
  type PreviewPersonaKey,
} from "@/lib/ux-preview";

function labelsFor(persona: PreviewPersonaKey) {
  return navGroupsForPermissions(permissionsForPreviewPersona(persona)).flatMap((group) => group.items.map((item) => item.label));
}

describe("preview persona switching", () => {
  it("defaults to the internal innovation officer", () => {
    expect(previewPersonaFromSearch(null)).toBe("internal");
  });

  it("accepts exactly the four configured personas", () => {
    expect(Object.keys(UX_PREVIEW_PERSONAS)).toEqual(["admin", "internal", "partner", "viewer"]);
    expect(previewPersonaFromSearch("partner")).toBe("partner");
    expect(previewPersonaFromSearch("unknown")).toBe("internal");
  });
});

describe("permission-aware navigation", () => {
  it("shows all implemented navigation to admin", () => {
    const labels = labelsFor("admin");
    expect(labels).toEqual(expect.arrayContaining(["الاستراتيجية والخطة السنوية", "بنك الابتكار", "المستخدمون والصلاحيات", "طلبات التسجيل", "سجل التدقيق"]));
  });

  it("shows operational work but no administration to internal users", () => {
    const labels = labelsFor("internal");
    expect(labels).toEqual(expect.arrayContaining(["البرامج والفعاليات", "التحديات", "بنك الابتكار", "الحلول الابتكارية", "اللجان والتقييمات"]));
    expect(labels).not.toContain("المستخدمون والصلاحيات");
    expect(labels).not.toContain("سجل التدقيق");
  });

  it("keeps partner navigation intentionally minimal", () => {
    expect(labelsFor("partner")).toEqual(["لوحة العمل", "الحلول الابتكارية"]);
  });

  it("keeps viewer navigation read-oriented", () => {
    const labels = labelsFor("viewer");
    expect(labels).toEqual(["لوحة العمل", "الحلول الابتكارية", "الجاهزية والامتثال", "المهام والتنبيهات", "التقارير"]);
    expect(labels).not.toContain("بنك الابتكار");
    expect(labels).not.toContain("المستخدمون والصلاحيات");
  });
});
