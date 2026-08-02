import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";

import { prisma } from "@/server/db";
import { loadAccessContextByUserId, type AccessContext } from "@/server/access-context";
import { AuthorizationError } from "@/server/authorization";
import { MemoryStorageProvider, setStorageProvider } from "@/server/storage";
import { uploadEvidence, submitEvidence, startEvidenceReview, approveEvidence, linkEvidence } from "@/modules/evidence/service";
import {
  getComplianceFile,
  listComplianceOverview,
  upsertSection,
  upsertRequirementConfig,
  setRequirementActive,
  requestNA,
  approveNA,
  revokeNA,
  ComplianceError,
  type ComplianceFile,
  type RequirementFileEntry,
} from "@/modules/compliance/service";
import { buildComplianceCsv } from "@/modules/compliance/export";
import { ESTIMATED_LABEL } from "@/modules/compliance/schema";

const DEPT_A = "dept-digital";
const DEPT_B = "dept-strategy";
const PDF = "application/pdf";
const pdf = () => Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.from("b")]);
const FILE = () => ({ fileName: "memo.pdf", mimeType: PDF, bytes: pdf() });

const MAIN = "TST.MAIN"; // gated field + gated evidence, own section
const NAR = "TST.NA"; // allowNA=true, own section
const LONG_PROBLEM = "هذه مشكلة تشغيلية مفصّلة تتجاوز أربعين حرفًا لأغراض اختبار قاعدة الحد الأدنى للطول.";

let admin: AccessContext, editor: AccessContext, partner: AccessContext, viewer: AccessContext;
let adminId = "", partnerId = "";
let storage: MemoryStorageProvider;
let mainReqId = "", naReqId = "";

function entryByCode(file: ComplianceFile, code: string): RequirementFileEntry | undefined {
  for (const s of file.sections) {
    const e = s.requirements.find((r) => r.code === code);
    if (e) return e;
  }
  return undefined;
}

async function makeSolution(deptId: string, data: Record<string, unknown> = {}, opts: { published?: boolean } = {}) {
  const s = await prisma.innovationSolution.create({
    data: {
      nameAr: `حل امتثال ${Math.random().toString(36).slice(2, 8)}`,
      owningDepartmentId: deptId,
      source: "INTERNAL_PROPOSAL",
      status: opts.published ? "ACTIVE" : "DRAFT",
      publishedAt: opts.published ? new Date() : null,
      ...data,
    },
    select: { id: true },
  });
  return s.id;
}

async function shareTo(solutionId: string, actions: string[]) {
  await prisma.resourceShare.create({
    data: { userId: partnerId, entityType: "INNOVATION_SOLUTION", solutionId, allowedActions: actions, allowedFields: ["notes"], grantedById: adminId },
  });
}

/** Upload → link to a requirement → approve an evidence item of a classification. */
async function approvedEvidence(solutionId: string, classification: string, requirementId: string) {
  const { id } = await uploadEvidence(admin, solutionId, { title: "دليل امتثال", classification }, FILE());
  await linkEvidence(admin, id, { entityType: "COMPLIANCE_REQUIREMENT", entityId: requirementId, requirementId });
  await submitEvidence(admin, id);
  await startEvidenceReview(admin, id);
  await approveEvidence(admin, id);
  return id;
}

