import { describe, it, expect, beforeAll } from "vitest";

import { prisma } from "@/server/db";
import { loadAccessContextByUserId, type AccessContext } from "@/server/access-context";
import { AuthorizationError } from "@/server/authorization";
import { createIdea, submitIdea } from "@/modules/ideas/service";
import {
  startInitialReview,
  submitInitialEvaluation,
  advanceToTechnicalReview,
  submitTechnicalEvaluation,
  requestMoreInformation,
  resubmitRequestedInformation,
  listIdeaEvaluations,
  EvaluationError,
} from "@/modules/ideas/evaluation-service";

/** Phase 3B evaluation/review tests against a disposable PostgreSQL DB. */

const DEPT_A = "dept-digital"; // editor (author) + reviewer department
const DEPT_B = "dept-strategy"; // other department

let admin: AccessContext, editor: AccessContext, partner: AccessContext, viewer: AccessContext;
let reviewer: AccessContext; // INTERNAL_EDITOR in DEPT_A, not the author
let otherEditor: AccessContext; // INTERNAL_EDITOR in DEPT_B

async function expectAuthz(fn: () => Promise<unknown>, code: string) {
  try {
    await fn();
    throw new Error("expected AuthorizationError " + code);
  } catch (e) {
    expect(e, `AuthorizationError(${code})`).toBeInstanceOf(AuthorizationError);
    expect((e as AuthorizationError).code).toBe(code);
  }
}
async function expectEval(fn: () => Promise<unknown>, code: string) {
  try {
    await fn();
    throw new Error("expected EvaluationError " + code);
  } catch (e) {
    expect(e, `EvaluationError(${code})`).toBeInstanceOf(EvaluationError);
    expect((e as EvaluationError).code).toBe(code);
  }
}

async function ensureEditor(id: string, email: string, deptId: string): Promise<AccessContext> {
  const role = await prisma.role.findUniqueOrThrow({ where: { key: "INTERNAL_EDITOR" } });
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
  if (!ctx) throw new Error("failed to build ctx for " + email);
  return ctx;
}

/** A SUBMITTED idea authored by `editor` in DEPT_A. */
async function submittedIdea(): Promise<string> {
  const { id } = await createIdea(editor, { titleAr: "فكرة للمراجعة", description: "وصف", departmentId: DEPT_A });
  await submitIdea(editor, id);
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
  reviewer = await ensureEditor("user-reviewer", "reviewer@test.local", DEPT_A);
  otherEditor = await ensureEditor("user-other-ed", "other-ed@test.local", DEPT_B);
});

describe("start review", () => {
  it("1. SUBMITTED → INITIAL_REVIEW by an in-scope reviewer", async () => {
    const id = await submittedIdea();
    await startInitialReview(reviewer, id);
    expect((await prisma.idea.findUniqueOrThrow({ where: { id } })).status).toBe("INITIAL_REVIEW");
  });

  it("2. unauthorized users (partner/viewer) cannot review", async () => {
    const id = await submittedIdea();
    await expectAuthz(() => startInitialReview(partner, id), "FORBIDDEN");
    await expectAuthz(() => startInitialReview(viewer, id), "FORBIDDEN");
  });

  it("3. a cross-department evaluator is out of scope", async () => {
    const id = await submittedIdea();
    await expectAuthz(() => startInitialReview(otherEditor, id), "OUT_OF_SCOPE");
  });

  it("4. the author cannot evaluate their own idea", async () => {
    const id = await submittedIdea();
    await expectEval(() => startInitialReview(editor, id), "SELF_EVALUATION");
  });

  it("5. starting review from a non-SUBMITTED status is rejected", async () => {
    const id = await submittedIdea();
    await startInitialReview(reviewer, id);
    await expectEval(() => startInitialReview(reviewer, id), "INVALID_TRANSITION");
  });
});

