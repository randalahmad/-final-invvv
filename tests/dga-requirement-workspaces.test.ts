import { describe, expect, it } from "vitest";
import { REQUIREMENT_WORKSPACES } from "../src/modules/dga/workspace-config";
import { deriveOperationalStatus, missingWorkspaceFields, type WorkspaceData } from "../src/modules/dga/workspace-status";

function completeData(index:number):WorkspaceData { const config=REQUIREMENT_WORKSPACES[index]; return Object.fromEntries(config.sections.map(section=>[section.key,section.repeatable?Array.from({length:section.minItems??1},()=>Object.fromEntries(section.fields.map(field=>[field.key,field.type==="number"?1:"قيمة موثقة"]))):Object.fromEntries(section.fields.map(field=>[field.key,field.type==="number"?1:"قيمة موثقة"]))])); }

describe("DGA operational requirement workspaces",()=>{
  it("defines exactly the 12 approved Phase 2 requirements",()=>{expect(REQUIREMENT_WORKSPACES.map(item=>item.code)).toEqual(["5.23.1.1","5.23.1.2","5.23.1.3","5.23.2.1","5.23.2.2","5.23.2.3","5.23.2.4","5.23.3.1","5.23.3.2","5.23.3.3","5.23.3.4","5.23.3.5"]);});
  it.each(REQUIREMENT_WORKSPACES.map((item,index)=>[item.code,index] as const))("%s exposes structured fields and evidence",(_code,index)=>{const config=REQUIREMENT_WORKSPACES[index];expect(config.sections.length).toBeGreaterThan(0);expect(config.evidence.length).toBeGreaterThan(0);expect(missingWorkspaceFields(config,{})).not.toHaveLength(0);});
  it("derives the four operational statuses deterministically",()=>{const config=REQUIREMENT_WORKSPACES[0];const complete=completeData(0);expect(deriveOperationalStatus(config,{},{})).toBe("NOT_STARTED");expect(deriveOperationalStatus(config,{strategy:{innovationAreas:"قيمة"}},{})).toBe("IN_PROGRESS");expect(deriveOperationalStatus(config,complete,{})).toBe("AWAITING_EVIDENCE");expect(deriveOperationalStatus(config,complete,{DIGITAL_TRANSFORMATION_STRATEGY:1})).toBe("COMPLETED");});
  it("enforces the source minimums for brainstorming, quarterly meetings, and culture reports",()=>{expect(REQUIREMENT_WORKSPACES.find(x=>x.code==="5.23.2.2")?.sections.find(x=>x.key==="brainstormingSessions")?.minItems).toBe(2);expect(REQUIREMENT_WORKSPACES.find(x=>x.code==="5.23.2.4")?.sections.find(x=>x.key==="meetings")?.minItems).toBe(4);expect(REQUIREMENT_WORKSPACES.find(x=>x.code==="5.23.3.3")?.evidence[0].minCount).toBe(3);});
});
