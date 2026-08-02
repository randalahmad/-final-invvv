import { describe, it, expect, beforeAll } from "vitest";

import { prisma } from "@/server/db";
import { loadAccessContextByUserId, type AccessContext } from "@/server/access-context";
import { AuthorizationError } from "@/server/authorization";
import {
  uploadEvidence,
  submitEvidence,
  startEvidenceReview,
  approveEvidence,
  rejectEvidence,
  archiveEvidence,
  linkEvidence,
  unlinkEvidence,
  listEvidenceLinks,
  listSolutionEvidence,
  getEvidenceById,
  getEvidenceTimeline,
  computeEvidenceApprovalRate,
  validateFile,
  EvidenceError,
} from "@/modules/evidence/service";

/** Phase 5A evidence tests against a disposable PostgreSQL DB. */

const DEPT_A = "dept-digital";
const DEPT_B = "dept-strategy";
const PDF = "application/pdf";

const pdfBytes = (extra = "x") => Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.from(extra)]);
const zipBytes = () => Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from("docx-body")]);
const FILE = { fileName: "memo.pdf", mimeType: PDF, bytes: pdfBytes() };

let admin: AccessContext, editor: AccessContext, partner: AccessContext, viewer: AccessContext;
let adminId = "", partnerId = "";
let solA = "", solB = "", solPublished = "";

async function expectAuthz(fn: () => Promise<unknown>, code: string) {
  try {
    await fn();
    throw new Error("expected AuthorizationError " + code);
  } catch (e) {
    expect(e, `AuthorizationError(${code})`).toBeInstanceOf(AuthorizationError);
    expect((e as AuthorizationError).code).toBe(code);
  }
}
async function expectEvidenceErr(fn: () => Promise<unknown>, code: string) {
  try {
    await fn();
    throw new Error("expected EvidenceError " + code);
  } catch (e) {
    expect(e, `EvidenceError(${code})`).toBeInstanceOf(EvidenceError);
    expect((e as EvidenceError).code).toBe(code);
  }
}

async function makeSolution(deptId: string, opts: { published?: boolean } = {}) {
  const s = await prisma.innovationSolution.create({
    data: {
      nameAr: `حل أدلة ${Math.random().toString(36).slice(2, 8)}`,
      owningDepartmentId: deptId,
      source: "INTERNAL_PROPOSAL",
      status: opts.published ? "ACTIVE" : "DRAFT",
      publishedAt: opts.published ? new Date() : null,
    },
    select: { id: true },
  });
  return s.id;
}

/** Upload → SUBMITTED → UNDER_REVIEW helper. */
async function evidenceUnderReview(solutionId: string) {
  const { id } = await uploadEvidence(admin, solutionId, { title: "دليل اختبار" }, FILE);
  await submitEvidence(admin, id);
  await startEvidenceReview(admin, id);
  return id;
}

async function shareTo(solutionId: string, actions: string[], opts: { expired?: boolean; revoked?: boolean } = {}) {
  return prisma.resourceShare.create({
    data: {
      userId: partnerId,
      entityType: "INNOVATION_SOLUTION",
      solutionId,
      allowedActions: actions,
      allowedFields: ["notes"],
      grantedById: adminId,
      expiresAt: opts.expired ? new Date(Date.now() - 86_400_000) : null,
      revokedAt: opts.revoked ? new Date() : null,
    },
    select: { id: true },
  });
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

  solA = await makeSolution(DEPT_A);
  solB = await makeSolution(DEPT_B);
  solPublished = await makeSolution(DEPT_B, { published: true });
});

