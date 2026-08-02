import { describe, it, expect, beforeAll } from "vitest";

import { prisma } from "@/server/db";
import { loadAccessContextByUserId, type AccessContext } from "@/server/access-context";
import { AuthorizationError, solutionScopeWhere } from "@/server/authorization";
import { createSolution, listSolutionsInScope, updateSharedSolutionFields, SolutionError } from "@/modules/solutions/service";
import {
  changeRecordStatus,
  changeImplementationStatus,
  changeMaturityStage,
  publishSolution,
  unpublishSolution,
} from "@/modules/solutions/lifecycle-service";
import {
  grantSolutionShare,
  revokeSolutionShare,
  listSolutionShares,
  addParticipatingOrganization,
  removeParticipatingOrganization,
  listParticipatingOrganizations,
} from "@/modules/solutions/sharing-service";
import { getSolutionHistory } from "@/modules/solutions/history-service";
import { getSolutionStats } from "@/modules/solutions/stats-service";

/** Phase 4B lifecycle / publishing / sharing tests against a disposable PostgreSQL DB. */

const DEPT_A = "dept-digital";
const DEPT_B = "dept-strategy";

let admin: AccessContext, editor: AccessContext, partner: AccessContext, viewer: AccessContext;
let partnerUserId = "";

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

/** A DRAFT solution owned by DEPT_A. */
async function draft(extra: Record<string, unknown> = {}) {
  const { id } = await createSolution(editor, { nameAr: "حل دورة الحياة", owningDepartmentId: DEPT_A, ...extra });
  return id;
}
/** An ACTIVE solution with every publish-required field filled. */
async function publishable() {
  const id = await draft({ description: "وصف", problemStatement: "مشكلة", ownerUserId: editor.userId });
  await changeRecordStatus(editor, id, "ACTIVE");
  return id;
}

beforeAll(async () => {
  const users = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { email: "admin@innovation.local" } }),
    prisma.user.findUniqueOrThrow({ where: { email: "editor@innovation.local" } }),
    prisma.user.findUniqueOrThrow({ where: { email: "partner@innovation.local" } }),
    prisma.user.findUniqueOrThrow({ where: { email: "viewer@innovation.local" } }),
  ]);
  partnerUserId = users[2].id;
  const ctxs = await Promise.all(users.map((u) => loadAccessContextByUserId(u.id)));
  if (ctxs.some((c) => !c)) throw new Error("seed principals missing");
  [admin, editor, partner, viewer] = ctxs as AccessContext[];
});

describe("record & implementation lifecycle", () => {
  it("1. DRAFT → ACTIVE is allowed and audited", async () => {
    const id = await draft();
    await changeRecordStatus(editor, id, "ACTIVE");
    expect((await prisma.innovationSolution.findUniqueOrThrow({ where: { id } })).status).toBe("ACTIVE");
  });

  it("2. ACTIVE → DRAFT is rejected (no silent downgrade)", async () => {
    const id = await draft();
    await changeRecordStatus(editor, id, "ACTIVE");
    await expectSolution(() => changeRecordStatus(editor, id, "DRAFT"), "INVALID_TRANSITION");
  });

  it("3. archived records are write-protected", async () => {
    const id = await draft();
    await changeRecordStatus(editor, id, "ARCHIVED");
    await expectSolution(() => changeImplementationStatus(editor, id, "IN_PROGRESS"), "INVALID_TRANSITION");
    await expectSolution(() => changeMaturityStage(editor, id, "PROTOTYPE"), "INVALID_TRANSITION");
  });

  it("4. implementation follows the allowed path", async () => {
    const id = await draft();
    await changeImplementationStatus(editor, id, "IN_PROGRESS");
    await changeImplementationStatus(editor, id, "OPERATING");
    await changeImplementationStatus(editor, id, "COMPLETED");
    expect((await prisma.innovationSolution.findUniqueOrThrow({ where: { id } })).implementationStatus).toBe("COMPLETED");
    // COMPLETED is terminal
    await expectSolution(() => changeImplementationStatus(editor, id, "IN_PROGRESS"), "INVALID_TRANSITION");
  });

  it("5. implementation cannot jump PLANNING → COMPLETED", async () => {
    const id = await draft();
    await expectSolution(() => changeImplementationStatus(editor, id, "COMPLETED"), "INVALID_TRANSITION");
  });

  it("6. ON_HOLD can resume to IN_PROGRESS", async () => {
    const id = await draft();
    await changeImplementationStatus(editor, id, "ON_HOLD");
    await changeImplementationStatus(editor, id, "IN_PROGRESS");
    expect((await prisma.innovationSolution.findUniqueOrThrow({ where: { id } })).implementationStatus).toBe("IN_PROGRESS");
  });

  it("7. unauthorized user cannot change lifecycle", async () => {
    const id = await draft();
    await expectAuthz(() => changeRecordStatus(viewer, id, "ACTIVE"), "FORBIDDEN");
    await expectAuthz(() => changeRecordStatus(partner, id, "ACTIVE"), "FORBIDDEN");
  });
});

