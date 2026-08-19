import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";
import {getWorkspaceConfig} from "../src/modules/dga/workspace-config";
import {auditActionLabel} from "../src/modules/audit/service";
import {CONTRIBUTION_SECTIONS,REQUIREMENT_01_ID,SECTION_LABELS} from "../src/modules/requirement-contributions/types";

describe("5.23.1 Requirement 01 section collaboration",()=>{
  it("limits delegation to the four approved institutional sections",()=>{
    expect(REQUIREMENT_01_ID).toBe("5-23-1-r1");
    expect(CONTRIBUTION_SECTIONS).toEqual(["innovationAreas","strategicGoals","kpis","alignment"]);
    expect(CONTRIBUTION_SECTIONS.map(key=>SECTION_LABELS[key])).toEqual(["مجالات الابتكار","الأهداف الاستراتيجية للبحث والابتكار","المؤشرات KPIs","المواءمة مع أهداف الجهة"]);
  });
  it("uses the existing Requirement 01 sections without creating project records",()=>{
    const config=getWorkspaceConfig(REQUIREMENT_01_ID)!;
    expect(config.sections.map(section=>section.key)).toEqual([...CONTRIBUTION_SECTIONS]);
    expect(config.sections.find(section=>section.key==="kpis")?.fields.map(field=>field.key)).toEqual(["name","definition","calculationMethod","baseline","target","measurementFrequency","dataSource","owner"]);
  });
  it("ships an additive, non-destructive migration with versioned submissions",()=>{
    const sql=readFileSync("prisma/migrations/20260819170000_requirement_section_contributions/migration.sql","utf8");
    expect(sql).toContain("requirement_section_contributions");
    expect(sql).toContain("requirement_section_submissions");
    expect(sql).toContain("contributionId_version_key");
    expect(sql).not.toMatch(/DROP\s+(TABLE|COLUMN|TYPE)/i);
  });
  it("presents contribution audit events with Arabic labels",()=>{
    expect(auditActionLabel("SECTION_CONTRIBUTION_ASSIGNED")).toBe("إسناد مساهمة قسم");
    expect(auditActionLabel("SECTION_CONTRIBUTION_RETURNED")).toBe("إعادة مساهمة للتعديل");
    expect(auditActionLabel("SECTION_CONTRIBUTION_ACCEPTED")).toBe("قبول مساهمة");
  });
});