describe("upload", () => {
  it("1. uploads evidence as DRAFT/UPLOADED with metadata and a solution link", async () => {
    const { id } = await uploadEvidence(editor, solA, { title: "محضر اعتماد", description: "وصف" }, FILE);
    const ev = await prisma.evidence.findUniqueOrThrow({ where: { id } });
    expect(ev.reviewStatus).toBe("DRAFT");
    expect(ev.fileProcessingStatus).toBe("UPLOADED");
    expect(ev.fileName).toBe("memo.pdf");
    expect(ev.mimeType).toBe(PDF);
    expect(ev.sizeBytes).toBe(FILE.bytes.length);
    expect(ev.notes).toBe("وصف"); // description → notes mapping
    expect(ev.uploadedById).toBe(editor.userId);
    const link = await prisma.evidenceLink.findFirst({ where: { evidenceId: id, entityType: "INNOVATION_SOLUTION" } });
    expect(link?.entityId).toBe(solA);
  });

  it("2. rejects an unsupported file type", async () => {
    await expectEvidenceErr(
      () => uploadEvidence(editor, solA, { title: "ملف غير مدعوم" }, { ...FILE, mimeType: "image/png", fileName: "x.png" }),
      "UNSUPPORTED_FILE",
    );
  });

  it("3. rejects a file over the size ceiling", async () => {
    await expectEvidenceErr(
      () => uploadEvidence(editor, solA, { title: "ملف كبير" }, { ...FILE, bytes: Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(30 * 1024 * 1024)]) }),
      "FILE_TOO_LARGE",
    );
  });

  it("4. rejects invalid metadata", async () => {
    await expectEvidenceErr(() => uploadEvidence(editor, solA, { title: "x" }, FILE), "VALIDATION");
  });

  it("5. accepts DOCX and XLSX", () => {
    expect(() =>
      validateFile({
        fileName: "a.docx",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        bytes: zipBytes(),
      }),
    ).not.toThrow();
    expect(() =>
      validateFile({
        fileName: "a.xlsx",
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        bytes: zipBytes(),
      }),
    ).not.toThrow();
  });
});

describe("lifecycle", () => {
  it("6. DRAFT → SUBMITTED", async () => {
    const { id } = await uploadEvidence(editor, solA, { title: "للتقديم" }, FILE);
    await submitEvidence(editor, id);
    expect((await prisma.evidence.findUniqueOrThrow({ where: { id } })).reviewStatus).toBe("SUBMITTED");
  });

  it("7. SUBMITTED → UNDER_REVIEW requires evidence.approve", async () => {
    const { id } = await uploadEvidence(admin, solA, { title: "مراجعة" }, FILE);
    await submitEvidence(admin, id);
    await expectAuthz(() => startEvidenceReview(editor, id), "FORBIDDEN"); // editor lacks evidence.approve
    await startEvidenceReview(admin, id);
    expect((await prisma.evidence.findUniqueOrThrow({ where: { id } })).reviewStatus).toBe("UNDER_REVIEW");
  });

  it("8. UNDER_REVIEW → APPROVED stamps approver", async () => {
    const id = await evidenceUnderReview(solA);
    await approveEvidence(admin, id);
    const ev = await prisma.evidence.findUniqueOrThrow({ where: { id } });
    expect(ev.reviewStatus).toBe("APPROVED");
    expect(ev.approvedById).toBe(admin.userId);
    expect(ev.approvedAt).not.toBeNull();
  });

  it("9. UNDER_REVIEW → REJECTED", async () => {
    const id = await evidenceUnderReview(solA);
    await rejectEvidence(admin, id, "غير مكتمل");
    expect((await prisma.evidence.findUniqueOrThrow({ where: { id } })).reviewStatus).toBe("REJECTED");
  });

  it("10. APPROVED → ARCHIVED is soft (record retained)", async () => {
    const id = await evidenceUnderReview(solA);
    await approveEvidence(admin, id);
    await archiveEvidence(admin, id);
    const ev = await prisma.evidence.findUniqueOrThrow({ where: { id } });
    expect(ev.reviewStatus).toBe("ARCHIVED");
    expect(ev.archivedAt).not.toBeNull();
    expect(ev.archivedById).toBe(admin.userId);
  });

  it("11. invalid transitions are rejected", async () => {
    const { id } = await uploadEvidence(admin, solA, { title: "انتقال غير صالح" }, FILE);
    await expectEvidenceErr(() => approveEvidence(admin, id), "INVALID_TRANSITION"); // DRAFT → APPROVED
    await submitEvidence(admin, id);
    await expectEvidenceErr(() => submitEvidence(admin, id), "INVALID_TRANSITION"); // re-submit
  });
});

