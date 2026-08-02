import { readFileSync } from "fs";
import path from "path";
import { describe, it, expect, beforeAll } from "vitest";

import { prisma } from "@/server/db";
import { loadAccessContextByUserId, type AccessContext } from "@/server/access-context";
import { AuthorizationError, assertMutable, reopenDecisionInTransaction } from "@/server/authorization";
import { createIdea, submitIdea } from "@/modules/ideas/service";
import { startInitialReview, advanceToTechnicalReview } from "@/modules/ideas/evaluation-service";
import {
  approveForPilot,
  rejectIdea,
  getIdeaDecisionHistory,
  reopenIdeaDecision,
  supersedeIdeaDecision,
  DecisionError,
} from "@/modules/ideas/decision-service";
import { convertApprovedIdeaToSolution } from "@/modules/ideas/conversion-service";
import { listKanbanIdeas } from "@/modules/ideas/kanban";

/** Phase 3C decision / conversion / Kanban tests against a disposable PostgreSQL DB. */

const DEPT_A = "dept-digital";
const DEPT_B = "dept-strategy";

let admin: AccessContext, editor: AccessContext, partner: AccessContext, viewer: AccessContext;
let reviewer: AccessContext; // INTERNAL_EDITOR in DEPT_A (idea.evaluate)
let decider: AccessContext; // idea.decide + solution.create, DEPARTMENT DEPT_A
let deciderB: AccessContext; // same role, DEPT_B

async function expectAuthz(fn: () => Promise<unknown>, code: string) {
  try {
    await fn();
    throw new Error("expected AuthorizationError " + code);
  } catch (e) {
    expect(e, `AuthorizationError(${code})`).toBeInstanceOf(AuthorizationError);
    expect((e as AuthorizationError).code).toBe(code);
  }
}
async function expectDecision(fn: () => Promise<unknown>, code: string) {
  try {
    await fn();
    throw new Error("expected DecisionError " + code);
  } catch (e) {
    expect(e, `DecisionError(${code})`).toBeInstanceOf(DecisionError);
    expect((e as DecisionError).code).toBe(code);
  }
}

async function ensureUserWithRole(id: string, email: string, roleKey: string, deptId: string): Promise<AccessContext> {
  const role = await prisma.role.findUniqueOrThrow({ where: { key: roleKey } });
  const user = await prisma.user.upsert({
    where: { email },
    update: { status: "ACTIVE", registrationStatus: "APPROVED" },
    create: { id, email, name: email, status: "ACTIVE", registrationStatus: "APPROVED" },
  });
  await prisma.userRole.upsert({
    where: { id: `ur-${id}` },
    update: {},
    create: { id: `ur-${id}`, userId: user.id, roleId: role.id, scopeType: "DEPARTMENT", scopeId: deptId },
  });
  const ctx = await loadAccessContextByUserId(user.id);
  if (!ctx) throw new Error("no ctx for " + email);
  return ctx;
}

/** A decision-maker role: idea.view/evaluate/decide + solution.create. */
async function ensureDeciderRole() {
  const role = await prisma.role.upsert({
    where: { key: "DEPT_DECIDER" },
    update: {},
    create: { key: "DEPT_DECIDER", nameAr: "متخذ قرار الإدارة", description: "اختبار", isSystem: false },
  });
  const perms = await prisma.permission.findMany({
    where: { key: { in: ["idea.view", "idea.evaluate", "idea.decide", "solution.create"] } },
  });
  for (const p of perms) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: role.id, permissionId: p.id } },
      update: {},
      create: { roleId: role.id, permissionId: p.id },
    });
  }
}

/** Drive an idea authored by `author` to TECHNICAL_REVIEW. */
async function technicalIdea(author: AccessContext, dept = DEPT_A): Promise<string> {
  const { id } = await createIdea(author, { titleAr: "فكرة للقرار", description: "وصف", departmentId: dept });
  await submitIdea(author, id);
  await startInitialReview(reviewer, id);
  await advanceToTechnicalReview(reviewer, id);
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

  reviewer = await ensureUserWithRole("user-reviewer", "reviewer@test.local", "INTERNAL_EDITOR", DEPT_A);
  await ensureDeciderRole();
  decider = await ensureUserWithRole("user-decider", "decider@test.local", "DEPT_DECIDER", DEPT_A);
  deciderB = await ensureUserWithRole("user-decider-b", "decider-b@test.local", "DEPT_DECIDER", DEPT_B);
});

