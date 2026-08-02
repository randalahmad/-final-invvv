import { describe, it, expect, beforeAll } from "vitest";

import { prisma } from "@/server/db";
import { loadAccessContextByUserId, type AccessContext } from "@/server/access-context";
import { AuthorizationError } from "@/server/authorization";
import {
  createSolution,
  updateDraftSolution,
  updateSharedSolutionFields,
  archiveSolution,
  getSolutionById,
  listSolutionsInScope,
  computeSolutionCompleteness,
  COMPLETENESS_FIELDS,
  SolutionError,
} from "@/modules/solutions/service";

/** Phase 4A solutions-registry tests against a disposable PostgreSQL DB. */

const DEPT_A = "dept-digital";
const DEPT_B = "dept-strategy";

let admin: AccessContext, editor: AccessContext, partner: AccessContext, viewer: AccessContext;

async function expectAuthz(fn: () => Promise<unknown>, code: string) {
  try {
    await fn();
    throw new Error("expected AuthorizationError " + code);
  } catch (e) {
    expect(e, `AuthorizationError(${code})`).toBeInstanceOf(AuthorizationError);
    expect((e as AuthorizationError).code).toBe(code);
  }
}
async function expectSolution(fn: () => Promise<unknown>, code: string) {
  try {
    await fn();
    throw new Error("expected SolutionError " + code);
  } catch (e) {
    expect(e, `SolutionError(${code})`).toBeInstanceOf(SolutionError);
    expect((e as SolutionError).code).toBe(code);
  }
}

async function newSolution(ctx: AccessContext, departmentId: string, extra: Record<string, unknown> = {}) {
  const { id } = await createSolution(ctx, { nameAr: "حل اختبار", owningDepartmentId: departmentId, ...extra });
  return id;
}

/** Grant the partner an active share over a solution. */
async function share(solutionId: string, opts: { allowedFields?: string[]; allowedActions?: string[]; expiresAt?: Date | null; revokedAt?: Date | null } = {}) {
  const partnerUser = await prisma.user.findUniqueOrThrow({ where: { email: "partner@innovation.local" } });
  const adminUser = await prisma.user.findUniqueOrThrow({ where: { email: "admin@innovation.local" } });
  return prisma.resourceShare.create({
    data: {
      userId: partnerUser.id,
      entityType: "INNOVATION_SOLUTION",
      solutionId,
      allowedActions: opts.allowedActions ?? ["update_fields"],
      allowedFields: opts.allowedFields ?? ["notes"],
      grantedById: adminUser.id,
      expiresAt: opts.expiresAt ?? null,
      revokedAt: opts.revokedAt ?? null,
    },
  });
}

beforeAll(async () => {
  const users = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { email: "admin@innovation.local" } }),
    prisma.user.findUniqueOrThrow({ where: { email: "editor@innovation.local" } }),
    prisma.user.findUniqueOrThrow({ where: { email: "partner@innovation.local" } }),
    prisma.user.findUniqueOrThrow({ where: { email: "viewer@innovation.local" } }),
  ]);
  const ctxs = await Promise.all(users.map((u) => loadAccessContextByUserId(u.id)));
  if (ctxs.some((c) => !c)) throw new Error("seed principals missing");
  [admin, editor, partner, viewer] = ctxs as AccessContext[];
});

describe("create & scope", () => {
  it("1. manual create saves a DRAFT with a computed completeness", async () => {
    const id = await newSolution(editor, DEPT_A, { description: "وصف", problemStatement: "مشكلة" });
    const s = await prisma.innovationSolution.findUniqueOrThrow({ where: { id } });
    expect(s.status).toBe("DRAFT");
    expect(s.owningDepartmentId).toBe(DEPT_A);
    expect(s.completionPct).toBeGreaterThan(0);
  });

  it("2. editor cannot create for another department", async () => {
    await expectAuthz(() => createSolution(editor, { nameAr: "خارج النطاق", owningDepartmentId: DEPT_B }), "OUT_OF_SCOPE");
  });

  it("3. viewer and partner cannot create", async () => {
    await expectAuthz(() => createSolution(viewer, { nameAr: "x", owningDepartmentId: DEPT_A }), "FORBIDDEN");
    await expectAuthz(() => createSolution(partner, { nameAr: "x", owningDepartmentId: DEPT_A }), "FORBIDDEN");
  });

  it("4. list is scope-filtered (editor sees own dept only; admin sees all)", async () => {
    const a = await newSolution(editor, DEPT_A);
    const b = await newSolution(admin, DEPT_B);
    const editorIds = (await listSolutionsInScope(editor)).map((s) => s.id);
    expect(editorIds).toContain(a);
    expect(editorIds).not.toContain(b);
    const adminIds = (await listSolutionsInScope(admin)).map((s) => s.id);
    expect(adminIds).toEqual(expect.arrayContaining([a, b]));
  });

  it("5. cross-department read and write are blocked", async () => {
    const b = await newSolution(admin, DEPT_B);
    await expectAuthz(() => getSolutionById(editor, b), "OUT_OF_SCOPE");
    await expectAuthz(() => updateDraftSolution(editor, b, { nameAr: "محاولة", owningDepartmentId: DEPT_B }), "OUT_OF_SCOPE");
  });
});