describe("scope & role enforcement", () => {
  it("12. editor cannot read evidence of another department's solution", async () => {
    await uploadEvidence(admin, solB, { title: "دليل قسم آخر" }, FILE);
    await expectAuthz(() => listSolutionEvidence(editor, solB), "OUT_OF_SCOPE");
  });

  it("13. editor cannot upload to another department's solution", async () => {
    await expectAuthz(() => uploadEvidence(editor, solB, { title: "ممنوع" }, FILE), "OUT_OF_SCOPE");
  });

  it("14. viewer cannot upload (no evidence.upload)", async () => {
    await expectAuthz(() => uploadEvidence(viewer, solPublished, { title: "ممنوع" }, FILE), "FORBIDDEN");
  });

  it("15. viewer cannot approve", async () => {
    const id = await evidenceUnderReview(solPublished);
    await expectAuthz(() => approveEvidence(viewer, id), "FORBIDDEN");
  });

  it("16. admin has full access across departments", async () => {
    const rows = await listSolutionEvidence(admin, solB);
    expect(Array.isArray(rows)).toBe(true);
  });
});

describe("partner restrictions", () => {
  it("17. partner without a share cannot read or upload", async () => {
    const sol = await makeSolution(DEPT_A);
    await expectAuthz(() => listSolutionEvidence(partner, sol), "OUT_OF_SCOPE");
    await expectAuthz(() => uploadEvidence(partner, sol, { title: "ممنوع" }, FILE), "OUT_OF_SCOPE");
  });

  it("18. partner with a share lacking evidence.create cannot upload", async () => {
    const sol = await makeSolution(DEPT_A);
    await shareTo(sol, ["update_fields"]);
    await expectAuthz(() => uploadEvidence(partner, sol, { title: "ممنوع" }, FILE), "ACTION_NOT_ALLOWED");
  });

  it("19. partner with evidence.create in an active share can upload", async () => {
    const sol = await makeSolution(DEPT_A);
    await shareTo(sol, ["evidence.create"]);
    const { id } = await uploadEvidence(partner, sol, { title: "دليل الشريك" }, FILE);
    const ev = await prisma.evidence.findUniqueOrThrow({ where: { id } });
    expect(ev.uploadedById).toBe(partner.userId);
    expect(ev.reviewStatus).toBe("DRAFT");
  });

  it("20. an EXPIRED share blocks partner upload", async () => {
    const sol = await makeSolution(DEPT_A);
    await shareTo(sol, ["evidence.create"], { expired: true });
    await expectAuthz(() => uploadEvidence(partner, sol, { title: "منتهية" }, FILE), "OUT_OF_SCOPE");
  });

  it("21. a REVOKED share blocks partner upload", async () => {
    const sol = await makeSolution(DEPT_A);
    await shareTo(sol, ["evidence.create"], { revoked: true });
    await expectAuthz(() => uploadEvidence(partner, sol, { title: "ملغاة" }, FILE), "OUT_OF_SCOPE");
  });

  it("22. partner cannot approve evidence", async () => {
    const sol = await makeSolution(DEPT_A);
    await shareTo(sol, ["evidence.create"]);
    const { id } = await uploadEvidence(partner, sol, { title: "دليل" }, FILE);
    await expectAuthz(() => approveEvidence(partner, id), "FORBIDDEN");
  });
});