beforeAll(async () => {
  const [a, e, p, v] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { email: "admin@innovation.local" } }),
    prisma.user.findUniqueOrThrow({ where: { email: "editor@innovation.local" } }),
    prisma.user.findUniqueOrThrow({ where: { email: "partner@innovation.local" } }),
    prisma.user.findUniqueOrThrow({ where: { email: "viewer@innovation.local" } }),
  ]);
  adminId = a.id;
  partnerId = p.id;
  const ctxs = await Promise.all([a, e, p, v].map((u) => loadAccessContextByUserId(u.id)));
  if (ctxs.some((c) => !c)) throw new Error("seed principals missing");
  [admin, editor, partner, viewer] = ctxs as AccessContext[];

  // Isolated test configuration (each requirement in its own section so section
  // readiness equals the requirement readiness).
  await upsertSection(admin, { code: "TSTMAIN", titleAr: "قسم اختبار رئيسي", sectionWeight: 1, orderIndex: 90 });
  await upsertSection(admin, { code: "TSTNA", titleAr: "قسم اختبار عدم الانطباق", sectionWeight: 1, orderIndex: 91 });

  const main = await upsertRequirementConfig(admin, {
    code: MAIN,
    titleAr: "متطلب اختبار — حقول وأدلة إلزامية",
    sectionCode: "TSTMAIN",
    entityType: "INNOVATION_SOLUTION",
    requirementWeight: 1,
    gateCeiling: 69,
    allowNA: false,
    isActive: true,
    fields: [
      { fieldKey: "strategicObjectiveId", labelAr: "الهدف الاستراتيجي", rule: "required", weight: 2, mandatoryGate: true, optional: false },
      { fieldKey: "problemStatement", labelAr: "وصف المشكلة", rule: "minLength:40", weight: 1, mandatoryGate: false, optional: false },
      { fieldKey: "notes", labelAr: "ملاحظات", rule: "optional", weight: 0, mandatoryGate: false, optional: true },
    ],
    evidenceTypes: [{ evidenceTypeKey: "APPROVAL_MEMO", labelAr: "محضر اعتماد", minCount: 1, weight: 2, mandatoryGate: true }],
  });
  mainReqId = main.id;

  const na = await upsertRequirementConfig(admin, {
    code: NAR,
    titleAr: "متطلب اختبار — يسمح بعدم الانطباق",
    sectionCode: "TSTNA",
    entityType: "INNOVATION_SOLUTION",
    requirementWeight: 1,
    gateCeiling: 69,
    allowNA: true,
    isActive: true,
    fields: [],
    evidenceTypes: [{ evidenceTypeKey: "IMPACT_REPORT", labelAr: "تقرير الأثر", minCount: 1, weight: 1, mandatoryGate: false }],
  });
  naReqId = na.id;
});

afterAll(async () => {
  await prisma.complianceRequirement.deleteMany({ where: { code: { startsWith: "TST." } } });
  await prisma.complianceSection.deleteMany({ where: { code: { startsWith: "TST" } } });
});

beforeEach(() => {
  storage = new MemoryStorageProvider();
  setStorageProvider(storage);
});
afterEach(() => setStorageProvider(null));

