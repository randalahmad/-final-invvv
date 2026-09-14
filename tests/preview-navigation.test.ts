import { describe, expect, it } from "vitest";
import { navGroups, navGroupsForPreviewPersona } from "@/config/navigation";
import { PREVIEW_PERSONA_PATHS, buildPreviewHref, canPreviewPersonaAccessPath, previewPersonaFromSearch, UX_PREVIEW_PERSONAS, type PreviewPersonaKey } from "@/lib/ux-preview";

const labelsFor=(persona:PreviewPersonaKey)=>navGroupsForPreviewPersona(persona).flatMap(group=>group.items.map(item=>item.label));
describe("preview persona switching",()=>{it("supports the four operational roles and the preview-only innovator",()=>{expect(Object.keys(UX_PREVIEW_PERSONAS)).toEqual(["admin","internal","partner","viewer","innovator"]);expect(previewPersonaFromSearch(null)).toBe("internal");});});
describe("DGA permission-aware navigation",()=>{
  it("keeps the five DGA units and the available challenge and partner routes discoverable",()=>{const hrefs=navGroups.flatMap(group=>group.items.map(item=>item.href));for(const href of ["/strategy","/activities","/governance","/challenges","/partners","/solutions","/impact"])expect(hrefs).toContain(href);});
  it("shows all five human-readable units to admin without official codes",()=>{const labels=labelsFor("admin");for(const name of ["التوجه الاستراتيجي","منهجيات الابتكار","حوكمة وتفعيل الابتكار","حصر الحلول الابتكارية","قياس أثر الحلول"])expect(labels).toContain(name);expect(labels.some(label=>/5\.2[34]\./.test(label))).toBe(false);});
  it("keeps administration away from internal",()=>{const labels=labelsFor("internal");expect(labels.some(label=>label.includes("المستخدمون"))).toBe(false);expect(labels).toContain("قياس أثر الحلول");});
  it("keeps the evidence repository reachable for operational roles",()=>{for(const persona of ["admin","internal","partner"] as const)expect(PREVIEW_PERSONA_PATHS[persona]).toContain("/evidence-repository");expect(PREVIEW_PERSONA_PATHS.viewer).not.toContain("/evidence-repository");});
  it("limits partner to cooperation and shared solution/impact contexts",()=>{const labels=labelsFor("partner");expect(labels).toContain("حصر الحلول الابتكارية");expect(labels).toContain("قياس أثر الحلول");expect(labels).not.toContain("حوكمة وتفعيل الابتكار");});
  it("limits viewer to published solution/impact and reporting contexts",()=>{const labels=labelsFor("viewer");expect(labels).toContain("حصر الحلول الابتكارية");expect(labels).toContain("قياس أثر الحلول");expect(labels).not.toContain("التوجه الاستراتيجي");});
});
describe("preview URL authority",()=>{
  it.each(["admin","internal","partner","viewer"] as const)("preserves %s in links",persona=>expect(buildPreviewHref("/reports",persona)).toBe(`/reports?previewRole=${persona}`));
  it("enforces configured destinations",()=>{expect(canPreviewPersonaAccessPath("internal","/admin/users")).toBe(false);expect(canPreviewPersonaAccessPath("partner","/impact")).toBe(true);expect(canPreviewPersonaAccessPath("viewer","/strategy")).toBe(false);});
  it("allows every configured path",()=>{for(const [persona,paths] of Object.entries(PREVIEW_PERSONA_PATHS) as [PreviewPersonaKey,readonly string[]][])for(const path of paths)expect(canPreviewPersonaAccessPath(persona,path)).toBe(true);});
  it("exposes challenges and partnerships only to the relevant preview personas",()=>{expect(PREVIEW_PERSONA_PATHS.admin).toContain("/challenges");expect(PREVIEW_PERSONA_PATHS.internal).toContain("/challenges");expect(PREVIEW_PERSONA_PATHS.partner).not.toContain("/challenges");expect(PREVIEW_PERSONA_PATHS.innovator).not.toContain("/challenges");for(const persona of ["admin","internal","partner","viewer"] as const)expect(PREVIEW_PERSONA_PATHS[persona]).toContain("/partners");});
});