describe("final decisions", () => {
  it("1. TECHNICAL_REVIEW → APPROVED_FOR_PILOT", async () => {
    const id = await technicalIdea(editor);
    await approveForPilot(decider, id, { notes: "مبرر الاعتماد" });
    expect((await prisma.idea.findUniqueOrThrow({ where: { id } })).status).toBe("APPROVED_FOR_PILOT");
  });

  it("2. TECHNICAL_REVIEW → REJECTED", async () => {
    const id = await technicalIdea(editor);
    await rejectIdea(decider, id, { notes: "غير مجدية" });
    expect((await prisma.idea.findUniqueOrThrow({ where: { id } })).status).toBe("REJECTED");
  });

  it("3. decision is stored and finalized", async () => {
    const id = await technicalIdea(editor);
    await approveForPilot(decider, id);
    const [latest] = await getIdeaDecisionHistory(decider, id);
    expect(latest.decision).toBe("APPROVE_FOR_PILOT");
    expect(latest.finalizedAt).not.toBeNull();
    const row = await prisma.ideaDecision.findUniqueOrThrow({ where: { id: latest.id } });
    expect(row.decidedById).toBe(decider.userId);
    expect(row.finalizedById).toBe(decider.userId);
  });

  it("4. user without idea.decide is blocked", async () => {
    const id = await technicalIdea(editor);
    await expectAuthz(() => approveForPilot(reviewer, id), "FORBIDDEN");
  });

  it("5. partner and viewer have no decision access", async () => {
    const id = await technicalIdea(editor);
    await expectAuthz(() => approveForPilot(partner, id), "FORBIDDEN");
    await expectAuthz(() => rejectIdea(viewer, id), "FORBIDDEN");
  });

  it("6. cross-department decision blocked", async () => {
    const id = await technicalIdea(editor);
    await expectAuthz(() => approveForPilot(deciderB, id), "OUT_OF_SCOPE");
  });

  it("7. author cannot decide own idea (self-decision blocked)", async () => {
    const id = await technicalIdea(decider); // decider is the author here
    await expectDecision(() => approveForPilot(decider, id), "SELF_DECISION");
  });

  it("8. PLATFORM scope may decide own idea", async () => {
    const id = await technicalIdea(admin);
    await approveForPilot(admin, id);
    expect((await prisma.idea.findUniqueOrThrow({ where: { id } })).status).toBe("APPROVED_FOR_PILOT");
  });

  it("9. deciding from a non-TECHNICAL_REVIEW state is rejected", async () => {
    const { id } = await createIdea(editor, { titleAr: "مسودة", departmentId: DEPT_A });
    await expectDecision(() => approveForPilot(decider, id), "INVALID_TRANSITION");
  });

  it("10. finalized decision cannot be overwritten (immutability guard + no re-decide)", async () => {
    const id = await technicalIdea(editor);
    await approveForPilot(decider, id);
    const [latest] = await getIdeaDecisionHistory(decider, id);
    const row = await prisma.ideaDecision.findUniqueOrThrow({ where: { id: latest.id } });
    expect(() => assertMutable("IDEA_DECISION", row)).toThrow(); // IMMUTABLE
    await expectDecision(() => approveForPilot(decider, id), "INVALID_TRANSITION");
  });
});