describe("viewer published-only reads", () => {
  it("23. viewer sees only APPROVED evidence on a published solution", async () => {
    const draft = await uploadEvidence(admin, solPublished, { title: "غير معتمد" }, FILE);
    const approvedId = await evidenceUnderReview(solPublished);
    await approveEvidence(admin, approvedId);

    const rows = await listSolutionEvidence(viewer, solPublished);
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(approvedId);
    expect(ids).not.toContain(draft.id);
  });

  it("24. viewer cannot open non-approved evidence directly", async () => {
    const { id } = await uploadEvidence(admin, solPublished, { title: "مسودة مخفية" }, FILE);
    await expectEvidenceErr(() => getEvidenceById(viewer, id), "NOT_FOUND");
  });

  it("25. viewer cannot read evidence of an unpublished solution", async () => {
    await expectAuthz(() => listSolutionEvidence(viewer, solA), "OUT_OF_SCOPE");
  });
});

describe("linking", () => {
  it("26. links evidence to a compliance requirement", async () => {
    const { id } = await uploadEvidence(admin, solA, { title: "للربط" }, FILE);
    const req = await prisma.complianceRequirement.findFirstOrThrow();
    await linkEvidence(admin, id, { entityType: "COMPLIANCE_REQUIREMENT", entityId: req.id, requirementId: req.id });
    const links = await listEvidenceLinks(admin, id);
    expect(links.some((l) => l.entityType === "COMPLIANCE_REQUIREMENT" && l.entityId === req.id)).toBe(true);
  });

  it("27. duplicate links are blocked", async () => {
    const { id } = await uploadEvidence(admin, solA, { title: "ربط مكرر" }, FILE);
    const obj = await prisma.strategicObjective.findFirstOrThrow();
    await linkEvidence(admin, id, { entityType: "STRATEGIC_OBJECTIVE", entityId: obj.id });
    await expectEvidenceErr(
      () => linkEvidence(admin, id, { entityType: "STRATEGIC_OBJECTIVE", entityId: obj.id }),
      "DUPLICATE",
    );
  });

  it("28. a non-existent target is rejected", async () => {
    const { id } = await uploadEvidence(admin, solA, { title: "مرجع خاطئ" }, FILE);
    await expectEvidenceErr(
      () => linkEvidence(admin, id, { entityType: "INNOVATION_ACTIVITY", entityId: "does-not-exist" }),
      "BAD_REFERENCE",
    );
  });

  it("29. the owning-solution link cannot be removed, other links can", async () => {
    const { id } = await uploadEvidence(admin, solA, { title: "فصل الربط" }, FILE);
    const links = await listEvidenceLinks(admin, id);
    const owner = links.find((l) => l.entityType === "INNOVATION_SOLUTION")!;
    await expectEvidenceErr(() => unlinkEvidence(admin, owner.id), "INVALID_TRANSITION");

    const act = await prisma.innovationActivity.findFirstOrThrow();
    await linkEvidence(admin, id, { entityType: "INNOVATION_ACTIVITY", entityId: act.id });
    const added = (await listEvidenceLinks(admin, id)).find((l) => l.entityType === "INNOVATION_ACTIVITY")!;
    await unlinkEvidence(admin, added.id);
    expect((await listEvidenceLinks(admin, id)).some((l) => l.id === added.id)).toBe(false);
  });
});

describe("evidence readiness (evidence only)", () => {
  it("30. readiness is approved ÷ tracked, and is stored on the solution", async () => {
    const sol = await makeSolution(DEPT_A);
    expect((await computeEvidenceApprovalRate(sol)).percentage).toBe(0);

    const a = await evidenceUnderReview(sol);
    await approveEvidence(admin, a);
    await uploadEvidence(admin, sol, { title: "قيد الإعداد" }, FILE); // tracked, not approved

    const rate = await computeEvidenceApprovalRate(sol);
    expect(rate.approved).toBe(1);
    expect(rate.tracked).toBe(2);
    expect(rate.percentage).toBe(50);

    const stored = await prisma.innovationSolution.findUniqueOrThrow({ where: { id: sol } });
    expect(stored.evidenceReadinessPct).toBe(50);
  });

  it("31. rejected and archived evidence are excluded from the denominator", async () => {
    const sol = await makeSolution(DEPT_A);
    const approved = await evidenceUnderReview(sol);
    await approveEvidence(admin, approved);
    const rejected = await evidenceUnderReview(sol);
    await rejectEvidence(admin, rejected, "سبب");

    const rate = await computeEvidenceApprovalRate(sol);
    expect(rate.approved).toBe(1);
    expect(rate.tracked).toBe(1);
    expect(rate.percentage).toBe(100);
  });
});