describe("converted solutions", () => {
  it("6. a converted solution is visible and preserves its Idea link through edits", async () => {
    const idea = await prisma.idea.findFirstOrThrow({ where: { departmentId: DEPT_A, solution: { is: null } } });
    const created = await prisma.innovationSolution.create({
      data: { nameAr: "حل محوّل", owningDepartmentId: DEPT_A, ideaId: idea.id, status: "DRAFT", source: "INTERNAL_PROPOSAL" },
      select: { id: true },
    });
    const visible = (await listSolutionsInScope(editor)).map((s) => s.id);
    expect(visible).toContain(created.id);

    // The edit form cannot carry ideaId — the link must survive.
    await updateDraftSolution(editor, created.id, { nameAr: "حل محوّل (محدّث)", owningDepartmentId: DEPT_A });
    const after = await prisma.innovationSolution.findUniqueOrThrow({ where: { id: created.id } });
    expect(after.ideaId).toBe(idea.id);
    expect(after.nameAr).toBe("حل محوّل (محدّث)");
  });

  it("7. duplicate Idea→Solution conversion remains blocked", async () => {
    const idea = await prisma.idea.findFirstOrThrow({ where: { departmentId: DEPT_A, solution: { is: null } } });
    await prisma.innovationSolution.create({
      data: { nameAr: "أول", owningDepartmentId: DEPT_A, ideaId: idea.id, source: "INTERNAL_PROPOSAL" },
    });
    await expect(
      prisma.innovationSolution.create({
        data: { nameAr: "مكرر", owningDepartmentId: DEPT_A, ideaId: idea.id, source: "INTERNAL_PROPOSAL" },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
  });
});

describe("editing rules", () => {
  it("8. DRAFT can be edited", async () => {
    const id = await newSolution(editor, DEPT_A);
    await updateDraftSolution(editor, id, { nameAr: "اسم محدّث", owningDepartmentId: DEPT_A, technologies: "ذكاء اصطناعي" });
    const s = await prisma.innovationSolution.findUniqueOrThrow({ where: { id } });
    expect(s.nameAr).toBe("اسم محدّث");
    expect(s.technologies).toBe("ذكاء اصطناعي");
  });

  it("9. a non-DRAFT solution cannot be freely edited", async () => {
    const id = await newSolution(editor, DEPT_A);
    await prisma.innovationSolution.update({ where: { id }, data: { status: "ACTIVE" } });
    await expectSolution(() => updateDraftSolution(editor, id, { nameAr: "لا", owningDepartmentId: DEPT_A }), "NOT_DRAFT");
  });

  it("10. viewer cannot update", async () => {
    const id = await newSolution(editor, DEPT_A);
    await expectAuthz(() => updateDraftSolution(viewer, id, { nameAr: "لا", owningDepartmentId: DEPT_A }), "FORBIDDEN");
  });
});

describe("partner sharing", () => {
  it("11. partner sees only actively shared solutions", async () => {
    const shared = await newSolution(admin, DEPT_B);
    const unshared = await newSolution(admin, DEPT_B);
    await share(shared);
    const ids = (await listSolutionsInScope(partner)).map((s) => s.id);
    expect(ids).toContain(shared);
    expect(ids).not.toContain(unshared);
  });

  it("12. an expired or revoked share grants nothing", async () => {
    const expired = await newSolution(admin, DEPT_B);
    await share(expired, { expiresAt: new Date(Date.now() - 86_400_000) });
    const revoked = await newSolution(admin, DEPT_B);
    await share(revoked, { revokedAt: new Date() });

    const ids = (await listSolutionsInScope(partner)).map((s) => s.id);
    expect(ids).not.toContain(expired);
    expect(ids).not.toContain(revoked);
    await expectAuthz(() => updateSharedSolutionFields(partner, expired, { notes: "x" }), "SHARE_INACTIVE");
  });

  it("13. partner may write an allow-listed field", async () => {
    const id = await newSolution(admin, DEPT_B);
    await share(id, { allowedFields: ["notes"] });
    await updateSharedSolutionFields(partner, id, { notes: "ملاحظة الشريك" });
    const s = await prisma.innovationSolution.findUniqueOrThrow({ where: { id } });
    expect(s.notes).toBe("ملاحظة الشريك");
  });

  it("14. partner cannot write a field outside the allow-list", async () => {
    const id = await newSolution(admin, DEPT_B);
    await share(id, { allowedFields: ["notes"] });
    await expectAuthz(() => updateSharedSolutionFields(partner, id, { technologies: "محاولة" }), "FIELD_FORBIDDEN");
  });

  it("15. partner cannot touch protected official fields", async () => {
    const id = await newSolution(admin, DEPT_B);
    await share(id, { allowedFields: ["notes", "status"] }); // even if mistakenly allow-listed
    await expectSolution(() => updateSharedSolutionFields(partner, id, { status: "ACTIVE" }), "VALIDATION");
  });

  it("16. partner cannot act outside the share's allowedActions", async () => {
    const id = await newSolution(admin, DEPT_B);
    await share(id, { allowedActions: ["evidence.create"] });
    await expectAuthz(() => updateSharedSolutionFields(partner, id, { notes: "x" }), "ACTION_NOT_ALLOWED");
  });
});

describe("viewer / published", () => {
  it("17. viewer sees only published solutions and cannot modify them", async () => {
    const unpublished = await newSolution(admin, DEPT_B);
    const published = await newSolution(admin, DEPT_B);
    await prisma.innovationSolution.update({ where: { id: published }, data: { publishedAt: new Date() } });

    const ids = (await listSolutionsInScope(viewer)).map((s) => s.id);
    expect(ids).toContain(published);
    expect(ids).not.toContain(unpublished);
    await expectAuthz(() => getSolutionById(viewer, unpublished), "OUT_OF_SCOPE");
    await expectAuthz(() => updateDraftSolution(viewer, published, { nameAr: "لا", owningDepartmentId: DEPT_B }), "FORBIDDEN");
  });
});

describe("archive", () => {
  it("18. archive requires solution.archive and is soft", async () => {
    const id = await newSolution(editor, DEPT_A);
    await expectAuthz(() => archiveSolution(editor, id), "FORBIDDEN"); // editor lacks solution.archive
    await archiveSolution(admin, id);
    const s = await prisma.innovationSolution.findUniqueOrThrow({ where: { id } });
    expect(s.status).toBe("ARCHIVED");
    expect(s.archivedAt).not.toBeNull();
    expect(s.archivedById).toBe(admin.userId);
  });

  it("19. archived solutions are hidden unless explicitly requested", async () => {
    const id = await newSolution(editor, DEPT_A);
    await archiveSolution(admin, id);
    expect((await listSolutionsInScope(editor)).map((s) => s.id)).not.toContain(id);
    expect((await listSolutionsInScope(editor, { includeArchived: true })).map((s) => s.id)).toContain(id);
  });
});

describe("completeness", () => {
  it("20. percentage reflects filled fields and lists what is missing", async () => {
    const empty = computeSolutionCompleteness({ nameAr: "فقط الاسم" });
    expect(empty.total).toBe(COMPLETENESS_FIELDS.length);
    expect(empty.filled).toBe(1);
    expect(empty.percentage).toBe(Math.round((1 / COMPLETENESS_FIELDS.length) * 100));
    expect(empty.missing.map((m) => m.key)).toContain("description");

    const full: Record<string, unknown> = {};
    for (const f of COMPLETENESS_FIELDS) full[f.key] = "قيمة";
    const complete = computeSolutionCompleteness(full);
    expect(complete.percentage).toBe(100);
    expect(complete.missing).toHaveLength(0);
  });

  it("21. completeness rises as the record is filled in", async () => {
    const id = await newSolution(editor, DEPT_A);
    const before = (await prisma.innovationSolution.findUniqueOrThrow({ where: { id } })).completionPct;
    await updateDraftSolution(editor, id, {
      nameAr: "حل مكتمل",
      owningDepartmentId: DEPT_A,
      description: "وصف",
      problemStatement: "مشكلة",
      targetBeneficiaries: "الموظفون",
      technologies: "تقنية",
      cost: "1000",
      startDate: "2026-01-01",
      targetEndDate: "2026-06-01",
    });
    const after = (await prisma.innovationSolution.findUniqueOrThrow({ where: { id } })).completionPct;
    expect(after).toBeGreaterThan(before);
  });
});

describe("audit", () => {
  it("22. create, update and archive write audit records", async () => {
    const id = await newSolution(editor, DEPT_A);
    await updateDraftSolution(editor, id, { nameAr: "بعد التحديث", owningDepartmentId: DEPT_A });
    await archiveSolution(admin, id);
    const actions = (
      await prisma.auditLog.findMany({ where: { entityType: "INNOVATION_SOLUTION", entityId: id }, select: { action: true } })
    ).map((a) => a.action);
    expect(actions).toEqual(expect.arrayContaining(["SOLUTION_CREATED", "SOLUTION_UPDATED", "SOLUTION_ARCHIVED"]));
  });

  it("23. partner writes are audited with the originating share id", async () => {
    const id = await newSolution(admin, DEPT_B);
    const s = await share(id, { allowedFields: ["notes"] });
    await updateSharedSolutionFields(partner, id, { notes: "من الشريك" });
    const audit = await prisma.auditLog.findFirst({
      where: { action: "SOLUTION_PARTNER_UPDATED", entityId: id },
      orderBy: { createdAt: "desc" },
    });
    expect(audit).not.toBeNull();
    expect((audit!.metadata as { shareId?: string })?.shareId).toBe(s.id);
  });
});