describe("evaluations", () => {
  it("6. initial evaluation is stored (append-only)", async () => {
    const id = await submittedIdea();
    await startInitialReview(reviewer, id);
    await submitInitialEvaluation(reviewer, id, { comments: "تقييم أولي جيد", score: 80 });
    const evals = await prisma.ideaEvaluation.findMany({ where: { ideaId: id } });
    expect(evals).toHaveLength(1);
    expect(evals[0].stage).toBe("INITIAL");
    expect(evals[0].evaluatorId).toBe(reviewer.userId);
    expect(evals[0].score).toBe(80);
  });

  it("7. initial evaluation is not allowed outside INITIAL_REVIEW", async () => {
    const id = await submittedIdea(); // still SUBMITTED
    await expectEval(() => submitInitialEvaluation(reviewer, id, { comments: "لا يجب أن ينجح" }), "INVALID_STAGE");
  });

  it("8. INITIAL_REVIEW → TECHNICAL_REVIEW then technical evaluation is stored", async () => {
    const id = await submittedIdea();
    await startInitialReview(reviewer, id);
    await advanceToTechnicalReview(reviewer, id);
    expect((await prisma.idea.findUniqueOrThrow({ where: { id } })).status).toBe("TECHNICAL_REVIEW");
    await submitTechnicalEvaluation(reviewer, id, { comments: "تقييم فني" });
    const evals = await prisma.ideaEvaluation.findMany({ where: { ideaId: id, stage: "TECHNICAL" } });
    expect(evals).toHaveLength(1);
  });

  it("9. advancing from a non-INITIAL_REVIEW status is rejected", async () => {
    const id = await submittedIdea(); // SUBMITTED
    await expectEval(() => advanceToTechnicalReview(reviewer, id), "INVALID_TRANSITION");
  });

  it("10. evaluation history is preserved across multiple submissions", async () => {
    const id = await submittedIdea();
    await startInitialReview(reviewer, id);
    await submitInitialEvaluation(reviewer, id, { comments: "أول" });
    await submitInitialEvaluation(reviewer, id, { comments: "ثانٍ" });
    const evals = await listIdeaEvaluations(reviewer, id);
    expect(evals.length).toBeGreaterThanOrEqual(2);
  });
});

describe("more information", () => {
  it("11. reviewer requests more information (requester + requestedAt stored)", async () => {
    const id = await submittedIdea();
    await startInitialReview(reviewer, id);
    await requestMoreInformation(reviewer, id, { requestedInfo: "يرجى إرفاق دراسة الجدوى" });
    expect((await prisma.idea.findUniqueOrThrow({ where: { id } })).status).toBe("MORE_INFO_REQUESTED");
    const req = await prisma.ideaInfoRequest.findFirstOrThrow({ where: { ideaId: id } });
    expect(req.status).toBe("OPEN");
    expect(req.requestedById).toBe(reviewer.userId);
    expect(req.requestedInfo).toContain("دراسة الجدوى");
    expect(req.requestedAt).toBeInstanceOf(Date);
  });

  it("12. author responds and the idea returns to INITIAL_REVIEW (response stored, idea not overwritten)", async () => {
    const id = await submittedIdea();
    const before = await prisma.idea.findUniqueOrThrow({ where: { id } });
    await startInitialReview(reviewer, id);
    await requestMoreInformation(reviewer, id, { requestedInfo: "معلومات" });
    await resubmitRequestedInformation(editor, id, { responseText: "تم الإرفاق" });
    const after = await prisma.idea.findUniqueOrThrow({ where: { id } });
    expect(after.status).toBe("INITIAL_REVIEW");
    expect(after.titleAr).toBe(before.titleAr); // submitted idea not overwritten
    const req = await prisma.ideaInfoRequest.findFirstOrThrow({ where: { ideaId: id } });
    expect(req.status).toBe("ANSWERED");
    expect(req.responseText).toBe("تم الإرفاق");
    expect(req.respondedById).toBe(editor.userId);
  });

  it("13. a non-author cannot respond to the info request", async () => {
    const id = await submittedIdea();
    await startInitialReview(reviewer, id);
    await requestMoreInformation(reviewer, id, { requestedInfo: "معلومات" });
    await expectEval(() => resubmitRequestedInformation(reviewer, id, { responseText: "لا يجوز" }), "NOT_AUTHOR");
  });

  it("14. responding when no info was requested is rejected", async () => {
    const id = await submittedIdea();
    await startInitialReview(reviewer, id);
    await expectEval(() => resubmitRequestedInformation(editor, id, { responseText: "لا يوجد طلب" }), "INVALID_TRANSITION");
  });
});

describe("audit", () => {
  it("15. each review action writes an audit record", async () => {
    const id = await submittedIdea();
    await startInitialReview(reviewer, id);
    await submitInitialEvaluation(reviewer, id, { comments: "ملاحظة" });
    await requestMoreInformation(reviewer, id, { requestedInfo: "المزيد" });
    await resubmitRequestedInformation(editor, id, { responseText: "الرد المطلوب" });
    await advanceToTechnicalReview(reviewer, id);
    const actions = (await prisma.auditLog.findMany({ where: { entityType: "IDEA", entityId: id }, select: { action: true } })).map((a) => a.action);
    expect(actions).toEqual(
      expect.arrayContaining([
        "IDEA_REVIEW_STARTED",
        "IDEA_EVALUATION_SUBMITTED",
        "IDEA_MORE_INFO_REQUESTED",
        "IDEA_INFO_RESUBMITTED",
        "IDEA_ADVANCED_TO_TECHNICAL",
      ]),
    );
  });
});