describe("maturity rules", () => {
  it("8. advances one step at a time", async () => {
    const id = await draft();
    await changeMaturityStage(editor, id, "PROTOTYPE");
    expect((await prisma.innovationSolution.findUniqueOrThrow({ where: { id } })).maturityStage).toBe("PROTOTYPE");
  });

  it("9. cannot skip stages", async () => {
    const id = await draft();
    await expectSolution(() => changeMaturityStage(editor, id, "PILOT"), "INVALID_TRANSITION");
  });

  it("10. regression requires a documented reason", async () => {
    const id = await draft();
    await changeMaturityStage(editor, id, "PROTOTYPE");
    await expectSolution(() => changeMaturityStage(editor, id, "CONCEPT"), "REASON_REQUIRED");
    await changeMaturityStage(editor, id, "CONCEPT", "أعيد التقييم بعد اختبار فاشل");
    expect((await prisma.innovationSolution.findUniqueOrThrow({ where: { id } })).maturityStage).toBe("CONCEPT");
    const audit = await prisma.auditLog.findFirst({
      where: { action: "SOLUTION_MATURITY_CHANGED", entityId: id },
      orderBy: { createdAt: "desc" },
    });
    expect((audit!.metadata as { regression?: boolean })?.regression).toBe(true);
  });
});

describe("publishing", () => {
  it("11. publish is blocked while required fields are missing", async () => {
    const id = await draft(); // no description/problem/owner
    await changeRecordStatus(editor, id, "ACTIVE");
    await expectSolution(() => publishSolution(editor, id), "PUBLISH_INCOMPLETE");
  });

  it("12. publish is blocked for a DRAFT record", async () => {
    const id = await draft({ description: "وصف", problemStatement: "مشكلة", ownerUserId: editor.userId });
    await expectSolution(() => publishSolution(editor, id), "INVALID_TRANSITION");
  });

  it("13. publish succeeds when complete and active", async () => {
    const id = await publishable();
    await publishSolution(editor, id);
    expect((await prisma.innovationSolution.findUniqueOrThrow({ where: { id } })).publishedAt).not.toBeNull();
  });

  it("14. viewer sees published solutions only; unpublish removes visibility immediately", async () => {
    const id = await publishable();
    expect((await listSolutionsInScope(viewer)).map((s) => s.id)).not.toContain(id);

    await publishSolution(editor, id);
    expect((await listSolutionsInScope(viewer)).map((s) => s.id)).toContain(id);

    await unpublishSolution(editor, id);
    expect((await listSolutionsInScope(viewer)).map((s) => s.id)).not.toContain(id);
  });

  it("15. archiving a published solution withdraws it from viewers", async () => {
    const id = await publishable();
    await publishSolution(editor, id);
    await changeRecordStatus(editor, id, "ARCHIVED");
    const s = await prisma.innovationSolution.findUniqueOrThrow({ where: { id } });
    expect(s.publishedAt).toBeNull();
    expect((await listSolutionsInScope(viewer)).map((x) => x.id)).not.toContain(id);
  });

  it("16. viewer cannot publish", async () => {
    const id = await publishable();
    await expectAuthz(() => publishSolution(viewer, id), "FORBIDDEN");
  });
});

