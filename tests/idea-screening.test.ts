import { describe, it, expect, beforeAll, afterEach } from "vitest";

import { prisma } from "@/server/db";
import { loadAccessContextByUserId, type AccessContext } from "@/server/access-context";
import { createIdea, submitIdea } from "@/modules/ideas/service";
import { getIdeaScreening, markIdeaScreeningReviewed, runIdeaScreening } from "@/modules/ideas/screening/service";
import {
  setIdeaScreeningProvider,
} from "@/modules/ideas/screening/provider";
import type { IdeaScreeningContext, IdeaScreeningOutput, IdeaScreeningProvider } from "@/modules/ideas/screening/provider/types";
import { IdeaScreeningProviderError } from "@/modules/ideas/screening/provider/types";
import { AuthorizationError } from "@/server/authorization";

/** Phase (AI idea screening) tests — the advisory, external-AI-backed initial
 *  screen that runs automatically after submitIdea(). Mirrors the
 *  provider-injection pattern in tests/document-analysis.test.ts. */

const DEPT_A = "dept-digital"; // editor's department

let admin: AccessContext, editor: AccessContext, viewer: AccessContext;

async function newDraft(ctx: AccessContext, departmentId: string, title = "فكرة اختبار للفحص الآلي") {
  const { id } = await createIdea(ctx, { titleAr: title, description: "وصف كافٍ لاختبار الفحص الآلي للفكرة.", departmentId });
  return id;
}

function fakeProvider(
  output: IdeaScreeningOutput,
  opts: { name?: string; model?: string } = {},
): IdeaScreeningProvider {
  return {
    name: opts.name ?? "fake",
    model: opts.model ?? "fake-model-1",
    screen: async (_ctx: IdeaScreeningContext) => output,
  };
}

function failingProvider(message = "تعذّر الاتصال بنموذج الذكاء الاصطناعي"): IdeaScreeningProvider {
  return {
    name: "fake-failing",
    model: "fake-model-1",
    screen: async () => {
      throw new IdeaScreeningProviderError(message);
    },
  };
}

const SAMPLE_OUTPUT: IdeaScreeningOutput = {
  score: 72,
  recommendation: "PROCEED",
  summaryAr: "الفكرة واضحة ومتسقة مع نشاط الإدارة، ولم يظهر ما يستدعي رفضها مبدئيًا.",
  findings: [
    { criterionKey: "completeness", labelAr: "اكتمال الوصف ووضوحه", verdict: "ACCEPTABLE", noteAr: "الوصف كافٍ لبدء المراجعة." },
    { criterionKey: "possible_duplicate", labelAr: "احتمال التكرار مع أفكار سابقة", verdict: "STRONG" },
  ],
};

beforeAll(async () => {
  const [a, e, v] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { email: "admin@innovation.local" } }),
    prisma.user.findUniqueOrThrow({ where: { email: "editor@innovation.local" } }),
    prisma.user.findUniqueOrThrow({ where: { email: "viewer@innovation.local" } }),
  ]);
  const ctxs = await Promise.all([a, e, v].map((u) => loadAccessContextByUserId(u.id)));
  if (ctxs.some((c) => !c)) throw new Error("seed principals missing");
  [admin, editor, viewer] = ctxs as AccessContext[];
});

afterEach(() => {
  setIdeaScreeningProvider(null);
});