describe("governed corrections", () => {
  it("11. reopen requires a reason", async () => {
    const id = await technicalIdea(editor);
    await approveForPilot(decider, id);
    const [latest] = await getIdeaDecisionHistory(decider, id);
    await expectDecision(() => reopenIdeaDecision(decider, id, latest.id, { reason: "" }), "VALIDATION");
  });

  it("12. reopen clears finalization, returns to TECHNICAL_REVIEW, and audits", async () => {
    const id = await technicalIdea(editor);
    await approveForPilot(decider, id);
    const [latest] = await getIdeaDecisionHistory(decider, id);
    await reopenIdeaDecision(decider, id, latest.id, { reason: "معلومات جديدة تستوجب المراجعة" });
    const row = await prisma.ideaDecision.findUniqueOrThrow({ where: { id: latest.id } });
    expect(row.finalizedAt).toBeNull();
    expect(row.reopenReason).toBe("معلومات جديدة تستوجب المراجعة");
    expect((await prisma.idea.findUniqueOrThrow({ where: { id } })).status).toBe("TECHNICAL_REVIEW");
    const audit = await prisma.auditLog.findFirst({ where: { action: "DECISION_REOPENED", entityType: "IDEA", entityId: id } });
    expect(audit).not.toBeNull();
    expect(audit?.metadata).toMatchObject({ decisionId: latest.id });
  });

  it("13. supersede requires a reason and preserves the original", async () => {
    const id = await technicalIdea(editor);
    await approveForPilot(decider, id);
    const [original] = await getIdeaDecisionHistory(decider, id);
    await expectDecision(() => supersedeIdeaDecision(decider, id, original.id, { decision: "REJECT", reason: "" }), "VALIDATION");

    const created = await supersedeIdeaDecision(decider, id, original.id, { decision: "REJECT", reason: "تصحيح بعد مراجعة" });
    const newRow = await prisma.ideaDecision.findUniqueOrThrow({ where: { id: created.id } });
    expect(newRow.supersedesId).toBe(original.id);
    expect(await prisma.ideaDecision.findUnique({ where: { id: original.id } })).not.toBeNull(); // original preserved
    expect((await prisma.idea.findUniqueOrThrow({ where: { id } })).status).toBe("REJECTED");
    const audit = await prisma.auditLog.findFirst({ where: { action: "DECISION_SUPERSEDED", entityType: "IDEA", entityId: id } });
    expect(audit).not.toBeNull();
    expect(audit?.metadata).toMatchObject({ decisionId: created.id, supersedesDecisionId: original.id });
  });

  it("14. decision history preserves every entry", async () => {
    const id = await technicalIdea(editor);
    await approveForPilot(decider, id);
    const [first] = await getIdeaDecisionHistory(decider, id);
    await supersedeIdeaDecision(decider, id, first.id, { decision: "REJECT", reason: "تصحيح" });
    const history = await getIdeaDecisionHistory(decider, id);
    expect(history.length).toBe(2);
  });

  it("14b. reopening rolls back the decision and audit when the surrounding transaction fails", async () => {
    const id = await technicalIdea(editor);
    await approveForPilot(decider, id);
    const [latest] = await getIdeaDecisionHistory(decider, id);
    const auditCount = await prisma.auditLog.count({ where: { action: "DECISION_REOPENED", entityType: "IDEA", entityId: id } });

    await expect(
      prisma.$transaction(async (tx) => {
        await reopenDecisionInTransaction(decider, latest.id, "rollback test", tx);
        throw new Error("force rollback");
      }),
    ).rejects.toThrow("force rollback");

    const decision = await prisma.ideaDecision.findUniqueOrThrow({ where: { id: latest.id } });
    expect(decision.finalizedAt).not.toBeNull();
    expect(decision.reopenedAt).toBeNull();
    expect(await prisma.auditLog.count({ where: { action: "DECISION_REOPENED", entityType: "IDEA", entityId: id } })).toBe(auditCount);
  });
});

