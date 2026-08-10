/**
 * DEMO_MODE mock Prisma client. Deliberately does NOT import/construct the
 * real `@prisma/client` PrismaClient — no query engine is loaded, no
 * DATABASE_URL is read, nothing touches a real database. Every
 * `prisma.<model>.<method>(...)` call used throughout the codebase is
 * intercepted generically via a Proxy.
 *
 * Design (deliberately conservative — favors "renders with empty/demo data"
 * over "throws"):
 *  - read-many methods (findMany, groupBy) → curated demo array if one
 *    exists for that model, else [].
 *  - read-one methods (findFirst/findUnique) → matching demo row if found,
 *    else null. The *OrThrow variants throw a NotFoundError instead (mirrors
 *    real Prisma P2025 behavior) so existing NOT_FOUND handling in the app's
 *    own service layer still works and routes to Next.js `notFound()`/
 *    `error.tsx` boundaries rather than an unhandled crash.
 *  - count/aggregate → zeros; the demo array's length where applicable.
 *  - create/update/upsert → merges the input `data` with a demo id and
 *    echoes it back (nothing persists across requests — this is a
 *    read-mostly showcase, not a working write path).
 *  - delete/deleteMany/updateMany → `{ count: 0 }`-shaped no-ops.
 *  - $transaction → runs the callback against this same mock client (array
 *    form resolves each already-created promise, matching real Prisma).
 *  - $queryRaw/$executeRaw → empty/zero.
 */
import {
  DEMO_USERS,
  DEMO_REQUIREMENT_ASSIGNMENTS,
  DEMO_SOLUTIONS,
  DEMO_TASKS,
  DEMO_AUDIT_LOG,
  demoRoleAssignments,
  type DemoUser,
} from "./demo-data";

class DemoNotFoundError extends Error {
  code = "P2025";
  constructor(model: string) {
    super(`Demo mode: no matching ${model} record.`);
    this.name = "PrismaClientKnownRequestError";
  }
}

function toFullUser(u: DemoUser) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    jobTitle: u.jobTitle,
    status: u.status,
    registrationStatus: u.registrationStatus,
    passwordHash: null, // demo login bypasses password checking entirely (see authenticate.ts)
    departmentId: u.departmentId,
    organizationId: u.organizationId,
    roleAssignments: demoRoleAssignments(u),
    createdAt: new Date(),
    updatedAt: new Date(),
    archivedAt: null,
  };
}

const DEMO_TABLES: Record<string, unknown[]> = {
  user: DEMO_USERS.map(toFullUser),
  complianceRequirementAssignment: DEMO_REQUIREMENT_ASSIGNMENTS,
  innovationSolution: DEMO_SOLUTIONS,
  requirementTask: DEMO_TASKS,
  auditLog: DEMO_AUDIT_LOG,
};

function matchesWhere(row: Record<string, unknown>, where: Record<string, unknown> | undefined): boolean {
  if (!where) return true;
  return Object.entries(where).every(([key, value]) => {
    if (value === undefined) return true;
    if (key === "id" || key === "email") return row[key] === value;
    return true; // unknown/complex filter shapes: don't exclude in demo mode
  });
}

function findRows(model: string, where?: Record<string, unknown>): Record<string, unknown>[] {
  const rows = (DEMO_TABLES[model] as Record<string, unknown>[] | undefined) ?? [];
  return where ? rows.filter((r) => matchesWhere(r, where)) : rows;
}

function modelHandler(model: string) {
  return {
    findMany: async (args?: { where?: Record<string, unknown> }) => findRows(model, args?.where),
    findFirst: async (args?: { where?: Record<string, unknown> }) => findRows(model, args?.where)[0] ?? null,
    findUnique: async (args?: { where?: Record<string, unknown> }) => {
      if (model === "user" && args?.where && (args.where.email || args.where.id)) {
        const key = (args.where.email as string | undefined) ?? (args.where.id as string | undefined);
        const row = DEMO_TABLES.user.find((u) => (u as { id: string; email: string }).id === key || (u as { id: string; email: string }).email === key);
        return row ?? null;
      }
      return findRows(model, args?.where)[0] ?? null;
    },
    findFirstOrThrow: async (args?: { where?: Record<string, unknown> }) => {
      const row = findRows(model, args?.where)[0];
      if (!row) throw new DemoNotFoundError(model);
      return row;
    },
    findUniqueOrThrow: async (args?: { where?: Record<string, unknown> }) => {
      const row = findRows(model, args?.where)[0];
      if (!row) throw new DemoNotFoundError(model);
      return row;
    },
    count: async (args?: { where?: Record<string, unknown> }) => findRows(model, args?.where).length,
    aggregate: async () => ({ _count: 0, _sum: {}, _avg: {}, _min: {}, _max: {} }),
    groupBy: async () => [],
    create: async (args: { data: Record<string, unknown> }) => ({ id: `demo-${model}-${Math.random().toString(36).slice(2, 9)}`, createdAt: new Date(), updatedAt: new Date(), ...args.data }),
    createMany: async (args: { data: unknown[] }) => ({ count: args.data?.length ?? 0 }),
    update: async (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => ({ ...(findRows(model, args.where)[0] ?? {}), ...args.data, updatedAt: new Date() }),
    updateMany: async () => ({ count: 0 }),
    upsert: async (args: { where: Record<string, unknown>; create: Record<string, unknown>; update: Record<string, unknown> }) => {
      const existing = findRows(model, args.where)[0];
      return existing ? { ...existing, ...args.update, updatedAt: new Date() } : { id: `demo-${model}-${Math.random().toString(36).slice(2, 9)}`, createdAt: new Date(), updatedAt: new Date(), ...args.create };
    },
    delete: async (args: { where: Record<string, unknown> }) => {
      const row = findRows(model, args.where)[0];
      if (!row) throw new DemoNotFoundError(model);
      return row;
    },
    deleteMany: async () => ({ count: 0 }),
  };
}

const modelCache = new Map<string, ReturnType<typeof modelHandler>>();

export function createDemoPrismaClient(): Record<string, unknown> {
  const client: Record<string, unknown> = {
    $transaction: async (arg: unknown) => {
      if (typeof arg === "function") return (arg as (tx: unknown) => unknown)(client);
      if (Array.isArray(arg)) return Promise.all(arg);
      return arg;
    },
    $queryRaw: async () => [],
    $queryRawUnsafe: async () => [],
    $executeRaw: async () => 0,
    $executeRawUnsafe: async () => 0,
    $connect: async () => undefined,
    $disconnect: async () => undefined,
    $use: () => undefined,
  };
  return new Proxy(client, {
    get(target, prop: string) {
      if (prop in target) return (target as Record<string, unknown>)[prop];
      if (!modelCache.has(prop)) modelCache.set(prop, modelHandler(prop));
      return modelCache.get(prop);
    },
  });
}
