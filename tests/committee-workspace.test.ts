import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { committeeForPersona, PREVIEW_COMMITTEE } from "../src/modules/dga/preview-committee-fixture";
import { getContributionDefinition } from "../src/modules/requirement-contributions/types";
import { REQUIREMENT_WORKSPACES } from "../src/modules/dga/workspace-config";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("5.23.3 requirement 01 committee governance-structure workspace", () => {
  it("provides a coherent preview committee with the required member categories", () => {
    const structures = PREVIEW_COMMITTEE.structures as Record<string, unknown>[];
    expect(structures.length).toBeGreaterThanOrEqual(3);
    expect(structures.map((s) => s.name)).toEqual(["لجنة الابتكار المؤسسي", "اللجنة التقنية", "وحدة الابتكار"]);
    expect(structures.every((s) => typeof s.committeeId === "string" && (s.committeeId as string).length > 0)).toBe(true);
    const structure = structures[0];
    expect(structure.name).toBe("لجنة الابتكار المؤسسي");
    const members = structure.members as Record<string, unknown>[];
    expect(members.map((m) => m.category)).toEqual(["موظف", "ممثل إدارة", "خبير", "طالب متطوع"]);
    expect(structure.decisionNumber).toBeTruthy();
    expect(structure.decisionDate).toBeTruthy();
    const tasks = structure.tasks as Record<string, unknown>[];
    expect(tasks.some((t) => t.status === "COMPLETED")).toBe(true);
    expect(tasks.some((t) => t.status === "IN_PROGRESS")).toBe(true);
  });

  it("redacts private member and task data for partner and viewer personas while keeping admin/internal intact", () => {
    const partner = (committeeForPersona("partner").structures as Record<string, unknown>[])[0];
    const viewer = (committeeForPersona("viewer").structures as Record<string, unknown>[])[0];
    for (const persona of [partner, viewer]) {
      const members = persona.members as Record<string, unknown>[];
      expect(members.every((m) => m.email === "" && m.phone === "")).toBe(true);
      expect(persona.tasks).toEqual([]);
      expect(persona.log).toEqual([]);
    }
    const admin = (committeeForPersona("admin").structures as Record<string, unknown>[])[0];
    expect((admin.tasks as unknown[]).length).toBeGreaterThan(0);
  });

  it("registers requirement 5-23-3-r1 as the sole source of truth via the structures section only", () => {
    const definition = getContributionDefinition("5-23-3-r1");
    expect(definition?.sections).toEqual(["structures"]);
    expect(definition?.code).toBe("5.23.3.1");
  });

  it("keeps the DGA workspace requirement code list unchanged and exposes committee-shaped fields", () => {
    const codes = REQUIREMENT_WORKSPACES.map((item) => item.code);
    expect(codes).toContain("5.23.3.1");
    const requirement = REQUIREMENT_WORKSPACES.find((item) => item.requirementId === "5-23-3-r1");
    expect(requirement).toBeTruthy();
    const fieldKeys = requirement!.sections.flatMap((section) => section.fields.map((f) => f.key));
    for (const key of ["name", "type", "purpose", "mandateDescription", "chairName", "decisionNumber", "decisionDate"]) {
      expect(fieldKeys).toContain(key);
    }
  });

  it("syncs committee, member, and task records into the relational Committee tables idempotently", () => {
    const service = read("src/modules/dga/workspace-service.ts");
    expect(service).toContain("syncCommitteeRecords");
    expect(service).toContain("tx.committee.");
    expect(service).toContain("tx.committeeMember.");
    expect(service).toContain("tx.requirementTask.upsert");
    expect(service).toContain("committeeId:committee.id");
  });

  it("routes committee tasks from My Tasks to the exact committee context", () => {
    const page = read("src/app/(app)/my-tasks/page.tsx");
    expect(page).toContain("governance/committees/${task.committeeId}#task-${task.id}");
    expect(page).toContain("task.committee.nameAr");
  });

  it("uses one additive migration without destructive statements", () => {
    const migration = read("prisma/migrations/20260820090000_committee_governance_structure/migration.sql");
    expect(migration).toContain('ADD COLUMN "sourceKey"');
    expect(migration).not.toMatch(/DROP\s+(TABLE|COLUMN)/i);
  });

  it("exposes the exact 7-tab committee workspace and persona-scoped tab visibility", () => {
    const component = read("src/modules/dga/components/committee-workspace.tsx");
    for (const label of ["نظرة عامة", "التشكيل والقرار", "الأعضاء", "الأدوار والمسؤوليات", "المهام", "الأدلة والوثائق", "السجل"]) {
      expect(component).toContain(`"${label}"`);
    }
    expect(component).toContain('personaKey === "viewer"');
    expect(component).toContain('personaKey === "partner"');
    expect(component).toContain("لا تُنشأ لجان مكررة من المتطلب 02");
  });

  it("keeps committee membership distinct from platform users and requirement contributors", () => {
    const component = read("src/modules/dga/components/committee-workspace.tsx");
    expect(component).toContain("عضو اللجنة ليس مستخدم منصة تلقائيًا");
    expect(component).toContain("مساهمو توثيق المتطلب منفصلون عن أعضاء الوحدة/اللجنة");
  });
});
