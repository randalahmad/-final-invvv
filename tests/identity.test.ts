import { describe, it, expect, beforeAll } from "vitest";

import { prisma } from "@/server/db";
import { submitRegistration } from "@/modules/registration/service";
import { authenticateCredentials } from "@/modules/auth/authenticate";
import {
  approveRegistration,
  rejectRegistration,
  setAccountState,
  listUsersByRegistration,
  type Actor,
} from "@/modules/admin/users/service";
import { loadAccessContextByUserId } from "@/server/access-context";
import { AuthorizationError } from "@/server/authorization";

/**
 * Integration tests for the Phase 2B identity lifecycle, run against a
 * disposable PostgreSQL database (DATABASE_URL must point at it). Assumes the
 * schema is migrated and `npm run db:seed` has run (provides admin + editor).
 */

const PW = "Password123";
const suffix = () => Math.random().toString(36).slice(2, 10);

let adminActor: Actor;
let editorActor: Actor; // INTERNAL_EDITOR — lacks user.manage
let deptId: string;
let orgId: string;

async function register(role = "INTERNAL_EDITOR", extra: Record<string, unknown> = {}) {
  const email = `t_${suffix()}@example.test`;
  const res = await submitRegistration({
    name: "مستخدم اختبار",
    email,
    password: PW,
    confirmPassword: PW,
    requestedRole: role,
    acceptTerms: true,
    ...extra,
  });
  return { email, res };
}

async function approvePayload(userId: string) {
  return { userId, roleKey: "INTERNAL_EDITOR", scopeType: "DEPARTMENT", scopeId: deptId, organizationId: orgId };
}

beforeAll(async () => {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@innovation.local" } });
  const editor = await prisma.user.findUniqueOrThrow({ where: { email: "editor@innovation.local" } });
  const adminCtx = await loadAccessContextByUserId(admin.id);
  const editorCtx = await loadAccessContextByUserId(editor.id);
  if (!adminCtx || !editorCtx) throw new Error("seed users missing — run db:seed against the test DB");
  adminActor = { userId: adminCtx.userId, permissions: adminCtx.permissions };
  editorActor = { userId: editorCtx.userId, permissions: editorCtx.permissions };
  const dept = await prisma.department.findFirstOrThrow();
  deptId = dept.id;
  orgId = dept.organizationId;
});

