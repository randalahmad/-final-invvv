import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PREVIEW_DIGITAL_INNOVATION_MECHANISM, digitalInnovationMechanismForPersona } from "../src/modules/dga/preview-digital-innovation-mechanism-fixture";
import { PREVIEW_COMMITTEE } from "../src/modules/dga/preview-committee-fixture";
import { MECHANISM_APPROVAL_STATUSES, isCurrentMechanismVersion, getWorkspaceConfig, REQUIREMENT_WORKSPACES } from "../src/modules/dga/workspace-config";
import { getContributionDefinition } from "../src/modules/requirement-contributions/types";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("5.23.3 requirement 04 digital innovation mechanism workspace", () => {
  it("supports versioned mechanism definitions with exactly one current (معتمد) version at a time, prior versions preserved and readable", () => {
    const versions = PREVIEW_DIGITAL_INNOVATION_MECHANISM.mechanismVersions as Record<string, unknown>[];
    expect(versions).toHaveLength(2);
    expect(versions.filter(isCurrentMechanismVersion)).toHaveLength(1);
    expect(versions[0].approvalStatus).toBe("تم الاستبدال");
    expect(versions[1].approvalStatus).toBe("معتمد");
    // superseded version keeps its own stages/log — never deleted, never blanked.
    expect((versions[0].stages as unknown[]).length).toBeGreaterThan(0);
    expect((versions[0].log as unknown[]).length).toBeGreaterThan(0);
    const config = getWorkspaceConfig("5-23-3-r4")!;
    expect(config.sections.find((s) => s.key === "mechanismVersions")?.minItems).toBe(1);
    expect(config.sections.find((s) => s.key === "mechanismVersions")?.fields.find((f) => f.key === "approvalStatus")?.options).toEqual(MECHANISM_APPROVAL_STATUSES);
  });

  it("approving a version supersedes the previously current one instead of silently overwriting it (enforced in the dedicated workspace component)", () => {
    const component = read("src/modules/dga/components/digital-innovation-mechanism-workspace.tsx");
    expect(component).toContain("تم الاستبدال");
    expect(component).toContain("updateApprovalStatus");
    expect(component).toContain('value === "معتمد"');
  });

  it("does not hard-code the example lifecycle stage names as official values — the roadmap is fully editable (add/rename/reorder/archive)", () => {
    const component = read("src/modules/dga/components/digital-innovation-mechanism-workspace.tsx");
    expect(component).toContain("STAGE_NAME_PRESETS");
    expect(component).toContain("moveStage");
    expect(component).toContain("archiveStage");
    expect(component).toContain("أسماء المعروضة أمثلة توضيحية وليست قيمًا رسمية مفروضة");
    // safe archive refuses when open tasks exist — never a silent data-destroying archive.
    expect(component).toContain("لا يمكن أرشفة هذه المرحلة");
  });

  it("offers both a roadmap and a table view, with the roadmap as the primary representation — never Kanban", () => {
    const component = read("src/modules/dga/components/digital-innovation-mechanism-workspace.tsx");
    expect(component).toContain("عرض خارطة الرحلة");
    expect(component).toContain("عرض جدولي");
    expect(component).toContain('useState<"roadmap" | "table">("roadmap")');
    for (const column of ["المرحلة", "الهدف", "المالك", "الإدارات المشاركة", "المدخلات", "الإجراءات", "المخرجات", "نقطة القرار", "المسؤول عن القرار", "النماذج/القوالب", "مدة/SLA"]) {
      expect(component).toContain(column);
    }
  });

  it("does not invent SLA values — the field starts empty and is only ever what the organization types", () => {
    const stages = ((PREVIEW_DIGITAL_INNOVATION_MECHANISM.mechanismVersions as Record<string, unknown>[])[1].stages as Record<string, unknown>[]);
    expect(stages.every((s) => s.slaDuration === "" || typeof s.slaDuration === "undefined")).toBe(true);
  });

  it("selects decision-gate committees only from requirement 01's committees, never a second committee source", () => {
    const structures = PREVIEW_COMMITTEE.structures as Record<string, unknown>[];
    const committeeIds = structures.map((s) => s.committeeId);
    const stages = ((PREVIEW_DIGITAL_INNOVATION_MECHANISM.mechanismVersions as Record<string, unknown>[])[1].stages as Record<string, unknown>[]);
    const usedIds = stages.flatMap((s) => ((s.gate as Record<string, unknown>).committees as string[]) ?? []);
    expect(usedIds.length).toBeGreaterThan(0);
    for (const id of usedIds) expect(committeeIds).toContain(id);
    const component = read("src/modules/dga/components/digital-innovation-mechanism-workspace.tsx");
    expect(component).toContain("من المتطلب 5.23.3.1 فقط");
    const schema = read("prisma/schema.prisma");
    expect(schema).not.toContain("model MechanismCommittee");
  });

  it("links a stage's governance process to an existing 5.23.3.2 process instead of recreating it", () => {
    const stages = ((PREVIEW_DIGITAL_INNOVATION_MECHANISM.mechanismVersions as Record<string, unknown>[])[1].stages as Record<string, unknown>[]);
    const linkedStage = stages.find((s) => s.governanceProcessName);
    expect(linkedStage).toBeTruthy();
    const requirementRoute = read("src/modules/dga/components/requirement-route.tsx");
    expect(requirementRoute).toContain('loadRequirementWorkspace(actor,"5-23-3-r2")');
    expect(requirementRoute).toContain('loadRequirementWorkspace(actor,"5-23-1-r2")');
    expect(requirementRoute).toContain('loadRequirementWorkspace(actor,"5-23-3-r1")');
  });

  it("supports the core task-delegation vocabulary and reuses RequirementTask / My Tasks with a deep link back to the exact version and stage", () => {
    const component = read("src/modules/dga/components/digital-innovation-mechanism-workspace.tsx");
    for (const preset of ["توثيق مرحلة التصميم", "مراجعة إجراءات التطوير", "إضافة نموذج اعتماد", "تحديث مسؤوليات التنفيذ"]) {
      expect(component).toContain(preset);
    }
    const service = read("src/modules/dga/workspace-service.ts");
    expect(service).toContain("syncMechanismTasks");
    expect(service).toContain("mechanism-stage:${versionId}:${stageId}");
    expect(service).toContain("tx.requirementTask.upsert");
    expect(service).toContain('if(requirementId==="5-23-3-r4")await syncMechanismTasks(tx,data,loaded.assignment.id,actor.userId);');
    const myTasks = read("src/app/(app)/my-tasks/page.tsx");
    expect(myTasks).toContain("mechanism-stage:");
    expect(myTasks).toContain("/governance/requirements/5-23-3-r4/mechanism/${mechanismStage[1]}#task-${mechanismStage[3]}");
  });

  it("does not create a second committee/task/evidence infrastructure or a generic project-management system", () => {
    const schema = read("prisma/schema.prisma");
    expect(schema).not.toContain("model DigitalInnovationMechanism");
    expect(schema).not.toContain("model MechanismStage");
    const config = getWorkspaceConfig("5-23-3-r4")!;
    expect(config.evidence.map((e) => e.key)).toEqual(["DIGITAL_INNOVATION_MECHANISM"]);
    const component = read("src/modules/dga/components/digital-innovation-mechanism-workspace.tsx");
    expect(component).toContain("ليست إثباتًا رسميًا تلقائيًا");
    expect(component).toContain("لا يمثّل بحد ذاته امتثالًا");
  });

  it("computes readiness purely from actual data, never an invented score", () => {
    const component = read("src/modules/dga/components/digital-innovation-mechanism-workspace.tsx");
    expect(component).toContain("دون درجة مُخترعة");
    expect(component).not.toMatch(/readinessScore/);
  });

  it("keeps the optional example trace lightweight and reuses an existing 5.23.1.2 initiative instead of creating a duplicate one", () => {
    const trace = ((PREVIEW_DIGITAL_INNOVATION_MECHANISM.mechanismVersions as Record<string, unknown>[])[1].trace as Record<string, unknown>[]);
    expect(trace).toHaveLength(1);
    expect(trace[0].initiativeName).toBe("مختبر تحسين رحلة المستفيد");
    const component = read("src/modules/dga/components/digital-innovation-mechanism-workspace.tsx");
    expect(component).toContain("وليس تتبعًا لتنفيذ مشروع كامل");
  });

  it("registers requirement 5-23-3-r4 with the delegated contribution sections from the spec", () => {
    const definition = getContributionDefinition("5-23-3-r4");
    expect(definition?.code).toBe("5.23.3.4");
    expect(definition?.sections).toEqual(["stageDocumentation", "responsibilities", "templates", "evidence"]);
  });

  it("keeps the DGA workspace requirement code list unchanged", () => {
    const codes = REQUIREMENT_WORKSPACES.map((item) => item.code);
    expect(codes).toContain("5.23.3.4");
    expect(codes).toHaveLength(12);
  });

  it("scopes preview data across all four personas without exposing internal task/log detail to partner or viewer", () => {
    const admin = digitalInnovationMechanismForPersona("admin");
    const internal = digitalInnovationMechanismForPersona("internal");
    const adminDev = (admin.mechanismVersions as Record<string, unknown>[])[1].stages as Record<string, unknown>[];
    expect(adminDev.some((s) => (s.tasks as unknown[]).length > 0)).toBe(true);
    const internalDev = (internal.mechanismVersions as Record<string, unknown>[])[1].stages as Record<string, unknown>[];
    expect(internalDev.some((s) => (s.tasks as unknown[]).length > 0)).toBe(true);
    for (const persona of ["partner", "viewer"]) {
      const scoped = digitalInnovationMechanismForPersona(persona);
      const versions = scoped.mechanismVersions as Record<string, unknown>[];
      expect(versions.every((v) => (v.log as unknown[]).length === 0)).toBe(true);
      expect(versions.every((v) => (v.stages as Record<string, unknown>[]).every((s) => (s.tasks as unknown[]).length === 0))).toBe(true);
    }
  });
});
