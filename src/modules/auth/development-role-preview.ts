import { ROLE_KEYS, type RoleKey } from "@/modules/auth/permissions";
import { DEMO_MODE, DEMO_USERS } from "@/server/demo-data";
import { prisma } from "@/server/db";
import type { AuthPrincipal } from "./authenticate";

/**
 * Local-only development aid. It is intentionally disabled outside `next dev`
 * and only ever resolves the four seeded demo identities; it cannot select an
 * arbitrary user or grant a role that is not already assigned in the system.
 */
export function isDevelopmentRolePreviewEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV === "development" && env.UX_PREVIEW_MODE !== "true";
}

const DEVELOPMENT_ROLE_ACCOUNTS = [
  { email: "admin@innovation.local", roleKey: ROLE_KEYS.SYSTEM_ADMIN, label: "مدير النظام" },
  { email: "editor@innovation.local", roleKey: ROLE_KEYS.INTERNAL_EDITOR, label: "محرر داخلي" },
  { email: "partner@innovation.local", roleKey: ROLE_KEYS.EXTERNAL_PARTNER, label: "شريك خارجي" },
  { email: "viewer@innovation.local", roleKey: ROLE_KEYS.VIEWER, label: "مطّلع" },
] as const;

export type DevelopmentRolePreviewOption = {
  email: string;
  name: string;
  label: string;
  roleKey: RoleKey;
};

function allowedAccount(emailRaw: string) {
  const email = emailRaw.trim().toLowerCase();
  return DEVELOPMENT_ROLE_ACCOUNTS.find((account) => account.email === email) ?? null;
}

/** Returns only active, approved demo identities that actually carry the expected seeded role. */
export async function listDevelopmentRolePreviewOptions(): Promise<DevelopmentRolePreviewOption[]> {
  if (!isDevelopmentRolePreviewEnabled()) return [];

  if (DEMO_MODE) {
    return DEVELOPMENT_ROLE_ACCOUNTS.flatMap((account) => {
      const user = DEMO_USERS.find((item) => item.email === account.email && item.roleKey === account.roleKey);
      return user ? [{ ...account, name: user.name }] : [];
    });
  }

  const users = await prisma.user.findMany({
    where: { email: { in: DEVELOPMENT_ROLE_ACCOUNTS.map((account) => account.email) } },
    select: {
      name: true,
      email: true,
      status: true,
      registrationStatus: true,
      roleAssignments: { select: { role: { select: { key: true } } } },
    },
  });

  return DEVELOPMENT_ROLE_ACCOUNTS.flatMap((account) => {
    const user = users.find((item) => item.email.toLowerCase() === account.email);
    const hasExpectedRole = user?.roleAssignments.some((assignment) => assignment.role.key === account.roleKey);
    return user && user.status === "ACTIVE" && user.registrationStatus === "APPROVED" && hasExpectedRole
      ? [{ ...account, name: user.name }]
      : [];
  });
}

/**
 * Used only by the Credentials provider while running locally. The returned
 * principal is the same real account principal used after a normal login, so
 * all subsequent authorization stays server-side and scope-aware.
 */
export async function authenticateDevelopmentRolePreview(emailRaw: string): Promise<AuthPrincipal | null> {
  if (!isDevelopmentRolePreviewEnabled()) return null;
  const account = allowedAccount(emailRaw);
  if (!account) return null;

  if (DEMO_MODE) {
    const user = DEMO_USERS.find((item) => item.email === account.email && item.roleKey === account.roleKey);
    return user
      ? {
          id: user.id,
          name: user.name,
          email: user.email,
          status: user.status,
          registrationStatus: user.registrationStatus,
          roleKeys: [user.roleKey],
        }
      : null;
  }

  const user = await prisma.user.findUnique({
    where: { email: account.email },
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      registrationStatus: true,
      roleAssignments: { select: { role: { select: { key: true } } } },
    },
  });
  if (!user || user.status !== "ACTIVE" || user.registrationStatus !== "APPROVED") return null;

  const roleKeys = Array.from(new Set(user.roleAssignments.map((assignment) => assignment.role.key)));
  if (!roleKeys.includes(account.roleKey)) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    status: user.status as AuthPrincipal["status"],
    registrationStatus: user.registrationStatus as AuthPrincipal["registrationStatus"],
    roleKeys,
  };
}