describe("conversion", () => {
  it("15. approved idea converts to exactly one solution, linked and status-updated", async () => {
    const id = await technicalIdea(editor);
    await approveForPilot(decider, id);
    const { solutionId } = await convertApprovedIdeaToSolution(decider, id);

    const idea = await prisma.idea.findUniqueOrThrow({ where: { id }, include: { solution: true } });
    expect(idea.status).toBe("CONVERTED_TO_SOLUTION");
    expect(idea.solution?.id).toBe(solutionId); // link preserved both ways

    const solution = await prisma.innovationSolution.findUniqueOrThrow({ where: { id: solutionId } });
    expect(solution.ideaId).toBe(id);
    expect(solution.nameAr).toBe(idea.titleAr);
    expect(solution.owningDepartmentId).toBe(DEPT_A);
    expect(solution.ownerUserId).toBe(idea.submittedById);
    expect(await prisma.innovationSolution.count({ where: { ideaId: id } })).toBe(1);
  });

  it("16. duplicate conversion is blocked", async () => {
    const id = await technicalIdea(editor);
    await approveForPilot(decider, id);
    await convertApprovedIdeaToSolution(decider, id);
    await expectDecision(() => convertApprovedIdeaToSolution(decider, id), "NOT_APPROVED"); // status already CONVERTED
    expect(await prisma.innovationSolution.count({ where: { ideaId: id } })).toBe(1);
  });

  it("17. a rejected idea cannot convert", async () => {
    const id = await technicalIdea(editor);
    await rejectIdea(decider, id);
    await expectDecision(() => convertApprovedIdeaToSolution(decider, id), "NOT_APPROVED");
    expect(await prisma.innovationSolution.count({ where: { ideaId: id } })).toBe(0);
  });

  it("18. conversion requires decide + solution.create and scope", async () => {
    const id = await technicalIdea(editor);
    await approveForPilot(decider, id);
    await expectAuthz(() => convertApprovedIdeaToSolution(reviewer, id), "FORBIDDEN"); // no idea.decide
    await expectAuthz(() => convertApprovedIdeaToSolution(deciderB, id), "OUT_OF_SCOPE"); // wrong department
  });
});

describe("persisted Kanban", () => {
  it("19. returns scope-filtered persisted records grouped by status", async () => {
    const id = await technicalIdea(editor); // DEPT_A → TECHNICAL_REVIEW
    // A DEPT_B idea in a board column (SUBMITTED) — outside the editor's scope.
    const { id: otherId } = await createIdea(admin, { titleAr: "فكرة قسم آخر", departmentId: DEPT_B });
    await submitIdea(admin, otherId);

    const editorBoard = await listKanbanIdeas(editor);
    const editorIds = Object.values(editorBoard).flat().map((c) => c.id);
    expect(editorBoard.TECHNICAL_REVIEW.map((c) => c.id)).toContain(id);
    expect(editorIds).not.toContain(otherId); // cross-department excluded

    const adminIds = Object.values(await listKanbanIdeas(admin)).flat().map((c) => c.id);
    expect(adminIds).toEqual(expect.arrayContaining([id, otherId]));
  });

  it("20. board cards resolve to real persisted ideas (no mock data)", async () => {
    const board = await listKanbanIdeas(admin);
    const ids = Object.values(board).flat().map((c) => c.id);
    const found = await prisma.idea.count({ where: { id: { in: ids } } });
    expect(found).toBe(ids.length);

    const src = readFileSync(path.join(process.cwd(), "src/app/(app)/governance/page.tsx"), "utf8");
    expect(src).not.toContain("solutionsMock");
    expect(src).toContain("listKanbanIdeas");
  });

  it("21. viewer cannot read the board", async () => {
    await expectAuthz(() => listKanbanIdeas(viewer), "FORBIDDEN");
  });
});

describe("audit", () => {
  it("22. approve, reject and conversion write audit records", async () => {
    const approved = await technicalIdea(editor);
    await approveForPilot(decider, approved);
    await convertApprovedIdeaToSolution(decider, approved);
    const rejected = await technicalIdea(editor);
    await rejectIdea(decider, rejected);

    const approvedActions = (
      await prisma.auditLog.findMany({ where: { entityType: "IDEA", entityId: approved }, select: { action: true } })
    ).map((a) => a.action);
    expect(approvedActions).toEqual(expect.arrayContaining(["IDEA_DECISION_APPROVED", "IDEA_CONVERTED"]));

    const rejectedActions = (
      await prisma.auditLog.findMany({ where: { entityType: "IDEA", entityId: rejected }, select: { action: true } })
    ).map((a) => a.action);
    expect(rejectedActions).toContain("IDEA_DECISION_REJECTED");
  });
});
