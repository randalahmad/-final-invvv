import bcrypt from "bcryptjs";

import { prisma } from "@/server/db";
import { writeAudit, AUDIT } from "@/server/audit";
import { consumeRateLimit } from "@/server/rate-limit";
import type { RequestMetadata } from "@/server/request-context";
import { registerSchema, PUBLIC_REQUESTABLE_ROLES, type RegisterInput } from "./schema";

export type RegisterResult =
  | { ok: true; userId: string }
  | {
      ok: false;
      error: "DUPLICATE_EMAIL" | "INVALID_ROLE" | "VALIDATION" | "RATE_LIMITED";
      fieldErrors?: Record<string, string[]>;
      retryAfterSeconds?: number;
    };

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Create a PENDING self-registration. Whitelists only intake fields — no role,
 * scope, or status is mass-assignable here. The account starts:
 *   registrationStatus = PENDING, status = INACTIVE
 * and receives NO UserRole until an administrator approves it.
 */
export async function registerUser(
  input: RegisterInput,
  request: RequestMetadata = { ipAddress: null, userAgent: null },
): Promise<RegisterResult> {
  // Defense-in-depth: never accept a non-public (e.g. SYSTEM_ADMIN) requested role,
  // even if a caller bypassed the Zod layer.
  if (!PUBLIC_REQUESTABLE_ROLES.includes(input.requestedRole)) {
    return { ok: false, error: "INVALID_ROLE" };
  }

  const email = normalizeEmail(input.email);
  const rateLimit = await consumeRateLimit("REGISTRATION", { email, ipAddress: request.ipAddress });
  if (!rateLimit.allowed) {
    await writeAudit({
      action: AUDIT.REGISTRATION_RATE_LIMITED,
      summary: "تجاوز حد محاولات التسجيل",
      metadata: { retryAfterSeconds: rateLimit.retryAfterSeconds },
      ipAddress: request.ipAddress,
      userAgent: request.userAgent,
    });
    return { ok: false, error: "RATE_LIMITED", retryAfterSeconds: rateLimit.retryAfterSeconds };
  }
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) return { ok: false, error: "DUPLICATE_EMAIL" };

  const passwordHash = await bcrypt.hash(input.password, 10);

  try {
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name: input.name.trim(),
          email,
          passwordHash,
          status: "INACTIVE", // not operational until approved
          registrationStatus: "PENDING",
          requestedRoleKey: input.requestedRole,
          requestedOrgType: input.requestedOrgType ?? null,
          requestedOrganizationName: input.requestedOrganizationName?.trim() || null,
          requestedDepartmentId: input.requestedDepartmentId?.trim() || null,
          registrationNote: input.registrationNote?.trim() || null,
        },
        select: { id: true },
      });
      await writeAudit(
        {
          actorUserId: created.id,
          action: AUDIT.USER_REGISTERED,
          entityId: created.id,
          summary: "تسجيل جديد بانتظار المراجعة",
          metadata: { requestedRole: input.requestedRole },
        },
        tx,
      );
      return created;
    });
    return { ok: true, userId: user.id };
  } catch (e) {
    // Unique race: another request created the same email between check and insert.
    if (typeof e === "object" && e && (e as { code?: string }).code === "P2002") {
      return { ok: false, error: "DUPLICATE_EMAIL" };
    }
    throw e;
  }
}

/**
 * Validate raw input then register. Used by the server action and tests so the
 * SYSTEM_ADMIN-rejection and validation rules are enforced in one place.
 */
export async function submitRegistration(
  raw: unknown,
  request: RequestMetadata = { ipAddress: null, userAgent: null },
): Promise<RegisterResult> {
  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "VALIDATION", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  return registerUser(parsed.data, request);
}
