import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { annualPlanForPersona, PREVIEW_ANNUAL_PLAN } from "../src/modules/dga/preview-annual-plan-fixture";
import { getContributionDefinition } from "../src/modules/requirement-contributions/types";

const read = (path:string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("5.23.2 requirement 01 annual-plan workspace", () => {
  it("provides the two coherent preview scenarios", () => {
    const activities = PREVIEW_ANNUAL_PLAN.activities as Record<string, unknown>[];
    expect(activities).toHaveLength(2);
    expect(activities.map(item => item.type)).toEqual(["هاكاثون", "ورشة عمل"]);
    expect((activities[0].tasks as Record<string, unknown>[]).some(task => task.status === "OVERDUE")).toBe(true);
    expect((activities[0].deliverables as Record<string, unknown>[]).map(item => item.version)).toEqual([1, 2]);
    expect((activities[1].files as Record<string, unknown>[]).some(file => file.markedAsEvidence === "نعم")).toBe(false);
  });

  it("keeps requirement delegation distinct from activity tasks", () => {
    const definition = getContributionDefinition("5-23-2-r1");
    expect(definition?.sections).toEqual(["annualPlan", "activities"]);
    const service = read("src/modules/dga/workspace-service.ts");
    expect(service).toContain("syncAnnualPlanActivities");
    expect(service).toContain("tx.requirementTask.upsert");
    expect(service).toContain("activityId:activity.id");
  });

  it("removes private activity data before partner and viewer serialization", () => {
    const partner=(annualPlanForPersona("partner").activities as Record<string,unknown>[])[0];
    const viewer=(annualPlanForPersona("viewer").activities as Record<string,unknown>[])[0];
    expect(partner.participants).toEqual([]);expect(partner.log).toEqual([]);
    expect(viewer.participants).toEqual([]);expect(viewer.files).toEqual([]);expect(viewer.tasks).toEqual([]);
  });

  it("routes activity tasks from My Tasks to the exact activity context", () => {
    const page = read("src/app/(app)/my-tasks/page.tsx");
    expect(page).toContain("activityId=${task.activityId}#activity-tasks");
    expect(page).toContain("task.activity.nameAr");
  });

  it("uses one additive migration without destructive statements", () => {
    const migration = read("prisma/migrations/20260819210000_activity_requirement_tasks/migration.sql");
    expect(migration).toContain('ADD COLUMN "activityId"');
    expect(migration).toContain('ADD COLUMN "sourceKey"');
    expect(migration).not.toMatch(/DROP\s+(TABLE|COLUMN)/i);
  });

  it("exposes the required operational sections and closure guard", () => {
    const component = read("src/modules/dga/components/annual-plan-workspace.tsx");
    for (const label of ["الخطة والجدول الزمني", "الفريق والمسؤوليات", "المهام", "اللقاءات والاجتماعات", "المشاركون / المستفيدون", "الملفات والتصاميم", "المخرجات", "الأدلة والإغلاق", "سجل النشاط"]) expect(component).toContain(label);
    expect(component).toContain("لا يمكن إغلاق النشاط");
    expect(component).toContain("personaKey===\"viewer\"");
  });
});