describe("registration", () => {
  it("1. public registration creates a PENDING, role-less user", async () => {
    const { email, res } = await register();
    expect(res.ok).toBe(true);
    const u = await prisma.user.findUniqueOrThrow({
      where: { email },
      include: { roleAssignments: true },
    });
    expect(u.registrationStatus).toBe("PENDING");
    expect(u.status).toBe("INACTIVE");
    expect(u.roleAssignments.length).toBe(0);
  });

  it("2. SYSTEM_ADMIN cannot be requested publicly", async () => {
    const res = await submitRegistration({
      name: "x", email: `t_${suffix()}@example.test`, password: PW, confirmPassword: PW,
      requestedRole: "SYSTEM_ADMIN", acceptTerms: true,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("VALIDATION");
  });

  it("3. duplicate email is rejected", async () => {
    const { email } = await register();
    const dup = await submitRegistration({
      name: "مستخدم مكرر", email, password: PW, confirmPassword: PW, requestedRole: "VIEWER", acceptTerms: true,
    });
    expect(dup.ok).toBe(false);
    if (!dup.ok) expect(dup.error).toBe("DUPLICATE_EMAIL");
  });
});

describe("login enforcement", () => {
  it("4. PENDING user cannot log in", async () => {
    const { email } = await register();
    const r = await authenticateCredentials(email, PW);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("PENDING");
  });

  it("5. REJECTED user cannot log in", async () => {
    const { email } = await register();
    const u = await prisma.user.findUniqueOrThrow({ where: { email } });
    await rejectRegistration(adminActor, { userId: u.id, reason: "test" });
    const r = await authenticateCredentials(email, PW);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("REJECTED");
  });

  it("6. INACTIVE user cannot log in", async () => {
    const { email } = await register();
    const u = await prisma.user.findUniqueOrThrow({ where: { email } });
    await approveRegistration(adminActor, await approvePayload(u.id));
    await setAccountState(adminActor, { userId: u.id, action: "DEACTIVATE" });
    const r = await authenticateCredentials(email, PW);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("INACTIVE");
  });

  it("7. SUSPENDED user cannot log in", async () => {
    const { email } = await register();
    const u = await prisma.user.findUniqueOrThrow({ where: { email } });
    await approveRegistration(adminActor, await approvePayload(u.id));
    await setAccountState(adminActor, { userId: u.id, action: "SUSPEND" });
    const r = await authenticateCredentials(email, PW);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("SUSPENDED");
  });

  it("8. APPROVED + ACTIVE user can log in", async () => {
    const { email } = await register();
    const u = await prisma.user.findUniqueOrThrow({ where: { email } });
    await approveRegistration(adminActor, await approvePayload(u.id));
    const r = await authenticateCredentials(email, PW);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.user.roleKeys).toContain("INTERNAL_EDITOR");
  });

  it("8b. wrong password is rejected for an approved user", async () => {
    const { email } = await register();
    const u = await prisma.user.findUniqueOrThrow({ where: { email } });
    await approveRegistration(adminActor, await approvePayload(u.id));
    const r = await authenticateCredentials(email, "WrongPassword1");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("INVALID_CREDENTIALS");
  });
});

describe("admin approval / rejection", () => {
  it("8c. listUsersByRegistration enforces user.manage inside the service", async () => {
    await expect(listUsersByRegistration(adminActor, "PENDING")).resolves.toBeInstanceOf(Array);
    await expect(listUsersByRegistration(editorActor, "PENDING")).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("9. non-admin cannot approve a registration", async () => {
    const { email } = await register();
    const u = await prisma.user.findUniqueOrThrow({ where: { email } });
    const res = await approveRegistration(editorActor, await approvePayload(u.id));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("FORBIDDEN");
    const still = await prisma.user.findUniqueOrThrow({ where: { id: u.id }, include: { roleAssignments: true } });
    expect(still.registrationStatus).toBe("PENDING");
    expect(still.roleAssignments.length).toBe(0);
  });

  it("10. admin approval creates role assignment with scope + activates", async () => {
    const { email } = await register();
    const u = await prisma.user.findUniqueOrThrow({ where: { email } });
    const res = await approveRegistration(adminActor, await approvePayload(u.id));
    expect(res.ok).toBe(true);
    const after = await prisma.user.findUniqueOrThrow({
      where: { id: u.id },
      include: { roleAssignments: { include: { role: true } }, memberships: true },
    });
    expect(after.registrationStatus).toBe("APPROVED");
    expect(after.status).toBe("ACTIVE");
    expect(after.approvedById).toBe(adminActor.userId);
    const ra = after.roleAssignments[0];
    expect(ra.role.key).toBe("INTERNAL_EDITOR");
    expect(ra.scopeType).toBe("DEPARTMENT");
    expect(ra.scopeId).toBe(deptId);
    expect(after.memberships.length).toBeGreaterThan(0);
  });

  it("11. repeated approval is safely rejected (NOT_PENDING)", async () => {
    const { email } = await register();
    const u = await prisma.user.findUniqueOrThrow({ where: { email } });
    const first = await approveRegistration(adminActor, await approvePayload(u.id));
    expect(first.ok).toBe(true);
    const second = await approveRegistration(adminActor, await approvePayload(u.id));
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error).toBe("NOT_PENDING");
    const count = await prisma.userRole.count({ where: { userId: u.id } });
    expect(count).toBe(1);
  });

  it("12. rejection grants no role", async () => {
    const { email } = await register();
    const u = await prisma.user.findUniqueOrThrow({ where: { email } });
    const res = await rejectRegistration(adminActor, { userId: u.id, reason: "incomplete" });
    expect(res.ok).toBe(true);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: u.id }, include: { roleAssignments: true } });
    expect(after.registrationStatus).toBe("REJECTED");
    expect(after.roleAssignments.length).toBe(0);
  });

  it("13. approval and rejection write audit records", async () => {
    const a = await register();
    const au = await prisma.user.findUniqueOrThrow({ where: { email: a.email } });
    await approveRegistration(adminActor, await approvePayload(au.id));
    const approvedAudit = await prisma.auditLog.findFirst({
      where: { action: "REGISTRATION_APPROVED", entityId: au.id },
    });
    expect(approvedAudit).not.toBeNull();

    const r = await register("VIEWER");
    const ru = await prisma.user.findUniqueOrThrow({ where: { email: r.email } });
    await rejectRegistration(adminActor, { userId: ru.id, reason: "test" });
    const rejectedAudit = await prisma.auditLog.findFirst({
      where: { action: "REGISTRATION_REJECTED", entityId: ru.id },
    });
    expect(rejectedAudit).not.toBeNull();
  });
});
