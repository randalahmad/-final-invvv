import {describe,expect,it} from "vitest";import fs from "node:fs";import path from "node:path";
import {PREVIEW_GOVERNANCE_OPERATIONS,governanceOperationsForPersona} from "../src/modules/dga/preview-governance-operations-fixture";import {PREVIEW_COMMITTEE} from "../src/modules/dga/preview-committee-fixture";import {getContributionDefinition} from "../src/modules/requirement-contributions/types";import {getWorkspaceConfig,REQUIREMENT_WORKSPACES} from "../src/modules/dga/workspace-config";
const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),"utf8");
describe("5.23.3 requirement 02 governance operations activation",()=>{
 it("links every process, review, decision and performance report to committees from requirement 01, never a second list",()=>{
  const committeeIds=(PREVIEW_COMMITTEE.structures as Record<string,unknown>[]).map((s)=>s.committeeId);
  const process=(PREVIEW_GOVERNANCE_OPERATIONS.processes as Record<string,unknown>[])[0];
  expect(process.name).toBe("مراجعة واعتماد مبادرات الابتكار");
  expect((process.committeeIds as string[]).every((id)=>committeeIds.includes(id))).toBe(true);
  expect(process.committeeIds).toEqual(["preview-committee-innovation","preview-committee-technical"]);
  const review=(PREVIEW_GOVERNANCE_OPERATIONS.reviews as Record<string,unknown>[])[0];
  expect((review.committeeIds as string[]).every((id)=>committeeIds.includes(id))).toBe(true);
  const decision=(PREVIEW_GOVERNANCE_OPERATIONS.decisions as Record<string,unknown>[])[0];
  expect((decision.committeeIds as string[]).every((id)=>committeeIds.includes(id))).toBe(true);
  const report=(PREVIEW_GOVERNANCE_OPERATIONS.performanceReports as Record<string,unknown>[])[0];
  expect((report.committeeIds as string[]).every((id)=>committeeIds.includes(id))).toBe(true);
  const corrective=(PREVIEW_GOVERNANCE_OPERATIONS.correctiveActions as Record<string,unknown>[])[0];
  expect(committeeIds).toContain(corrective.committeeId);
 });
 it("reuses the existing 5.23.1.2 initiative instead of inventing a new one",()=>{
  const review=(PREVIEW_GOVERNANCE_OPERATIONS.reviews as Record<string,unknown>[])[0];
  const decision=(PREVIEW_GOVERNANCE_OPERATIONS.decisions as Record<string,unknown>[])[0];
  expect(review.relatedInitiative).toBe("مختبر تحسين رحلة المستفيد");
  expect(decision.relatedInitiative).toBe("مختبر تحسين رحلة المستفيد");
  const requirementRoute=read("src/modules/dga/components/requirement-route.tsx");
  expect(requirementRoute).toContain('loadRequirementWorkspace(actor,"5-23-3-r1")');
  expect(requirementRoute).toContain('loadRequirementWorkspace(actor,"5-23-1-r2")');
 });
 it("keeps partner and viewer payloads scoped while preserving the traceable admin/internal record",()=>{
  const admin=governanceOperationsForPersona("admin");
  expect((admin.tasks as unknown[]).length).toBeGreaterThan(0);
  expect((admin.log as unknown[]).length).toBeGreaterThan(0);
  for(const persona of ["partner","viewer"]){
   const scoped=governanceOperationsForPersona(persona);
   expect(scoped.tasks).toEqual([]);
   expect(scoped.log).toEqual([]);
   const corrective=(scoped.correctiveActions as Record<string,unknown>[])[0];
   expect(corrective.responsible).toBe("");
   expect(corrective.assignedUserId).toBe("");
  }
 });
 it("registers requirement 5-23-3-r2 with the contribution sections from the spec, excluding reviews", ()=>{
  const definition=getContributionDefinition("5-23-3-r2");
  expect(definition?.code).toBe("5.23.3.2");
  expect(definition?.sections).toEqual(["processes","policies","performanceReports","decisions","correctiveActions","evidence"]);
  expect(definition?.sections).not.toContain("reviews");
 });
 it("keeps the DGA workspace requirement code list unchanged and exposes the governance-process fields", ()=>{
  const codes=REQUIREMENT_WORKSPACES.map((item)=>item.code);
  expect(codes).toContain("5.23.3.2");
  const config=getWorkspaceConfig("5-23-3-r2")!;
  expect(config.sections.map((s)=>s.key)).toEqual(["processes","policies","reviews","decisions","correctiveActions","performanceReports"]);
  const processFields=config.sections.find((s)=>s.key==="processes")!.fields.map((f)=>f.key);
  for(const key of ["name","type","purpose","description","owner","department","approvalStatus"])expect(processFields).toContain(key);
 });
 it("syncs corrective actions and follow-up tasks into RequirementTask reusing the committee column, without new Prisma models",()=>{
  const service=read("src/modules/dga/workspace-service.ts");
  expect(service).toContain("syncGovernanceOperationsTasks");
  expect(service).toContain("governance-corrective:");
  expect(service).toContain("governance-task:");
  expect(service).toContain("tx.requirementTask.upsert");
  expect(service).toContain('if(requirementId==="5-23-3-r2")await syncGovernanceOperationsTasks(tx,data,loaded.assignment.id,actor.userId);');
  const schema=read("prisma/schema.prisma");
  expect(schema).not.toContain("model GovernanceOperation");
  expect(schema).not.toContain("model GovernanceProcess");
 });
 it("routes governance-operations tasks from My Tasks back into the requirement 02 workspace, not the committee page",()=>{
  const page=read("src/app/(app)/my-tasks/page.tsx");
  expect(page).toContain("governance-corrective:");
  expect(page).toContain("governance-task:");
  expect(page).toContain("#corrective-${governanceCorrective[2]}");
  expect(page).toContain("#task-${governanceTask[2]}");
 });
 it("exposes the full governance-operations tab set with no dead buttons and persona-scoped visibility",()=>{
  const component=read("src/modules/dga/components/governance-operations-workspace.tsx");
  for(const label of ["نظرة عامة","العمليات والإجراءات","السياسات والوثائق","المراجعات","القرارات","الإجراءات التصحيحية","تقارير الأداء","المهام","السجل"]){
   expect(component).toContain(`"${label}"`);
  }
  expect(component).toContain('personaKey === "viewer"');
  expect(component).toContain('personaKey === "partner"');
  expect(component).toContain("لا تُنشأ لجان جديدة من هذه المساحة");
  expect(component).toContain("إسناد متابعة");
 });
 it("does not duplicate Evidence Repository binaries and only declares governance-activation evidence rules",()=>{
  const config=getWorkspaceConfig("5-23-3-r2")!;
  expect(config.evidence.map((e)=>e.key)).toEqual(["COMMITTEE_ACTIVATION_DOCUMENTS","APPROVED_GOVERNANCE_POLICY"]);
  const component=read("src/modules/dga/components/governance-operations-workspace.tsx");
  expect(component).toContain("لا يُكرَّر هنا");
 });
});
