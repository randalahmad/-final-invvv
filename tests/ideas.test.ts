import { describe, it, expect, beforeAll } from "vitest";

import { prisma } from "@/server/db";
import { loadAccessContextByUserId, type AccessContext } from "@/server/access-context";
import { AuthorizationError } from "@/server/authorization";
import {
  createIdea,
  updateDraftIdea,
  submitIdea,
  withdrawIdea,
  archiveIdea,
  getIdeaById,
  listIdeasInScope,
  IdeaError,
} from "@/modules/ideas/service";

/** Phase 3A ideas tests against a disposable PostgreSQL DB with seeded principals. */

const DEPT_A = "dept-digital"; // editor's department
const DEPT_B = "dept-strategy"; // other department

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
async function expectIdeaErr(fn: () => Promise<unknown>, code: string) {
  try {
    await fn();
    throw new Error("expected IdeaError " + code);
  } catch (e) {
    expect(e, `IdeaError(${code})`).toBeInstanceOf(IdeaError);
    expect((e as IdeaError).code).toBe(code);
  }
}

async function newDraft(ctx: AccessContext, departmentId: string, title = "فكرة اختبار") {
  const { id } = await createIdea(ctx, { titleAr: title, description: "وصف", departmentId });
  return id;
}

beforeAll(async () => {
  const [a, e, p, v] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { email: "admin@innovation.local" } }),
    prisma.user.findUniqueOrThrow({ where: { email: "editor@innovation.local" } }),
    prisma.user.findUniqueOrThrow({ where: { email: "partner@innovation.local" } }),
    prisma.user.findUniqueOrThrow({ where: { email: "viewer@innovation.local" } }),
  ]);
  const ctxs = await Promise.all([a, e, p, v].map((u) => loadAccessContextByUserId(u.id)));
  if (ctxs.some((c) => !c)) throw new Error("seed principals missing");
  [admin, editor, partner, viewer] = ctxs as AccessContext[];
});

describe("create & scope", () => {
  it("1. create saves a DRAFT authored by the caller", async () => {
    const id = await newDraft(editor, DEPT_A);
    const idea = await prisma.idea.findUniqueOrThrow({ where: { id }, include: { decisions: true } });
    expect(idea.status).toBe("DRAFT");
    expect(idea.submittedById).toBe(editor.userId);
    expect(idea.departmentId).toBe(DEPT_A);
  });

  it("2. editor cannot create an idea for another department", async () => {
    await expectAuthz(() => createIdea(editor, { titleAr: "خارج النطاق", departmentId: DEPT_B }), "OUT_OF_SCOPE");
  });

  it("3. partner cannot create an idea (no idea.view)", async () => {
    await expectAuthz(() => createIdea(partner, { titleAr: "x", departmentId: DEPT_A }), "FORBIDDEN");
  });
});

describe("edit rules", () => {
  it("4. author can edit own DRAFT", async () => {
    const id = await newDraft(editor, DEPT_A);
    await updateDraftIdea(editor, id, { titleAr: "عنوان مُحدّث", description: "جديد", departmentId: DEPT_A });
    const idea = await prisma.idea.findUniqueOrThrow({ where: { id } });
    expect(idea.titleAr).toBe("عنوان مُحدّث");
  });

  it("5. a SUBMITTED idea cannot be edited", async () => {
    const id = await newDraft(editor, DEPT_A);
    await submitIdea(editor, id);
    await expectIdeaErr(() => updateDraftIdea(editor, id, { titleAr: "لا يجب أن ينجح", departmentId: DEPT_A }), "NOT_DRAFT");
  });
});

describe("transitions", () => {
  it("6. DRAFT → SUBMITTED", async () => {
    const id = await newDraft(editor, DEPT_A);
    await submitIdea(editor, id);
    expect((await prisma.idea.findUniqueOrThrow({ where: { id } })).status).toBe("SUBMITTED");
  });

  it("7. submitting an already-submitted idea is rejected", async () => {
    const id = await newDraft(editor, DEPT_A);
    await submitIdea(editor, id);
    await expectIdeaErr(() => submitIdea(editor, id), "INVALID_TRANSITION");
  });

  it("8. archiving a DRAFT is an invalid transition", async () => {
    const id = await newDraft(editor, DEPT_A);
    await expectIdeaErr(() => archiveIdea(editor, id), "INVALID_TRANSITION");
  });

  it("9. withdraw is allowed from SUBMITTED", async () => {
    const id = await newDraft(editor, DEPT_A);
    await submitIdea(editor, id);
    await withdrawIdea(editor, id);
    expect((await prisma.idea.findUniqueOrThrow({ where: { id } })).status).toBe("WITHDRAWN");
  });

  it("10. archive is allowed on a WITHDRAWN idea (soft, not deleted)", async () => {
    const id = await newDraft(editor, DEPT_A);
    await submitIdea(editor, id);
    await withdrawIdea(editor, id);
    await archiveIdea(editor, id);
    const idea = await prisma.idea.findUniqueOrThrow({ where: { id } });
    expect(idea.status).toBe("ARCHIVED");
    expect(idea.archivedAt).not.toBeNull();
    expect(idea.archivedById).toBe(editor.userId);
  });
});

describe("scoped access", () => {
  it("11. editor cannot open an idea from another department", async () => {
    const idB = await newDraft(admin, DEPT_B);
    await expectAuthz(() => getIdeaById(editor, idB), "OUT_OF_SCOPE");
  });

  it("12. viewer (no idea.view) cannot open an idea", async () => {
    const id = await newDraft(admin, DEPT_A);
    await expectAuthz(() => getIdeaById(viewer, id), "FORBIDDEN");
  });

  it("13. missing idea → NOT_FOUND", async () => {
    await expectAuthz(() => getIdeaById(admin, "does-not-exist"), "NOT_FOUND");
  });

  it("14. archive is blocked for a non-owning editor (another department)", async () => {
    const idB = await newDraft(admin, DEPT_B);
    await submitIdea(admin, idB);
    await withdrawIdea(admin, idB);
    await expectAuthz(() => archiveIdea(editor, idB), "OUT_OF_SCOPE");
  });

  it("15. list is scope-filtered (editor sees own dept, not another; admin sees all)", async () => {
    const idA = await newDraft(editor, DEPT_A, "قائمة-A");
    const idB = await newDraft(admin, DEPT_B, "قائمة-B");
    const editorIds = (await listIdeasInScope(editor)).map((r) => r.id);
    expect(editorIds).toContain(idA);
    expect(editorIds).not.toContain(idB);
    const adminIds = (await listIdeasInScope(admin)).map((r) => r.id);
    expect(adminIds).toEqual(expect.arrayContaining([idA, idB]));
  });

  it("16. viewer cannot list ideas", async () => {
    await expectAuthz(() => listIdeasInScope(viewer), "FORBIDDEN");
  });
});

describe("audit", () => {
  it("17. create/submit/withdraw/archive each write an audit record", async () => {
    const id = await newDraft(editor, DEPT_A);
    await submitIdea(editor, id);
    await withdrawIdea(editor, id);
    await archiveIdea(editor, id);
    const actions = (
      await prisma.auditLog.findMany({ where: { entityType: "IDEA", entityId: id }, select: { action: true } })
    ).map((a) => a.action);
    expect(actions).toEqual(expect.arrayContaining(["IDEA_CREATED", "IDEA_SUBMITTED", "IDEA_WITHDRAWN", "IDEA_ARCHIVED"]));
  });
});