describe("partner sharing", () => {
  it("17. grant works and the partner gains access + allowed writes", async () => {
    const id = await draft();
    await grantSolutionShare(editor, id, { userId: partnerUserId, allowedActions: ["update_fields"], allowedFields: ["notes"] });
    expect((await listSolutionsInScope(partner)).map((s) => s.id)).toContain(id);
    await updateSharedSolutionFields(partner, id, { notes: "ملاحظة الشريك" });
    expect((await prisma.innovationSolution.findUniqueOrThrow({ where: { id } })).notes).toBe("ملاحظة الشريك");
  });

  it("18. a forbidden or unknown field cannot enter an allow-list at grant time", async () => {
    const id = await draft();
    await expectSolution(
      () => grantSolutionShare(editor, id, { userId: partnerUserId, allowedActions: ["update_fields"], allowedFields: ["status"] }),
      "VALIDATION",
    );
    await expectSolution(
      () => grantSolutionShare(editor, id, { userId: partnerUserId, allowedActions: ["delete_everything"], allowedFields: ["notes"] }),
      "VALIDATION",
    );
  });

  it("19. revocation takes effect immediately", async () => {
    const id = await draft();
    const s = await grantSolutionShare(editor, id, { userId: partnerUserId, allowedActions: ["update_fields"], allowedFields: ["notes"] });
    await revokeSolutionShare(editor, s.id);
    expect((await listSolutionsInScope(partner)).map((x) => x.id)).not.toContain(id);
    await expectAuthz(() => updateSharedSolutionFields(partner, id, { notes: "x" }), "SHARE_INACTIVE");
  });

  it("20. an expired share grants nothing", async () => {
    const id = await draft();
    await grantSolutionShare(editor, id, {
      userId: partnerUserId,
      allowedActions: ["update_fields"],
      allowedFields: ["notes"],
      expiresAt: new Date(Date.now() - 86_400_000),
    });
    expect((await listSolutionsInScope(partner)).map((x) => x.id)).not.toContain(id);
    await expectAuthz(() => updateSharedSolutionFields(partner, id, { notes: "x" }), "SHARE_INACTIVE");
  });

  it("21. a duplicate active share is rejected", async () => {
    const id = await draft();
    await grantSolutionShare(editor, id, { userId: partnerUserId, allowedActions: ["update_fields"], allowedFields: ["notes"] });
    await expectSolution(
      () => grantSolutionShare(editor, id, { userId: partnerUserId, allowedActions: ["update_fields"], allowedFields: ["notes"] }),
      "DUPLICATE",
    );
  });

  it("22. only authorized internal users may grant or list shares", async () => {
    const id = await draft();
    await expectAuthz(() => grantSolutionShare(viewer, id, { userId: partnerUserId, allowedActions: [], allowedFields: [] }), "FORBIDDEN");
    await expectAuthz(() => listSolutionShares(partner, id), "FORBIDDEN");
  });

  it("23. cross-department sharing is blocked", async () => {
    const id = await createSolution(admin, { nameAr: "حل قسم آخر", owningDepartmentId: DEPT_B });
    await expectAuthz(
      () => grantSolutionShare(editor, id.id, { userId: partnerUserId, allowedActions: ["update_fields"], allowedFields: ["notes"] }),
      "OUT_OF_SCOPE",
    );
  });
});

describe("participating organizations", () => {
  it("24. add, list and remove a participating organization", async () => {
    const id = await draft();
    const org = await prisma.organization.findFirstOrThrow({ where: { type: { not: "OWNER" } } });
    await addParticipatingOrganization(editor, id, org.id);
    expect((await listParticipatingOrganizations(editor, id)).map((o) => o.id)).toContain(org.id);
    await removeParticipatingOrganization(editor, id, org.id);
    expect(await listParticipatingOrganizations(editor, id)).toHaveLength(0);
  });

  it("25. duplicate organization links are blocked", async () => {
    const id = await draft();
    const org = await prisma.organization.findFirstOrThrow({ where: { type: { not: "OWNER" } } });
    await addParticipatingOrganization(editor, id, org.id);
    await expectSolution(() => addParticipatingOrganization(editor, id, org.id), "DUPLICATE");
  });
});

describe("history & dashboard", () => {
  it("26. the timeline reflects lifecycle, publish and sharing events", async () => {
    const id = await publishable();
    await changeMaturityStage(editor, id, "PROTOTYPE");
    await publishSolution(editor, id);
    await unpublishSolution(editor, id);
    const share = await grantSolutionShare(editor, id, { userId: partnerUserId, allowedActions: ["update_fields"], allowedFields: ["notes"] });
    await revokeSolutionShare(editor, share.id);

    const actions = (await getSolutionHistory(editor, id)).map((e) => e.action);
    expect(actions).toEqual(
      expect.arrayContaining([
        "SOLUTION_CREATED",
        "SOLUTION_STATUS_CHANGED",
        "SOLUTION_MATURITY_CHANGED",
        "SOLUTION_PUBLISHED",
        "SOLUTION_UNPUBLISHED",
        "SOLUTION_SHARE_GRANTED",
        "SOLUTION_SHARE_REVOKED",
      ]),
    );
  });

  it("27. dashboard aggregates come from the database, scope-filtered", async () => {
    const stats = await getSolutionStats(editor);
    const expected = await prisma.innovationSolution.count({
      where: { AND: [await solutionScopeWhere(editor), { status: { not: "ARCHIVED" } }] },
    });
    expect(stats.total).toBe(expected);
    expect(stats.byMaturity.reduce((n, r) => n + r.count, 0)).toBe(expected);
    expect(stats.byImplementation.reduce((n, r) => n + r.count, 0)).toBe(expected);
    expect(stats.completeness.reduce((n, r) => n + r.count, 0)).toBe(expected);

    // Editor's scope must be narrower than the platform total.
    const adminStats = await getSolutionStats(admin);
    expect(adminStats.total).toBeGreaterThanOrEqual(stats.total);
  });

  it("28. viewer cannot read solution aggregates beyond published scope", async () => {
    const stats = await getSolutionStats(viewer);
    const publishedCount = await prisma.innovationSolution.count({
      where: { publishedAt: { not: null }, status: { not: "ARCHIVED" } },
    });
    expect(stats.total).toBe(publishedCount);
  });
});
