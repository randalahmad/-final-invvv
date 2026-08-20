import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PREVIEW_INTAKE_LINKS, intakeLinksForPersona, PREVIEW_INTAKE_REFERENCE_SOLUTIONS } from "../src/modules/dga/preview-intake-links-fixture";
import { INTAKE_LINK_TYPES, INTAKE_LINK_STATUSES, INTAKE_RESPONSE_STATUSES, isIntakeLinkAcceptingResponses, getWorkspaceConfig, REQUIREMENT_WORKSPACES } from "../src/modules/dga/workspace-config";
import { getContributionDefinition } from "../src/modules/requirement-contributions/types";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
type Row = Record<string, unknown>;
const links = () => (PREVIEW_INTAKE_LINKS.intakeLinks as Row[]);

describe("5.23.3 requirement 05 intake links (proposals & feedback intake)", () => {
  it("defines the 5.23.3.5 workspace config as a repeatable JSON-only intakeLinks section — no new Prisma model", () => {
    const config = getWorkspaceConfig("5-23-3-r5")!;
    expect(config.code).toBe("5.23.3.5");
    const section = config.sections.find((s) => s.key === "intakeLinks")!;
    expect(section.repeatable).toBe(true);
    expect(section.fields.map((f) => f.key)).toEqual(["name", "purpose", "type", "relatedServiceName", "owningDepartment", "owner", "targetAudience", "startDate", "closeDate", "status", "participantDescription", "instructions"]);
    expect(section.fields.find((f) => f.key === "type")?.options).toEqual(INTAKE_LINK_TYPES);
    expect(section.fields.find((f) => f.key === "status")?.options).toEqual(INTAKE_LINK_STATUSES);
    expect(INTAKE_RESPONSE_STATUSES).toEqual(["جديد", "قيد المراجعة", "تم الإسناد", "تمت المعالجة", "مغلق", "غير قابل للتنفيذ"]);
  });

  it("reuses the exact same 5.23.3.5 requirement wired into the requirement registry only once", () => {
    expect(REQUIREMENT_WORKSPACES.filter((r) => r.requirementId === "5-23-3-r5")).toHaveLength(1);
  });

  it("isIntakeLinkAcceptingResponses is the single source of truth for whether a link accepts new responses, reused across public read/submit/UI", () => {
    expect(isIntakeLinkAcceptingResponses({ status: "نشط", closeDate: "" })).toBe(true);
    expect(isIntakeLinkAcceptingResponses({ status: "مسودة", closeDate: "" })).toBe(false);
    expect(isIntakeLinkAcceptingResponses({ status: "نشط", closeDate: "2020-01-01" })).toBe(false);
    expect(isIntakeLinkAcceptingResponses({ status: "نشط", closeDate: "2099-01-01" })).toBe(true);
    const intakeService = read("src/modules/dga/intake-service.ts");
    expect(intakeService).toContain("isIntakeLinkAcceptingResponses");
    const publicPage = read("src/app/feedback/[token]/page.tsx");
    expect(publicPage).toContain("getPublicIntake");
  });

  it("ships at least 3 isolated intake links with rich preview data (general / service-specific / employee-experience) per a different owning department each", () => {
    const rows = links();
    expect(rows.length).toBeGreaterThanOrEqual(3);
    expect(rows.map((r) => r.owningDepartment)).toEqual(["إدارة الابتكار والتحول الرقمي", "إدارة تجربة المستفيد", "إدارة الموارد البشرية"]);
    expect(rows[1].relatedServiceName).toBe(PREVIEW_INTAKE_REFERENCE_SOLUTIONS[0].nameAr);
  });

  it("never mixes responses across different intake links — each link's responses array is scoped to itself by distinct ids", () => {
    const rows = links();
    const allIds = rows.flatMap((r) => (r.responses as Row[]).map((resp) => resp.id));
    expect(new Set(allIds).size).toBe(allIds.length);
    // link 1 responses never appear under link 2/3 and vice versa
    const link1Ids = new Set((rows[0].responses as Row[]).map((r) => r.id));
    const link2Ids = (rows[1].responses as Row[]).map((r) => r.id);
    expect(link2Ids.every((id) => !link1Ids.has(id))).toBe(true);
  });

  it("demonstrates the full response-management lifecycle: new/under-review/assigned/processed/closed, one attachment, one anonymous, one assigned follow-up task, one completed", () => {
    const rows = links();
    const allResponses = rows.flatMap((r) => r.responses as Row[]);
    const statuses = new Set(allResponses.map((r) => r.status));
    for (const s of ["جديد", "قيد المراجعة", "تم الإسناد", "تمت المعالجة", "مغلق", "غير قابل للتنفيذ"]) expect(statuses.has(s)).toBe(true);
    expect(allResponses.some((r) => (r.attachments as unknown[]).length > 0)).toBe(true);
    expect(allResponses.some((r) => r.anonymous === true && !r.submitterName && !r.submitterEmail)).toBe(true);
    expect(allResponses.some((r) => (r.tasks as Row[]).some((t) => t.status !== "COMPLETED" && t.assignedUserId))).toBe(true);
    expect(allResponses.some((r) => (r.tasks as Row[]).some((t) => t.status === "COMPLETED" && t.completedAt))).toBe(true);
    expect(allResponses.every((r) => typeof r.receivedAt === "string" && !Number.isNaN(new Date(String(r.receivedAt)).getTime()))).toBe(true);
  });

  it("the public /feedback/[token] route lives outside the (app) auth-gated group and never imports requireUser/getAccessContext", () => {
    for (const path of ["src/app/feedback/[token]/page.tsx", "src/modules/dga/intake-service.ts", "src/modules/dga/intake-actions.ts"]) {
      const content = read(path);
      expect(content).not.toContain('from "@/server/authz"');
    }
  });

  it("the public token is submission-only — the public form component never renders a responses table, dashboard, or internal data", () => {
    const form = read("src/modules/dga/components/public-intake-form.tsx");
    expect(form).not.toContain("جدول الردود");
    expect(form).not.toContain("ownerUserId");
    expect(form).not.toContain("internalNotes");
    expect(form).toContain("إرسال");
  });

  it("the respondent is never treated as a contributor — the public intake path never imports the contribution system", () => {
    const service = read("src/modules/dga/intake-service.ts");
    const actions = read("src/modules/dga/intake-actions.ts");
    expect(service).not.toContain('from "@/modules/requirement-contributions');
    expect(actions).not.toContain('from "@/modules/requirement-contributions');
    expect(actions).not.toContain('from "./service"'); // never imports the contribution service module
    // the contribution system is still reused, but only to document the requirement itself (section linkDocumentation/evidence)
    const definition = getContributionDefinition("5-23-3-r5")!;
    expect(definition.sections).toEqual(["linkDocumentation", "evidence"]);
  });

  it("reuses the existing evidence storage/validateFile pipeline for response attachments instead of a second storage system", () => {
    const service = read("src/modules/dga/intake-service.ts");
    expect(service).toContain("validateFile");
    expect(service).toContain("buildEntityEvidenceKey");
    expect(service).toContain("getStorage");
    expect(service).toContain("intake-responses");
  });

  it("does not create a second task system — follow-up delegation upserts onto the existing RequirementTask via a scoped sourceKey", () => {
    const workspaceService = read("src/modules/dga/workspace-service.ts");
    expect(workspaceService).toContain("syncIntakeResponseTasks");
    expect(workspaceService).toContain("intake-response:${linkId}:${responseId}");
    expect(workspaceService).toContain("requirementTask.upsert");
  });

  it("protects response attachment downloads behind authentication and the requesting assignment's own scope, mirroring the existing evidence download route", () => {
    const route = read("src/app/api/intake-responses/[assignmentId]/[linkId]/[responseId]/[attachmentIndex]/download/route.ts");
    expect(route).toContain("getAccessContext");
    expect(route).toContain("workspace.assignment.id !== params.assignmentId");
    expect(route).toContain("findResponseAttachment");
  });

  it("does not silently expose PII to the viewer persona and hides all response data from the partner persona by default", () => {
    const viewerData = intakeLinksForPersona("viewer");
    const viewerResponses = (viewerData.intakeLinks as Row[]).flatMap((l) => l.responses as Row[]);
    expect(viewerResponses.every((r) => r.submitterName === null && r.submitterEmail === null)).toBe(true);
    const partnerData = intakeLinksForPersona("partner");
    expect(partnerData.intakeLinks).toEqual([]);
    const component = read("src/modules/dga/components/intake-links-workspace.tsx");
    expect(component).toContain('restrictedPartner ? tabs.filter((t) => !["جدول الردود", "سجل النشاط"].includes(t))');
    expect(component).toContain("maskPii");
  });

  it("links a response/link to an existing service or solution by reference only, never creating a duplicate solution record", () => {
    const component = read("src/modules/dga/components/intake-links-workspace.tsx");
    expect(component).toContain("solutionOptions");
    expect(component).not.toContain("createSolution");
    const requirementRoute = read("src/modules/dga/components/requirement-route.tsx");
    expect(requirementRoute).toContain("listSolutionsInScope");
  });

  it("does not build a general-purpose form builder — form field configuration is a lightweight fixed preset toggle list", () => {
    const component = read("src/modules/dga/components/intake-links-workspace.tsx");
    expect(component).toContain("DEFAULT_FORM_FIELDS");
    expect(component).toContain("FormFieldsTab");
    expect(component).not.toContain("addCustomField");
  });

  it("computes a factual, non-AI basic summary per link — no invented sentiment or satisfaction scores", () => {
    const component = read("src/modules/dga/components/intake-links-workspace.tsx");
    expect(component).toContain("ملخص أساسي");
    expect(component).toContain("أعداد فعلية فقط — بلا تحليل مشاعر أو درجات رضا مُختلقة");
    expect(component).not.toContain("sentiment");
  });

  it("readiness never invents a minimum response-count threshold or claims DGA-official approval", () => {
    const component = read("src/modules/dga/components/intake-links-workspace.tsx");
    expect(component).toContain("دون درجة مُخترعة أو حد أدنى مفروض لعدد الردود");
    expect(component).toContain("لا يمثل اعتمادًا رسميًا من هيئة الحكومة الرقمية");
  });

  it("does not implement any AI/sentiment/auto-classification logic anywhere in the R05 surface", () => {
    for (const path of [
      "src/modules/dga/intake-service.ts",
      "src/modules/dga/intake-actions.ts",
      "src/modules/dga/components/intake-links-workspace.tsx",
      "src/modules/dga/components/public-intake-form.tsx",
    ]) {
      const content = read(path).toLowerCase();
      expect(content).not.toContain("openai");
      expect(content).not.toContain("anthropic");
      expect(content).not.toContain("sentiment");
      expect(content).not.toContain("classify");
    }
  });

  it("audit covers link lifecycle, response lifecycle, and task delegation with Arabic labels reusing the existing audit infrastructure", () => {
    const audit = read("src/server/audit.ts");
    for (const key of ["INTAKE_LINK_CREATED", "INTAKE_LINK_UPDATED", "INTAKE_LINK_STATUS_CHANGED", "INTAKE_FORM_CONFIG_UPDATED", "INTAKE_RESPONSE_RECEIVED", "INTAKE_RESPONSE_STATUS_CHANGED", "INTAKE_RESPONSE_OWNER_ASSIGNED", "INTAKE_RESPONSE_TASK_ASSIGNED", "INTAKE_RESPONSE_TASK_COMPLETED", "INTAKE_RESPONSE_CLOSED"]) expect(audit).toContain(key);
    const auditService = read("src/modules/audit/service.ts");
    expect(auditService).toContain('ACTION_LABELS.INTAKE_RESPONSE_RECEIVED="استلام رد عبر رابط الاستقبال"');
  });

  it("wires 5-23-3-r5 into the operational workspace, requirement route, my-tasks deep links, and unit-page preview exactly like requirements 01-04", () => {
    expect(read("src/modules/dga/components/operational-workspace.tsx")).toContain("IntakeLinksWorkspace");
    expect(read("src/app/(app)/my-tasks/page.tsx")).toContain("intake-response:");
    expect(read("src/modules/dga/components/unit-page.tsx")).toContain("intakeLinksForPersona");
  });
});
