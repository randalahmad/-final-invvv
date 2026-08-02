import { describe, it, expect, beforeAll } from "vitest";

import { prisma } from "@/server/db";
import { loadAccessContextByUserId, type AccessContext } from "@/server/access-context";
import {
  effectiveScopes,
  findSolutionsInScope,
  requireScope,
  requirePublished,
  requireOwnership,
  requirePermission,
  isShareActive,
  requireShareAction,
  assertFieldsWithinShare,
  requirePartnerFieldWrite,
  assertMutable,
  supersedeDecision,
  reopenMeasurement,
  AuthorizationError,
} from "@/server/authorization";

/**
 * Phase 2C authorization integration tests, against a disposable PostgreSQL DB.
 * Uses the seeded principals (admin=PLATFORM, editor=DEPARTMENT dept-digital,
 * partner=SOLUTION sol-seed, viewer=PUBLISHED) plus dedicated fixtures.
 */

const DEPT_A = "dept-digital"; // editor's department
const DEPT_B = "dept-strategy"; // other department
const SOL_A = "sol-seed"; // dept-digital, shared+scoped to partner
const SOL_B = "test-solB"; // dept-strategy, unshared, unpublished
const SOL_PUB = "test-solPub"; // dept-strategy, published
const SOL_SHARE_ACTIVE = "test-solShareActive"; // reachable only via an active share
const SOL_SHARE_EXPIRED = "test-solShareExpired"; // only via an expired share

let admin: AccessContext, editor: AccessContext, partner: AccessContext, viewer: AccessContext;
let adminId = "", partnerId = "";

async function expectCode(fn: () => unknown | Promise<unknown>, code: string) {
  try {
    await fn();
    throw new Error("expected to throw " + code);
  } catch (e) {
    expect(e, `expected AuthorizationError(${code})`).toBeInstanceOf(AuthorizationError);
    expect((e as AuthorizationError).code).toBe(code);
  }
}