describe("registry & timeline", () => {
  it("32. archived evidence is hidden unless explicitly included", async () => {
    const sol = await makeSolution(DEPT_A);
    const id = await evidenceUnderReview(sol);
    await approveEvidence(admin, id);
    await archiveEvidence(admin, id);

    expect((await listSolutionEvidence(admin, sol)).map((r) => r.id)).not.toContain(id);
    expect((await listSolutionEvidence(admin, sol, { includeArchived: true })).map((r) => r.id)).toContain(id);
  });

  it("33. search filters by title", async () => {
    const sol = await makeSolution(DEPT_A);
    await uploadEvidence(admin, sol, { title: "تقرير الأثر السنوي" }, FILE);
    await uploadEvidence(admin, sol, { title: "محضر لجنة" }, FILE);
    const rows = await listSolutionEvidence(admin, sol, { q: "الأثر" });
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toContain("الأثر");
  });

  it("34. status filter works", async () => {
    const sol = await makeSolution(DEPT_A);
    const approved = await evidenceUnderReview(sol);
    await approveEvidence(admin, approved);
    await uploadEvidence(admin, sol, { title: "مسودة" }, FILE);
    const rows = await listSolutionEvidence(admin, sol, { reviewStatus: "APPROVED" });
    expect(rows.map((r) => r.id)).toEqual([approved]);
  });

  it("35. timeline records the full lifecycle", async () => {
    const sol = await makeSolution(DEPT_A);
    const id = await evidenceUnderReview(sol);
    await approveEvidence(admin, id);
    await archiveEvidence(admin, id);

    const actions = (await getEvidenceTimeline(admin, id)).map((e) => e.action);
    expect(actions).toEqual(
      expect.arrayContaining(["EVIDENCE_UPLOADED", "EVIDENCE_SUBMITTED", "EVIDENCE_REVIEW_STARTED", "EVIDENCE_APPROVED", "EVIDENCE_ARCHIVED"]),
    );
  });
});

describe("audit", () => {
  it("36. every write is audited against the EVIDENCE entity type", async () => {
    const sol = await makeSolution(DEPT_A);
    const { id } = await uploadEvidence(admin, sol, { title: "تدقيق" }, FILE);
    const req = await prisma.complianceRequirement.findFirstOrThrow();
    await linkEvidence(admin, id, { entityType: "COMPLIANCE_REQUIREMENT", entityId: req.id });

    const rows = await prisma.auditLog.findMany({ where: { entityType: "EVIDENCE", entityId: id }, select: { action: true, actorUserId: true } });
    expect(rows.map((r) => r.action)).toEqual(expect.arrayContaining(["EVIDENCE_UPLOADED", "EVIDENCE_LINKED"]));
    expect(rows.every((r) => r.actorUserId === admin.userId)).toBe(true);
  });

  it("37. rejection reason is captured in the audit metadata, not on the record", async () => {
    const id = await evidenceUnderReview(solA);
    await rejectEvidence(admin, id, "الوثيقة غير موقّعة");
    const row = await prisma.auditLog.findFirstOrThrow({ where: { entityType: "EVIDENCE", entityId: id, action: "EVIDENCE_REJECTED" } });
    expect((row.metadata as { note?: string }).note).toBe("الوثيقة غير موقّعة");
  });
});
