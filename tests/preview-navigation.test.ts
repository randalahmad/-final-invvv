import { describe, expect, it } from "vitest";
import { navGroupsForPreviewPersona } from "@/config/navigation";
import { PREVIEW_PERSONA_PATHS, buildPreviewHref, canPreviewPersonaAccessPath, previewPersonaFromSearch, UX_PREVIEW_PERSONAS, type PreviewPersonaKey } from "@/lib/ux-preview";

const labelsFor = (persona: PreviewPersonaKey) => navGroupsForPreviewPersona(persona).flatMap((group) => group.items.map((item) => item.label));

describe("preview persona switching", () => {
  it("supports exactly the four product roles and defaults to internal", () => { expect(Object.keys(UX_PREVIEW_PERSONAS)).toEqual(["admin", "internal", "partner", "viewer"]); expect(previewPersonaFromSearch(null)).toBe("internal"); expect(previewPersonaFromSearch("unknown")).toBe("internal"); });
});

describe("DGA permission-aware navigation", () => {
  it("shows the five units and separated administration to admin", () => { expect(labelsFor("admin")).toEqual(["الرئيسية", "5.23.1 التوجه الاستراتيجي", "5.23.2 منهجيات الابتكار", "5.23.3 حوكمة وتفعيل الابتكار", "5.24.1 حصر الحلول الابتكارية", "5.24.2 قياس أثر الحلول", "التنبيهات", "التقارير / ملف الامتثال", "حسابي", "المستخدمون والصلاحيات", "سجل التدقيق", "إعدادات النظام"]); });
  it("shows all execution units without administration to internal", () => { const labels = labelsFor("internal"); expect(labels).toContain("5.24.2 قياس أثر الحلول"); expect(labels).not.toContain("المستخدمون والصلاحيات"); expect(labels).not.toContain("سجل التدقيق"); });
  it("limits partner to cooperation and shared-solution contexts", () => { expect(labelsFor("partner")).toEqual(["الرئيسية", "5.23.1 التوجه الاستراتيجي", "5.23.2 منهجيات الابتكار", "5.24.1 حصر الحلول الابتكارية", "حسابي"]); });
  it("limits viewer to published dashboard, reports and account", () => { expect(labelsFor("viewer")).toEqual(["الرئيسية", "التقارير / ملف الامتثال", "حسابي"]); });
  it("does not expose old generic modules as primary navigation", () => { const labels = labelsFor("admin"); for (const obsolete of ["بنك الابتكار", "التحديات", "الأدلة والوثائق", "الجهات والشركاء", "الاتفاقيات والتعاون"]) expect(labels).not.toContain(obsolete); });
});

describe("preview URL authority", () => {
  it.each(["admin", "internal", "partner", "viewer"] as const)("preserves %s in generated links", (persona) => { expect(buildPreviewHref("/reports", persona)).toBe(`/reports?previewRole=${persona}`); });
  it("hides unauthorized destinations rather than exposing dead routes", () => { expect(canPreviewPersonaAccessPath("internal", "/admin/users")).toBe(false); expect(canPreviewPersonaAccessPath("partner", "/impact")).toBe(false); expect(canPreviewPersonaAccessPath("viewer", "/strategy")).toBe(false); });
  it("allows every configured path for each persona", () => { for (const [persona, paths] of Object.entries(PREVIEW_PERSONA_PATHS) as [PreviewPersonaKey, readonly string[]][]) for (const path of paths) expect(canPreviewPersonaAccessPath(persona, path)).toBe(true); });
});