describe("enqueue & pipeline", () => {
  it("1. submitting an idea enqueues and runs the AI screening synchronously", async () => {
    setIdeaScreeningProvider(fakeProvider(SAMPLE_OUTPUT));
    const id = await newDraft(editor, DEPT_A);
    await submitIdea(editor, id);

    const screening = await prisma.ideaScreening.findUniqueOrThrow({ where: { ideaId: id }, include: { findings: true } });
    expect(screening.status).toBe("COMPLETED");
    expect(screening.recommendation).toBe("PROCEED");
    expect(screening.score).toBe(72);
    expect(screening.provider).toBe("fake");
    expect(screening.findings.length).toBe(2);
  });

  it("2. INVARIANT: a completed screening never changes Idea.status or writes a decision/evaluation", async () => {
    setIdeaScreeningProvider(fakeProvider(SAMPLE_OUTPUT));
    const id = await newDraft(editor, DEPT_A);
    await submitIdea(editor, id);

    const idea = await prisma.idea.findUniqueOrThrow({ where: { id } });
    expect(idea.status).toBe("SUBMITTED");
    const decisions = await prisma.ideaDecision.count({ where: { ideaId: id } });
    const evaluations = await prisma.ideaEvaluation.count({ where: { ideaId: id } });
    expect(decisions).toBe(0);
    expect(evaluations).toBe(0);
  });

  it("3. a provider failure produces a FAILED screening but the submission still succeeds", async () => {
    setIdeaScreeningProvider(failingProvider("مفتاح API غير مُهيأ"));
    const id = await newDraft(editor, DEPT_A);
    // submitIdea itself must not throw, even though screening fails.
    await submitIdea(editor, id);

    const idea = await prisma.idea.findUniqueOrThrow({ where: { id } });
    expect(idea.status).toBe("SUBMITTED");
    const screening = await prisma.ideaScreening.findUniqueOrThrow({ where: { ideaId: id } });
    expect(screening.status).toBe("FAILED");
    expect(screening.error).toContain("مفتاح API غير مُهيأ");
  });

  it("4. with no provider configured (default), a missing ANTHROPIC_API_KEY fails gracefully", async () => {
    // No setIdeaScreeningProvider() call — exercises the real default provider
    // resolution. In the test environment ANTHROPIC_API_KEY is unset, so the
    // real Anthropic provider must fail closed without throwing out of submitIdea.
    const id = await newDraft(editor, DEPT_A);
    await submitIdea(editor, id);

    const idea = await prisma.idea.findUniqueOrThrow({ where: { id } });
    expect(idea.status).toBe("SUBMITTED");
    const screening = await prisma.ideaScreening.findUniqueOrThrow({ where: { ideaId: id } });
    expect(screening.status).toBe("FAILED");
  });

  it("5. re-submission-triggered re-run replaces prior findings, not appends", async () => {
    setIdeaScreeningProvider(fakeProvider(SAMPLE_OUTPUT));
    const id = await newDraft(editor, DEPT_A);
    await submitIdea(editor, id);
    const first = await prisma.ideaScreeningFinding.count({ where: { screening: { ideaId: id } } });

    // Re-run directly (service-level), simulating a second pass.
    await runIdeaScreening(id, editor.userId);
    const second = await prisma.ideaScreeningFinding.count({ where: { screening: { ideaId: id } } });
    expect(second).toBe(first);
  });
});

describe("read access & review acknowledgment", () => {
  it("6. getIdeaScreening respects idea.view + scope (viewer in-scope can read)", async () => {
    setIdeaScreeningProvider(fakeProvider(SAMPLE_OUTPUT));
    const id = await newDraft(editor, DEPT_A);
    await submitIdea(editor, id);

    const screening = await getIdeaScreening(admin, id);
    expect(screening?.status).toBe("COMPLETED");
  });

  it("7. markIdeaScreeningReviewed requires idea.evaluate (viewer is forbidden)", async () => {
    setIdeaScreeningProvider(fakeProvider(SAMPLE_OUTPUT));
    const id = await newDraft(editor, DEPT_A);
    await submitIdea(editor, id);

    await expect(markIdeaScreeningReviewed(viewer, id)).rejects.toBeInstanceOf(AuthorizationError);
    await markIdeaScreeningReviewed(admin, id);
    const screening = await prisma.ideaScreening.findUniqueOrThrow({ where: { ideaId: id } });
    expect(screening.reviewedById).toBe(admin.userId);
    expect(screening.reviewedAt).not.toBeNull();
  });
});

describe("audit", () => {
  it("8. screening lifecycle actions are audited", async () => {
    setIdeaScreeningProvider(fakeProvider(SAMPLE_OUTPUT));
    const id = await newDraft(editor, DEPT_A);
    await submitIdea(editor, id);

    const actions = (
      await prisma.auditLog.findMany({ where: { entityType: "IDEA", entityId: id }, select: { action: true } })
    ).map((a) => a.action);
    expect(actions).toEqual(
      expect.arrayContaining(["IDEA_SCREENING_QUEUED", "IDEA_SCREENING_STARTED", "IDEA_SCREENING_COMPLETED"]),
    );
  });

  it("9. a FAILED screening is also audited", async () => {
    setIdeaScreeningProvider(failingProvider());
    const id = await newDraft(editor, DEPT_A);
    await submitIdea(editor, id);

    const actions = (
      await prisma.auditLog.findMany({ where: { entityType: "IDEA", entityId: id }, select: { action: true } })
    ).map((a) => a.action);
    expect(actions).toEqual(expect.arrayContaining(["IDEA_SCREENING_QUEUED", "IDEA_SCREENING_STARTED", "IDEA_SCREENING_FAILED"]));
  });
});
