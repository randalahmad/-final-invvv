import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";
import {getWorkspaceConfig} from "../src/modules/dga/workspace-config";
import {PREVIEW_WORKSPACE_DATA} from "../src/modules/dga/preview-workspace-fixtures";
import {auditActionLabel} from "../src/modules/audit/service";
import {CONTRIBUTION_SECTIONS,getContributionDefinition,REQUIREMENT_01_ID,REQUIREMENT_02_ID,REQUIREMENT_03_ID,SECTION_LABELS} from "../src/modules/requirement-contributions/types";

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

describe("5.23.1 Requirement 02 initiative collaboration",()=>{
  it("reuses the same contribution lifecycle for the three meaningful scopes",()=>{
    expect(REQUIREMENT_02_ID).toBe("5-23-1-r2");
    expect(getContributionDefinition(REQUIREMENT_02_ID)?.sections).toEqual(["initiatives","strategicAlignment","initiativeKpis"]);
  });
  it("keeps the workspace limited to initiatives, strategic alignment and KPIs",()=>{
    const config=getWorkspaceConfig(REQUIREMENT_02_ID)!;
    expect(config.sections.map(section=>section.key)).toEqual(["initiatives","strategicAlignment","initiativeKpis"]);
    expect(config.sections[0].fields.map(field=>field.key)).toEqual(["name","description","owningDepartment","owner","status","startDate","targetDate","lastUpdate"]);
  });
  it("presents initiative audit events with Arabic business labels",()=>{
    expect(auditActionLabel("INITIATIVE_RECORD_CREATED")).toBe("إنشاء سجل مبادرة");
    expect(auditActionLabel("INITIATIVE_OBJECTIVE_LINKED")).toBe("ربط مبادرة بهدف استراتيجي");
    expect(auditActionLabel("INITIATIVE_KPI_LINKED")).toBe("ربط مبادرة بمؤشر أداء");
  });
  it("uses Requirement 01 objectives and KPIs in the coherent preview scenario",()=>{
    const requirement01=PREVIEW_WORKSPACE_DATA[REQUIREMENT_01_ID];
    const requirement02=PREVIEW_WORKSPACE_DATA[REQUIREMENT_02_ID];
    const objective=(requirement01.strategicGoals as Array<Record<string,unknown>>)[0].name;
    const kpi=(requirement01.kpis as Array<Record<string,unknown>>)[0].name;
    expect((requirement02.initiatives as unknown[])).toHaveLength(3);
    expect((requirement02.strategicAlignment as Array<Record<string,unknown>>).some(row=>row.strategicObjective===objective)).toBe(true);
    expect((requirement02.initiativeKpis as Array<Record<string,unknown>>).some(row=>row.kpiName===kpi)).toBe(true);
  });
});

describe("5.23.1 Requirement 03 institutional cooperation",()=>{
  it("models cooperation as records with agreement, contacts and outputs",()=>{
    const config=getWorkspaceConfig(REQUIREMENT_03_ID)!;
    expect(config.sections.map(section=>section.key)).toEqual(["cooperations","partnerContacts","agreements","cooperationOutputs"]);
    expect(config.evidence[0].key).toBe("APPROVED_COOPERATION_AGREEMENT");
  });
  it("reuses scoped contributions for the four cooperation areas",()=>{
    expect(getContributionDefinition(REQUIREMENT_03_ID)?.sections).toEqual(["cooperations","partnerContacts","agreements","cooperationOutputs"]);
  });
  it("keeps preview cooperation connected to its agreement and evidence target",()=>{
    const preview=PREVIEW_WORKSPACE_DATA[REQUIREMENT_03_ID];
    expect((preview.cooperations as Array<Record<string,unknown>>)[0].partnerName).toBe("جامعة المجمعة");
    expect((preview.agreements as Array<Record<string,unknown>>)[0].cooperationName).toBe("جامعة المجمعة");
    expect((preview.cooperationOutputs as Array<Record<string,unknown>>).length).toBeGreaterThanOrEqual(2);
  });
  it("reuses CooperationAgreement and links the same evidence record",()=>{
    const service=readFileSync("src/modules/dga/workspace-service.ts","utf8");
    expect(service).toContain("tx.cooperationAgreement");
    expect(service).toContain('entityType:"COOPERATION_AGREEMENT"');
    expect(service).not.toContain("AI agreement");
  });
  it("presents cooperation audit events in Arabic",()=>{
    expect(auditActionLabel("COOPERATION_RECORD_CREATED")).toBe("إنشاء سجل تعاون");
    expect(auditActionLabel("COOPERATION_AGREEMENT_LINKED")).toBe("ربط اتفاقية بسجل التعاون");
    expect(auditActionLabel("COOPERATION_PRIMARY_CONTACT_CHANGED")).toBe("تغيير جهة الاتصال الرئيسية");
    expect(auditActionLabel("COOPERATION_CONTACT_ARCHIVED")).toBe("أرشفة جهة اتصال للشريك");
  });
  it("stores contacts separately from users with an additive migration",()=>{
    const schema=readFileSync("prisma/schema.prisma","utf8");
    const sql=readFileSync("prisma/migrations/20260819190000_cooperation_contacts/migration.sql","utf8");
    expect(schema).toContain("model CooperationContact");
    expect(schema).toMatch(/organization\s+Organization\s+@relation/);
    expect(schema.match(/model CooperationContact \{([\s\S]*?)\n\}/)?.[1]).not.toMatch(/\buser\s+User\b/);
    expect(sql).toContain('CREATE TABLE "cooperation_contacts"');
    expect(sql).not.toMatch(/DROP\s+(TABLE|COLUMN|TYPE)/i);
  });
  it("captures complete contact management fields without hard-coded roles",()=>{
    const contacts=getWorkspaceConfig(REQUIREMENT_03_ID)!.sections.find(section=>section.key==="partnerContacts")!;
    expect(contacts.fields.map(field=>field.key)).toEqual(["cooperationName","name","title","departmentName","organization","email","phone","role","isPrimary","notes","status"]);
    expect(contacts.fields.find(field=>field.key==="role")?.options).toBeUndefined();
    expect(contacts.fields.find(field=>field.key==="isPrimary")?.options).toEqual(["نعم","لا"]);
  });
  it("exposes explicit creation and invitation actions",()=>{
    const manager=readFileSync("src/modules/dga/components/cooperation-manager.tsx","utf8");
    expect(manager).toContain("إضافة جهة / علاقة تعاون");
    expect(manager).toContain("دعوة للمساهمة");
    expect(manager).toContain("لا يحصل الاتصال على وصول");
  });
});
