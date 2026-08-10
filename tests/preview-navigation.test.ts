import { describe, expect, it } from "vitest";
import { navGroupsForPreviewPersona } from "@/config/navigation";
import { PREVIEW_PERSONA_PATHS, buildPreviewHref, canPreviewPersonaAccessPath, previewPersonaFromSearch, UX_PREVIEW_PERSONAS, type PreviewPersonaKey } from "@/lib/ux-preview";

const labelsFor=(persona:PreviewPersonaKey)=>navGroupsForPreviewPersona(persona).flatMap(group=>group.items.map(item=>item.label));
describe("preview persona switching",()=>{it("supports exactly four roles",()=>{expect(Object.keys(UX_PREVIEW_PERSONAS)).toEqual(["admin","internal","partner","viewer"]);expect(previewPersonaFromSearch(null)).toBe("internal");});});
describe("DGA permission-aware navigation",()=>{
  it("shows all five units to admin",()=>{const labels=labelsFor("admin");for(const code of ["5.23.1","5.23.2","5.23.3","5.24.1","5.24.2"])expect(labels.some(label=>label.startsWith(code))).toBe(true);});
  it("keeps administration away from internal",()=>{const labels=labelsFor("internal");expect(labels.some(label=>label.includes("المستخدمون"))).toBe(false);expect(labels.some(label=>label.startsWith("5.24.2"))).toBe(true);});
  it("limits partner to cooperation and shared solution/impact contexts",()=>{const labels=labelsFor("partner");expect(labels.some(label=>label.startsWith("5.24.1"))).toBe(true);expect(labels.some(label=>label.startsWith("5.24.2"))).toBe(true);expect(labels.some(label=>label.startsWith("5.23.3"))).toBe(false);});
  it("limits viewer to published solution/impact and reporting contexts",()=>{const labels=labelsFor("viewer");expect(labels.some(label=>label.startsWith("5.24.1"))).toBe(true);expect(labels.some(label=>label.startsWith("5.24.2"))).toBe(true);expect(labels.some(label=>label.startsWith("5.23.1"))).toBe(false);});
});
describe("preview URL authority",()=>{
  it.each(["admin","internal","partner","viewer"] as const)("preserves %s in links",persona=>expect(buildPreviewHref("/reports",persona)).toBe(`/reports?previewRole=${persona}`));
  it("enforces configured destinations",()=>{expect(canPreviewPersonaAccessPath("internal","/admin/users")).toBe(false);expect(canPreviewPersonaAccessPath("partner","/impact")).toBe(true);expect(canPreviewPersonaAccessPath("viewer","/strategy")).toBe(false);});
  it("allows every configured path",()=>{for(const [persona,paths] of Object.entries(PREVIEW_PERSONA_PATHS) as [PreviewPersonaKey,readonly string[]][])for(const path of paths)expect(canPreviewPersonaAccessPath(persona,path)).toBe(true);});
});