describe("configuration (data-driven, versioned)", () => {
  it("1. upsert bumps version and keeps an immutable snapshot each time", async () => {
    const before = await prisma.complianceRequirementVersion.count({ where: { requirement: { code: MAIN } } });
    const res = await upsertRequirementConfig(admin, {
      code: MAIN,
      titleAr: "متطلب اختبار — حقول وأدلة إلزامية",
      sectionCode: "TSTMAIN",
      entityType: "INNOVATION_SOLUTION",
      requirementWeight: 1,
      gateCeiling: 69,
      allowNA: false,
      isActive: true,
      fields: [
        { fieldKey: "strategicObjectiveId", labelAr: "الهدف الاستراتيجي", rule: "required", weight: 2, mandatoryGate: true, optional: false },
        { fieldKey: "problemStatement", labelAr: "وصف المشكلة", rule: "minLength:40", weight: 1, mandatoryGate: false, optional: false },
        { fieldKey: "notes", labelAr: "ملاحظات", rule: "optional", weight: 0, mandatoryGate: false, optional: true },
      ],
      evidenceTypes: [{ evidenceTypeKey: "APPROVAL_MEMO", labelAr: "محضر اعتماد", minCount: 1, weight: 2, mandatoryGate: true }],
    });
    const after = await prisma.complianceRequirementVersion.count({ where: { requirement: { code: MAIN } } });
    expect(res.version).toBeGreaterThan(1);
    expect(after).toBe(before + 1);
  });

  it("2. a non-admin (no compliance.configure) cannot configure", async () => {
    await expect(
      upsertRequirementConfig(editor, { code: "TST.X", titleAr: "x", requirementWeight: 1, gateCeiling: 69, allowNA: false, isActive: true, fields: [], evidenceTypes: [] }),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });
});

describe("readiness computation", () => {
  it("3. unmet mandatory evidence caps the requirement at the gate ceiling", async () => {
    const sol = await makeSolution(DEPT_A, { strategicObjectiveId: "obj-seed", problemStatement: LONG_PROBLEM });
    const file = await getComplianceFile(admin, sol);
    const e = entryByCode(file, MAIN)!;
    // fields satisfied (w3), evidence unmet (w2): raw 60, gated → 60 (≤69).
    expect(e.score!.estimatedReadiness).toBe(60);
    expect(e.score!.gated).toBe(true);
    expect(e.score!.blockedByMandatory.map((b) => b.key)).toContain("APPROVAL_MEMO");
    expect(e.missingEvidence.map((m) => m.key)).toContain("APPROVAL_MEMO");
  });

  it("4. approving a matching evidence lifts it to fully ready", async () => {
    const sol = await makeSolution(DEPT_A, { strategicObjectiveId: "obj-seed", problemStatement: LONG_PROBLEM });
    await approvedEvidence(sol, "APPROVAL_MEMO", mainReqId);
    const file = await getComplianceFile(admin, sol);
    const e = entryByCode(file, MAIN)!;
    expect(e.score!.estimatedReadiness).toBe(100);
    expect(e.score!.gated).toBe(false);
    expect(e.score!.band).toBe("READY");
  });

  it("5. INVARIANT: only APPROVED evidence counts (a submitted-but-unapproved item does not)", async () => {
    const sol = await makeSolution(DEPT_A, { strategicObjectiveId: "obj-seed", problemStatement: LONG_PROBLEM });
    const { id } = await uploadEvidence(admin, sol, { title: "غير معتمد", classification: "APPROVAL_MEMO" }, FILE());
    await linkEvidence(admin, id, { entityType: "COMPLIANCE_REQUIREMENT", entityId: mainReqId, requirementId: mainReqId });
    await submitEvidence(admin, id); // NOT approved
    const e = entryByCode(await getComplianceFile(admin, sol), MAIN)!;
    expect(e.score!.estimatedReadiness).toBe(60); // still gated by missing APPROVED evidence
  });

  it("6. a missing mandatory field also blocks and lists in the gap report", async () => {
    const sol = await makeSolution(DEPT_A, { strategicObjectiveId: null, problemStatement: LONG_PROBLEM });
    const e = entryByCode(await getComplianceFile(admin, sol), MAIN)!;
    expect(e.score!.gated).toBe(true);
    expect(e.score!.blockedByMandatory.map((b) => b.key)).toEqual(expect.arrayContaining(["strategicObjectiveId", "APPROVAL_MEMO"]));
    expect(e.missingFields.map((m) => m.key)).toContain("strategicObjectiveId");
    expect(e.score!.band).toBe("NOT_READY");
  });

  it("7. optional criteria appear informationally and never as a gap", async () => {
    const sol = await makeSolution(DEPT_A, { strategicObjectiveId: "obj-seed", problemStatement: LONG_PROBLEM, notes: null });
    const e = entryByCode(await getComplianceFile(admin, sol), MAIN)!;
    expect(e.optionalFields.map((f) => f.key)).toContain("notes");
    expect(e.missingFields.map((f) => f.key)).not.toContain("notes");
  });

  it("8. a short problemStatement fails the minLength rule", async () => {
    const sol = await makeSolution(DEPT_A, { strategicObjectiveId: "obj-seed", problemStatement: "قصير" });
    const e = entryByCode(await getComplianceFile(admin, sol), MAIN)!;
    expect(e.missingFields.map((m) => m.key)).toContain("problemStatement");
  });
});

describe("governed N/A", () => {
  it("9. request → approve excludes the requirement from rollups; revoke restores it", async () => {
    const sol = await makeSolution(DEPT_A, {});
    // No IMPACT_REPORT evidence → NAR would score 0 and drag the section down.
    let e = entryByCode(await getComplianceFile(admin, sol), NAR)!;
    expect(e.excluded).toBe(false);
    expect(e.score!.estimatedReadiness).toBe(0);

    const na = await requestNA(admin, { requirementId: naReqId, solutionId: sol, reason: "لا ينطبق قياس الأثر على هذا الحل حاليًا" });
    e = entryByCode(await getComplianceFile(admin, sol), NAR)!;
    expect(e.naStatus.state).toBe("REQUESTED");
    expect(e.excluded).toBe(false); // pending does NOT exclude

    await approveNA(admin, na.id, sol);
    const file = await getComplianceFile(admin, sol);
    e = entryByCode(file, NAR)!;
    expect(e.naStatus.state).toBe("APPROVED");
    expect(e.excluded).toBe(true);
    // Its section rollup is now empty (its only requirement is excluded).
    const naSection = file.sections.find((s) => s.code === "TSTNA")!;
    expect(naSection.readiness).toBeNull();

    await revokeNA(admin, na.id, sol);
    e = entryByCode(await getComplianceFile(admin, sol), NAR)!;
    expect(e.excluded).toBe(false);
  });

  it("10. N/A is refused on a requirement configured allowNA=false", async () => {
    const sol = await makeSolution(DEPT_A, {});
    await expect(requestNA(admin, { requirementId: mainReqId, solutionId: sol, reason: "سبب كافٍ للاختبار" })).rejects.toMatchObject({ code: "NA_NOT_ALLOWED" });
  });

  it("11. a non-admin cannot request N/A", async () => {
    const sol = await makeSolution(DEPT_A, {});
    await expect(requestNA(editor, { requirementId: naReqId, solutionId: sol, reason: "سبب كافٍ للاختبار" })).rejects.toBeInstanceOf(AuthorizationError);
  });
});

describe("authorization (compliance detail is internal-only)", () => {
  it("12. a viewer (published scope) cannot read raw compliance detail", async () => {
    const sol = await makeSolution(DEPT_A, {}, { published: true });
    await expect(getComplianceFile(viewer, sol)).rejects.toMatchObject({ code: "NOT_INTERNAL" });
  });

  it("13. a partner (share, not internal) cannot read compliance detail", async () => {
    const sol = await makeSolution(DEPT_A, {});
    await shareTo(sol, ["evidence.create"]);
    // The seeded partner role lacks compliance.view outright, so it is denied at
    // the permission gate — an even stronger denial than NOT_INTERNAL.
    await expect(getComplianceFile(partner, sol)).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("14. a cross-department editor is out of scope", async () => {
    const sol = await makeSolution(DEPT_B, {});
    await expect(getComplianceFile(editor, sol)).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("15. an in-department editor CAN read their solution's file", async () => {
    const sol = await makeSolution(DEPT_A, { strategicObjectiveId: "obj-seed", problemStatement: LONG_PROBLEM });
    const file = await getComplianceFile(editor, sol);
    expect(entryByCode(file, MAIN)).toBeTruthy();
  });
});

describe("overview & export", () => {
  it("16. overview lists internally-reachable solutions; a viewer sees none", async () => {
    await makeSolution(DEPT_A, {});
    const adminRows = await listComplianceOverview(admin);
    expect(adminRows.length).toBeGreaterThan(0);
    expect(await listComplianceOverview(viewer)).toEqual([]);
  });

  it("17. CSV export carries the estimated-internal label and a row per requirement", async () => {
    const sol = await makeSolution(DEPT_A, { strategicObjectiveId: "obj-seed", problemStatement: LONG_PROBLEM });
    const file = await getComplianceFile(admin, sol);
    const csv = buildComplianceCsv(file);
    expect(csv.startsWith("﻿")).toBe(true); // BOM
    expect(csv).toContain(ESTIMATED_LABEL);
    expect(csv).toContain(MAIN);
  });

  it("18. deactivating a requirement removes it from the file immediately", async () => {
    const sol = await makeSolution(DEPT_A, {});
    await setRequirementActive(admin, NAR, false);
    expect(entryByCode(await getComplianceFile(admin, sol), NAR)).toBeUndefined();
    await setRequirementActive(admin, NAR, true); // restore for other tests
  });
});
