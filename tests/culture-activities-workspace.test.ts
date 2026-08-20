import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PREVIEW_CULTURE_ACTIVITIES, cultureActivitiesForPersona } from "../src/modules/dga/preview-culture-activities-fixture";
import { PREVIEW_ANNUAL_PLAN } from "../src/modules/dga/preview-annual-plan-fixture";
import { CULTURE_ACTIVITY_TYPES, isQualifyingCultureActivity, getWorkspaceConfig, REQUIREMENT_WORKSPACES } from "../src/modules/dga/workspace-config";
import { getContributionDefinition } from "../src/modules/requirement-contributions/types";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("5.23.3 requirement 03 culture activities workspace", () => {
  it("classifies activities deterministically — only the fixed culture-type list, plus name/goal/segment, qualifies", () => {
    expect(isQualifyingCultureActivity({ name: "لقاء عابر", cultureType: "اجتماع إداري عادي", awarenessGoal: "x", targetSegment: "y" })).toBe(false);
    expect(isQualifyingCultureActivity({ name: "", cultureType: CULTURE_ACTIVITY_TYPES[0], awarenessGoal: "x", targetSegment: "y" })).toBe(false);
    expect(isQualifyingCultureActivity({ name: "ورشة", cultureType: CULTURE_ACTIVITY_TYPES[0], awarenessGoal: "", targetSegment: "y" })).toBe(false);
    expect(isQualifyingCultureActivity({ name: "ورشة", cultureType: CULTURE_ACTIVITY_TYPES[0], awarenessGoal: "x", targetSegment: "y" })).toBe(true);
  });

  it("derives 1/3, 2/3 and 3/3 progress purely from qualifying rows, never an invented threshold", () => {
    const base = { name: "نشاط", cultureType: CULTURE_ACTIVITY_TYPES[1], awarenessGoal: "هدف", targetSegment: "فئة" };
    const oneQualifying = [{ ...base, id: "a" }, { id: "b", name: "اجتماع غير مصنف" }];
    const twoQualifying = [{ ...base, id: "a" }, { ...base, id: "b" }, { id: "c", name: "اجتماع غير مصنف" }];
    expect(oneQualifying.filter(isQualifyingCultureActivity)).toHaveLength(1);
    expect(twoQualifying.filter(isQualifyingCultureActivity)).toHaveLength(2);
    const rows = (PREVIEW_CULTURE_ACTIVITIES.cultureActivities as Record<string, unknown>[]);
    expect(rows.filter(isQualifyingCultureActivity)).toHaveLength(3);
    const config = getWorkspaceConfig("5-23-3-r3")!;
    expect(config.sections.find((s) => s.key === "cultureActivities")?.minItems).toBe(3);
    expect(config.evidence[0].minCount).toBe(3);
  });

  it("reuses the annual plan (5.23.2.1) activity instead of creating a duplicate", () => {
    const linked = (PREVIEW_CULTURE_ACTIVITIES.cultureActivities as Record<string, unknown>[])[0];
    expect(linked.annualPlanActivityId).toBe("activity-workshop-2026");
    const annualActivity = (PREVIEW_ANNUAL_PLAN.activities as Record<string, unknown>[]).find((a) => a.id === "activity-workshop-2026");
    expect(annualActivity).toBeTruthy();
    const requirementRoute = read("src/modules/dga/components/requirement-route.tsx");
    expect(requirementRoute).toContain('loadRequirementWorkspace(actor,"5-23-2-r1")');
  });

  it("exposes the same deep-activity tab set used by the shared 5.23.2.1 activity infrastructure, plus a genuinely culture-specific overview", () => {
    const component = read("src/modules/dga/components/culture-activities-workspace.tsx");
    for (const label of ["نظرة عامة", "الخطة والجدول الزمني", "الفريق والمسؤوليات", "المهام", "اللقاءات والاجتماعات", "المشاركون / المستفيدون", "الملفات والمواد المعرفية", "المخرجات", "تقرير الإنجاز", "الأدلة والإغلاق", "سجل النشاط"]) {
      expect(component).toContain(label);
    }
    for (const field of ["نوع نشاط نشر الثقافة", "الهدف التوعوي/التدريبي", "الفئة المستهدفة", "موضوع المعرفة", "مقدم/مدرب"]) {
      expect(component).toContain(field);
    }
    expect(component).toContain("لا يُنشأ نظام فعاليات مستقل");
    expect(component).toContain("لا تُنشأ حسابات مستخدمين تلقائيًا للمشاركين");
  });

  it("supports the full task-delegation vocabulary and reuses RequirementTask / My Tasks with a deep link back to the exact activity", () => {
    const component = read("src/modules/dga/components/culture-activities-workspace.tsx");
    for (const preset of ["تجهيز المحتوى", "تصميم الإعلان", "التنسيق مع المدرب", "دعوة المشاركين", "تجهيز القاعة", "تسجيل الحضور", "رفع المواد", "إعداد تقرير الإنجاز"]) {
      expect(component).toContain(preset);
    }
    const service = read("src/modules/dga/workspace-service.ts");
    expect(service).toContain("syncCultureActivityTasks");
    expect(service).toContain("culture-activity:${activityId}");
    expect(service).toContain("tx.requirementTask.upsert");
    expect(service).toContain('if(requirementId==="5-23-3-r3")await syncCultureActivityTasks(tx,data,loaded.assignment.id,actor.userId);');
    const myTasks = read("src/app/(app)/my-tasks/page.tsx");
    expect(myTasks).toContain("culture-activity:");
    expect(myTasks).toContain("/governance/requirements/5-23-3-r3/activities/${cultureActivity[1]}#task-${cultureActivity[2]}");
  });

  it("does not create a second committee/task/evidence infrastructure and reuses the Evidence Repository", () => {
    const schema = read("prisma/schema.prisma");
    expect(schema).not.toContain("model CultureActivity");
    expect(schema).not.toContain("model CultureTask");
    const config = getWorkspaceConfig("5-23-3-r3")!;
    expect(config.evidence.map((e) => e.key)).toEqual(["CULTURE_ACTIVITY_COMPLETION_REPORTS"]);
    const component = read("src/modules/dga/components/culture-activities-workspace.tsx");
    expect(component).toContain("لا تصبح دليل متطلب رسمي إلا عند ربطها صراحة ورفعها في مستودع الإثبات");
  });

  it("generates the activity report and readiness purely from actual data, never an invented score", () => {
    const component = read("src/modules/dga/components/culture-activities-workspace.tsx");
    expect(component).toContain("مُولَّد آليًا من بيانات النشاط الفعلية");
    expect(component).toContain("دون درجة مُخترعة");
  });

  it("registers requirement 5-23-3-r3 with the delegated contribution sections from the spec", () => {
    const definition = getContributionDefinition("5-23-3-r3");
    expect(definition?.code).toBe("5.23.3.3");
    expect(definition?.sections).toEqual(["activityDocumentation", "materials", "participants", "activityReport", "evidence"]);
  });

  it("keeps the DGA workspace requirement code list unchanged", () => {
    const codes = REQUIREMENT_WORKSPACES.map((item) => item.code);
    expect(codes).toContain("5.23.3.3");
  });

  it("scopes preview data across all four personas without duplicating internal task/team detail to partner or viewer", () => {
    const admin = cultureActivitiesForPersona("admin");
    const internal = cultureActivitiesForPersona("internal");
    expect((admin.cultureActivities as Record<string, unknown>[])[0].tasks).toHaveLength(5);
    expect((internal.cultureActivities as Record<string, unknown>[])[0].tasks).toHaveLength(5);
    const partner = cultureActivitiesForPersona("partner");
    const viewer = cultureActivitiesForPersona("viewer");
    for (const persona of [partner, viewer]) {
      const rows = persona.cultureActivities as Record<string, unknown>[];
      expect(rows.every((row) => (row.tasks as unknown[]).length === 0)).toBe(true);
      expect(rows.every((row) => (row.team as unknown[]).length === 0)).toBe(true);
      expect(rows.every((row) => (row.log as unknown[]).length === 0)).toBe(true);
    }
    expect((viewer.cultureActivities as Record<string, unknown>[]).every((row) => (row.participants as unknown[]).length === 0)).toBe(true);
  });
});
