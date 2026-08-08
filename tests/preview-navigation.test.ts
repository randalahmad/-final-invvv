import { describe, expect, it } from "vitest";

import { navGroupsForPreviewPersona } from "@/config/navigation";
import {
  PREVIEW_PERSONA_PATHS,
  canPreviewPersonaAccessPath,
  previewPersonaFromSearch,
  UX_PREVIEW_PERSONAS,
  type PreviewPersonaKey,
} from "@/lib/ux-preview";

function labelsFor(persona: PreviewPersonaKey) {
  return navGroupsForPreviewPersona(persona).flatMap((group) => group.items.map((item) => item.label));
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
    expect(labels).toHaveLength(PREVIEW_PERSONA_PATHS.admin.length);
    expect(labels).toEqual(expect.arrayContaining(["قياس الأثر", "الأدلة والوثائق", "الجهات والشركاء", "الاتفاقيات والتعاون", "الإعدادات"]));
  });

  it("shows operational work but no administration to internal users", () => {
    const labels = labelsFor("internal");
    expect(labels).toEqual(expect.arrayContaining(["البرامج والفعاليات", "التحديات", "بنك الابتكار", "الحلول الابتكارية", "اللجان والتقييمات"]));
    expect(labels).not.toContain("المستخدمون والصلاحيات");
    expect(labels).not.toContain("سجل التدقيق");
  });

  it("keeps partner navigation intentionally minimal", () => {
    expect(labelsFor("partner")).toEqual(["لوحة العمل", "الحلول الابتكارية", "الأدلة والوثائق", "الجهات والشركاء", "الاتفاقيات والتعاون", "المهام والتنبيهات"]);
  });

  it("keeps viewer navigation read-oriented", () => {
    const labels = labelsFor("viewer");
    expect(labels).toEqual(["لوحة العمل", "الاستراتيجية والخطة السنوية", "البرامج والفعاليات", "الحلول الابتكارية", "الجاهزية والامتثال", "قياس الأثر", "التقارير"]);
    expect(labels).not.toContain("بنك الابتكار");
    expect(labels).not.toContain("المستخدمون والصلاحيات");
  });
});

describe("preview route guard", () => {
  it("redirects internal, partner, and viewer personas away from administration", () => {
    expect(canPreviewPersonaAccessPath("internal", "/admin/users/requests")).toBe(false);
    expect(canPreviewPersonaAccessPath("partner", "/admin/users")).toBe(false);
    expect(canPreviewPersonaAccessPath("viewer", "/audit")).toBe(false);
  });

  it("allows each persona's intended destinations", () => {
    expect(canPreviewPersonaAccessPath("admin", "/admin/users/requests")).toBe(true);
    expect(canPreviewPersonaAccessPath("internal", "/activities")).toBe(true);
    expect(canPreviewPersonaAccessPath("partner", "/solutions/preview-solution")).toBe(true);
    expect(canPreviewPersonaAccessPath("viewer", "/reports")).toBe(true);
  });

  it("allows admin to access every proposed preview destination", () => {
    for (const path of PREVIEW_PERSONA_PATHS.admin) expect(canPreviewPersonaAccessPath("admin", path)).toBe(true);
  });
});