async function upsertSolution(id: string, deptId: string, published = false) {
  await prisma.innovationSolution.upsert({
    where: { id },
    update: { publishedAt: published ? new Date() : null },
    create: { id, nameAr: `حل اختبار ${id}`, owningDepartmentId: deptId, source: "INTERNAL_PROPOSAL", publishedAt: published ? new Date() : null },
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
  const ctxs = await Promise.all([
    loadAccessContextByUserId(a.id),
    loadAccessContextByUserId(e.id),
    loadAccessContextByUserId(p.id),
    loadAccessContextByUserId(v.id),
  ]);
  if (ctxs.some((c) => !c)) throw new Error("seed principals missing — run db:seed against the test DB");
  [admin, editor, partner, viewer] = ctxs as AccessContext[];

  // Fixtures
  await upsertSolution(SOL_B, DEPT_B);
  await upsertSolution(SOL_PUB, DEPT_B, true);
  await upsertSolution(SOL_SHARE_ACTIVE, DEPT_B);
  await upsertSolution(SOL_SHARE_EXPIRED, DEPT_B);

  await prisma.resourceShare.upsert({
    where: { id: "test-share-active" },
    update: { revokedAt: null, expiresAt: null },
    create: {
      id: "test-share-active", userId: partnerId, entityType: "INNOVATION_SOLUTION", solutionId: SOL_SHARE_ACTIVE,
      allowedActions: ["update_fields"], allowedFields: ["notes"], grantedById: adminId,
    },
  });
  await prisma.resourceShare.upsert({
    where: { id: "test-share-expired" },
    update: { expiresAt: new Date(Date.now() - 86_400_000) },
    create: {
      id: "test-share-expired", userId: partnerId, entityType: "INNOVATION_SOLUTION", solutionId: SOL_SHARE_EXPIRED,
      allowedActions: ["update_fields"], allowedFields: ["notes"], grantedById: adminId, expiresAt: new Date(Date.now() - 86_400_000),
    },
  });

  await prisma.ideaDecision.upsert({
    where: { id: "test-dec-final" }, update: { finalizedAt: new Date() },
    create: { id: "test-dec-final", ideaId: "idea-seed", decision: "APPROVE_FOR_PILOT", finalizedAt: new Date(), finalizedById: adminId },
  });
  await prisma.impactMeasurement.upsert({
    where: { id: "test-meas-verified" }, update: { verificationStatus: "VERIFIED", verifiedAt: new Date() },
    create: { id: "test-meas-verified", indicatorId: "imp-seed", verificationStatus: "VERIFIED", verifiedAt: new Date(), verifiedById: adminId, actualValue: "90.0000" },
  });
});

describe("effective scopes", () => {
  it("1. editor resolves to a DEPARTMENT grant", () => {
    const es = effectiveScopes(editor);
    expect(es.platform).toBe(false);
    expect(es.departmentIds).toContain(DEPT_A);
  });
  it("2. admin resolves to a PLATFORM grant", () => {
    expect(effectiveScopes(admin).platform).toBe(true);
  });
  it("3. viewer resolves to PUBLISHED", () => {
    expect(effectiveScopes(viewer).published).toBe(true);
  });
});

describe("scope-filtered reads (findSolutionsInScope)", () => {
  it("4. admin (PLATFORM) sees all fixture solutions", async () => {
    const ids = (await findSolutionsInScope(admin)).map((s) => s.id);
    expect(ids).toEqual(expect.arrayContaining([SOL_A, SOL_B, SOL_PUB]));
  });
  it("5. editor (DEPARTMENT) sees their department's solution", async () => {
    const ids = (await findSolutionsInScope(editor)).map((s) => s.id);
    expect(ids).toContain(SOL_A);
  });
  it("6. editor does NOT see another department's solution", async () => {
    const ids = (await findSolutionsInScope(editor)).map((s) => s.id);
    expect(ids).not.toContain(SOL_B);
  });
  it("7. partner (SOLUTION) sees a shared solution", async () => {
    const ids = (await findSolutionsInScope(partner)).map((s) => s.id);
    expect(ids).toContain(SOL_A);
  });
  it("8. partner does NOT see an unshared solution", async () => {
    const ids = (await findSolutionsInScope(partner)).map((s) => s.id);
    expect(ids).not.toContain(SOL_B);
  });
  it("9. partner sees a solution reachable via an ACTIVE share", async () => {
    const ids = (await findSolutionsInScope(partner)).map((s) => s.id);
    expect(ids).toContain(SOL_SHARE_ACTIVE);
  });
  it("10. partner does NOT see a solution whose share EXPIRED", async () => {
    const ids = (await findSolutionsInScope(partner)).map((s) => s.id);
    expect(ids).not.toContain(SOL_SHARE_EXPIRED);
  });
  it("11. viewer (PUBLISHED) sees only published solutions", async () => {
    const ids = (await findSolutionsInScope(viewer)).map((s) => s.id);
    expect(ids).toContain(SOL_PUB);
    expect(ids).not.toContain(SOL_A);
  });
});

describe("single-record scope (requireScope)", () => {
  it("12. editor may access their department's record", async () => {
    await expect(requireScope(editor, "INNOVATION_SOLUTION", SOL_A)).resolves.toBeUndefined();
  });
  it("13. editor is OUT_OF_SCOPE for another department", async () => {
    await expectCode(() => requireScope(editor, "INNOVATION_SOLUTION", SOL_B), "OUT_OF_SCOPE");
  });
  it("14. admin may access any record", async () => {
    await expect(requireScope(admin, "INNOVATION_SOLUTION", SOL_B)).resolves.toBeUndefined();
  });
  it("15. missing record → NOT_FOUND", async () => {
    await expectCode(() => requireScope(editor, "INNOVATION_SOLUTION", "does-not-exist"), "NOT_FOUND");
  });
  it("16. viewer may access a published record but not an unpublished one", async () => {
    await expect(requireScope(viewer, "INNOVATION_SOLUTION", SOL_PUB)).resolves.toBeUndefined();
    await expectCode(() => requireScope(viewer, "INNOVATION_SOLUTION", SOL_A), "OUT_OF_SCOPE");
  });
  it("17. partner may access a shared record but not an unshared one", async () => {
    await expect(requireScope(partner, "INNOVATION_SOLUTION", SOL_A)).resolves.toBeUndefined();
    await expectCode(() => requireScope(partner, "INNOVATION_SOLUTION", SOL_B), "OUT_OF_SCOPE");
  });
});

describe("ResourceShare enforcement", () => {
  it("18. isShareActive: revoked/expired inactive, future-expiry active", () => {
    expect(isShareActive({ revokedAt: new Date(), expiresAt: null })).toBe(false);
    expect(isShareActive({ revokedAt: null, expiresAt: new Date(Date.now() - 1000) })).toBe(false);
    expect(isShareActive({ revokedAt: null, expiresAt: new Date(Date.now() + 86_400_000) })).toBe(true);
    expect(isShareActive({ revokedAt: null, expiresAt: null })).toBe(true);
  });
  it("19. requireShareAction returns the share for an allowed action", async () => {
    const share = await requireShareAction(partner, "INNOVATION_SOLUTION", SOL_SHARE_ACTIVE, "update_fields");
    expect(share.allowedFields).toContain("notes");
  });
  it("20. requireShareAction rejects a disallowed action", async () => {
    await expectCode(() => requireShareAction(partner, "INNOVATION_SOLUTION", SOL_SHARE_ACTIVE, "approve_evidence"), "ACTION_NOT_ALLOWED");
  });
  it("21. requireShareAction rejects an entity with no active share", async () => {
    await expectCode(() => requireShareAction(partner, "INNOVATION_SOLUTION", SOL_SHARE_EXPIRED, "update_fields"), "SHARE_INACTIVE");
  });
});

describe("field-level restrictions", () => {
  const share = { allowedFields: ["notes"] };
  it("22. allowed field passes", () => {
    expect(() => assertFieldsWithinShare(share, ["notes"])).not.toThrow();
  });
  it("23. field outside allow-list is FIELD_FORBIDDEN", async () => {
    await expectCode(() => assertFieldsWithinShare(share, ["title"]), "FIELD_FORBIDDEN");
  });
  it("24. globally-forbidden field is rejected even if allow-listed", async () => {
    await expectCode(() => assertFieldsWithinShare({ allowedFields: ["ownerUserId"] }, ["ownerUserId"]), "FIELD_FORBIDDEN");
  });
  it("25. partner may write an allowed field on a shared solution", async () => {
    await expect(requirePartnerFieldWrite(partner, "INNOVATION_SOLUTION", SOL_SHARE_ACTIVE, ["notes"])).resolves.toBeDefined();
  });
  it("26. partner may NOT change status via a field write", async () => {
    await expectCode(() => requirePartnerFieldWrite(partner, "INNOVATION_SOLUTION", SOL_SHARE_ACTIVE, ["status"]), "FIELD_FORBIDDEN");
  });
});

describe("permission guards (viewer/partner cannot mutate)", () => {
  it("27. viewer cannot update a solution", async () => {
    await expectCode(() => requirePermission(viewer, "solution.update"), "FORBIDDEN");
  });
  it("28. editor can update a solution", () => {
    expect(() => requirePermission(editor, "solution.update")).not.toThrow();
  });
  it("29. partner can never approve evidence", async () => {
    await expectCode(() => requirePermission(partner, "evidence.approve"), "FORBIDDEN");
  });
});

describe("ownership", () => {
  it("30. editor owns records in their department, not others", async () => {
    expect(() => requireOwnership(editor, { owningDepartmentId: DEPT_A })).not.toThrow();
    await expectCode(() => requireOwnership(editor, { owningDepartmentId: DEPT_B }), "NOT_OWNER");
  });
  it("31. requirePublished rejects an unpublished record", async () => {
    expect(() => requirePublished({ publishedAt: new Date() })).not.toThrow();
    await expectCode(() => requirePublished({ publishedAt: null }), "NOT_PUBLISHED");
  });
});

describe("immutability (Layer 5)", () => {
  it("32. finalized decision is immutable; open decision is mutable", async () => {
    await expectCode(() => assertMutable("IDEA_DECISION", { finalizedAt: new Date() }), "IMMUTABLE");
    expect(() => assertMutable("IDEA_DECISION", { finalizedAt: null })).not.toThrow();
  });
  it("33. verified measurement is immutable; unverified is mutable", async () => {
    await expectCode(() => assertMutable("IMPACT_MEASUREMENT", { verificationStatus: "VERIFIED" }), "IMMUTABLE");
    expect(() => assertMutable("IMPACT_MEASUREMENT", { verificationStatus: "PENDING" })).not.toThrow();
  });
  it("34. supersedeDecision creates a linked superseding record + audit", async () => {
    const created = await supersedeDecision(admin, "test-dec-final", { decision: "REJECT", notes: "correction" });
    const row = await prisma.ideaDecision.findUniqueOrThrow({ where: { id: created.id } });
    expect(row.supersedesId).toBe("test-dec-final");
    const audit = await prisma.auditLog.findFirst({
      where: { action: "DECISION_SUPERSEDED", entityType: "IDEA", entityId: "idea-seed" },
      orderBy: { createdAt: "desc" },
    });
    expect(audit).not.toBeNull();
    expect(audit?.metadata).toMatchObject({ decisionId: created.id, supersedesDecisionId: "test-dec-final" });
  });
  it("35. non-privileged actor cannot supersede a decision", async () => {
    await expectCode(() => supersedeDecision(editor, "test-dec-final", { decision: "REJECT" }), "FORBIDDEN");
  });
  it("36. reopenMeasurement returns a verified result to PENDING + audit", async () => {
    await reopenMeasurement(admin, "test-meas-verified", "recount required");
    const row = await prisma.impactMeasurement.findUniqueOrThrow({ where: { id: "test-meas-verified" } });
    expect(row.verificationStatus).toBe("PENDING");
    expect(row.verifiedAt).toBeNull();
    expect(row.reopenReason).toBe("recount required");
    const audit = await prisma.auditLog.findFirst({
      where: { action: "MEASUREMENT_REOPENED", entityType: "IMPACT_MEASUREMENT", entityId: "test-meas-verified" },
    });
    expect(audit).not.toBeNull();
    expect(audit?.metadata).toMatchObject({ measurementId: "test-meas-verified" });
  });
});
