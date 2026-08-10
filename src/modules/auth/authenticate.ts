import bcrypt from "bcryptjs";

import { prisma } from "@/server/db";
import { writeAudit, AUDIT } from "@/server/audit";
import { checkRateLimit, clearRateLimit, consumeRateLimit } from "@/server/rate-limit";
import type { RequestMetadata } from "@/server/request-context";
import { DEMO_MODE, DEMO_PASSWORD, demoUserByEmail, demoRoleAssignments } from "@/server/demo-data";

export type AuthPrincipal = {
  id: string;
  name: string;
  email: string;
  registrationStatus: "PENDING" | "APPROVED" | "REJECTED";
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  roleKeys: string[];
};

export type AuthResult =
  | { ok: true; user: AuthPrincipal }
  | {
      ok: false;
      reason: "INVALID_CREDENTIALS" | "PENDING" | "REJECTED" | "INACTIVE" | "SUSPENDED" | "RATE_LIMITED";
      userId?: string;
      retryAfterSeconds?: number;
    };

async function recordLoginFailure(
  subject: { email: string; ipAddress: string | null },
  request: RequestMetadata,
  userId?: string,
): Promise<AuthResult | null> {
  const limited = await consumeRateLimit("LOGIN", subject);
  if (limited.allowed) return null;
  await writeAudit({
    actorUserId: userId ?? null,
    action: AUDIT.LOGIN_RATE_LIMITED,
    entityId: userId ?? null,
    summary: "تجاوز حد محاولات تسجيل الدخول",
    metadata: { retryAfterSeconds: limited.retryAfterSeconds },
    ipAddress: request.ipAddress,
    userAgent: request.userAgent,
  });
  return { ok: false, reason: "RATE_LIMITED", userId, retryAfterSeconds: limited.retryAfterSeconds };
}

/**
 * Server-side credential check with account-state gating (Task C).
 * A user authenticates ONLY when the password is correct AND
 * registrationStatus = APPROVED AND status = ACTIVE. Password verification is
 * never weakened or skipped. Reasons are distinguished only AFTER a correct
 * password, so account state is not disclosed to arbitrary users.
 */
export async function authenticateCredentials(
  emailRaw: string,
  password: string,
  request: RequestMetadata = { ipAddress: null, userAgent: null },
): Promise<AuthResult> {
  const email = emailRaw.trim().toLowerCase();

  // DEMO_MODE: no database at all. Match against the fixed local demo
  // accounts (src/server/demo-data.ts) with a single shared password —
  // no Prisma, no bcrypt, no rate-limit/audit writes.
  if (DEMO_MODE) {
    const demoUser = demoUserByEmail(email);
    if (!demoUser || password !== DEMO_PASSWORD) return { ok: false, reason: "INVALID_CREDENTIALS" };
    const roleKeys = demoRoleAssignments(demoUser).map((a) => a.role.key);
    return { ok: true, user: { id: demoUser.id, name: demoUser.name, email: demoUser.email, registrationStatus: demoUser.registrationStatus, status: demoUser.status, roleKeys } };
  }

  const subject = { email, ipAddress: request.ipAddress };
  const preflight = await checkRateLimit("LOGIN", subject);
  if (!preflight.allowed) {
    await writeAudit({
      action: AUDIT.LOGIN_RATE_LIMITED,
      summary: "محاولة تسجيل دخول أثناء فترة الحظر",
      metadata: { retryAfterSeconds: preflight.retryAfterSeconds },
      ipAddress: request.ipAddress,
      userAgent: request.userAgent,
    });
    return { ok: false, reason: "RATE_LIMITED", retryAfterSeconds: preflight.retryAfterSeconds };
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      name: true,
      email: true,
      passwordHash: true,
      registrationStatus: true,
      status: true,
      roleAssignments: { select: { role: { select: { key: true } } } },
    },
  });

  if (!user?.passwordHash) {
    return (await recordLoginFailure(subject, request)) ?? { ok: false, reason: "INVALID_CREDENTIALS" };
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return (await recordLoginFailure(subject, request, user.id)) ?? { ok: false, reason: "INVALID_CREDENTIALS" };
  }

  const blockedReason =
    user.registrationStatus === "PENDING"
      ? "PENDING"
      : user.registrationStatus === "REJECTED"
        ? "REJECTED"
        : user.status === "INACTIVE"
          ? "INACTIVE"
          : user.status === "SUSPENDED"
            ? "SUSPENDED"
            : null;
  if (blockedReason) {
    return (
      (await recordLoginFailure(subject, request, user.id)) ?? {
        ok: false,
        reason: blockedReason,
        userId: user.id,
      }
    );
  }

  await clearRateLimit("LOGIN", subject);
  const roleKeys = Array.from(new Set(user.roleAssignments.map((r) => r.role.key)));
  return {
    ok: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      registrationStatus: user.registrationStatus,
      status: user.status,
      roleKeys,
    },
  };
}
