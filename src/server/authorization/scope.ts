import type { LinkedEntityType, Prisma } from "@prisma/client";

import { prisma } from "@/server/db";
import type { AccessContext } from "@/server/access-context";
import { AuthorizationError } from "./errors";
import { getActiveShareSolutionIds } from "./share";

export interface EffectiveScopes {
  platform: boolean;
  organizationIds: string[];
  departmentIds: string[];
  solutionIds: string[];
  agreementIds: string[];
  published: boolean;
}

/** Aggregate a principal's scope grants into typed buckets. */
export function effectiveScopes(ctx: AccessContext): EffectiveScopes {
  const es: EffectiveScopes = {
    platform: false,
    organizationIds: [],
    departmentIds: [],
    solutionIds: [],
    agreementIds: [],
    published: false,
  };
  for (const s of ctx.scopes) {
    switch (s.scopeType) {
      case "PLATFORM":
        es.platform = true;
        break;
      case "ORGANIZATION":
        if (s.scopeId) es.organizationIds.push(s.scopeId);
        break;
      case "DEPARTMENT":
        if (s.scopeId) es.departmentIds.push(s.scopeId);
        break;
      case "SOLUTION":
        if (s.scopeId) es.solutionIds.push(s.scopeId);
        break;
      case "AGREEMENT":
        if (s.scopeId) es.agreementIds.push(s.scopeId);
        break;
      case "PUBLISHED":
        es.published = true;
        break;
    }
  }
  return es;
}

/** Matches no rows — the deny-by-default filter when a principal has no grant. */
const MATCH_NONE: Prisma.InnovationSolutionWhereInput = { id: "__no_access__" };

/**
 * Build a server-side WHERE fragment restricting InnovationSolution rows to the
 * caller's effective scope (union of grants). PLATFORM → unrestricted ({}).
 * SOLUTION scope is the union of directly-scoped ids AND ids reachable via an
 * active ResourceShare. PUBLISHED → only rows with publishedAt set.
 */
export async function solutionScopeWhere(ctx: AccessContext): Promise<Prisma.InnovationSolutionWhereInput> {
  const es = effectiveScopes(ctx);
  if (es.platform) return {};

  const or: Prisma.InnovationSolutionWhereInput[] = [];
  if (es.departmentIds.length) or.push({ owningDepartmentId: { in: es.departmentIds } });
  if (es.organizationIds.length) or.push({ owningDepartment: { organizationId: { in: es.organizationIds } } });

  const shareSolutionIds = await getActiveShareSolutionIds(ctx.userId);
  const solutionIds = Array.from(new Set([...es.solutionIds, ...shareSolutionIds]));
  if (solutionIds.length) or.push({ id: { in: solutionIds } });

  if (es.published) or.push({ publishedAt: { not: null } });

  if (or.length === 0) return MATCH_NONE;
  return { OR: or };
}

/** Fetch solutions already scope-filtered server-side (never trust client filters). */
export async function findSolutionsInScope(
  ctx: AccessContext,
  args?: { where?: Prisma.InnovationSolutionWhereInput; select?: Prisma.InnovationSolutionSelect },
) {
  const scopeWhere = await solutionScopeWhere(ctx);
  return prisma.innovationSolution.findMany({
    where: args?.where ? { AND: [scopeWhere, args.where] } : scopeWhere,
    ...(args?.select ? { select: args.select } : {}),
  });
}

/**
 * Assert a single record is inside the caller's scope (for reads/writes of one
 * record). Throws NOT_FOUND (missing) or OUT_OF_SCOPE (present but not visible).
 * Currently supports INNOVATION_SOLUTION (the canonical scoped entity).
 */
export async function requireScope(ctx: AccessContext, entityType: LinkedEntityType, entityId: string): Promise<void> {
  if (entityType === "INNOVATION_SOLUTION") return requireSolutionScope(ctx, entityId);
  if (entityType === "IDEA") return requireIdeaScope(ctx, entityId);
  throw new AuthorizationError("OUT_OF_SCOPE", `scope check not implemented for ${entityType}`);
}

async function requireSolutionScope(ctx: AccessContext, entityId: string): Promise<void> {
  const es = effectiveScopes(ctx);
  if (es.platform) {
    const exists = await prisma.innovationSolution.findUnique({ where: { id: entityId }, select: { id: true } });
    if (!exists) throw new AuthorizationError("NOT_FOUND");
    return;
  }

  const sol = await prisma.innovationSolution.findUnique({
    where: { id: entityId },
    select: { id: true, owningDepartmentId: true, publishedAt: true, owningDepartment: { select: { organizationId: true } } },
  });
  if (!sol) throw new AuthorizationError("NOT_FOUND");

  if (sol.owningDepartmentId && es.departmentIds.includes(sol.owningDepartmentId)) return;
  if (sol.owningDepartment && es.organizationIds.includes(sol.owningDepartment.organizationId)) return;
  const shareSolutionIds = await getActiveShareSolutionIds(ctx.userId);
  if (es.solutionIds.includes(sol.id) || shareSolutionIds.includes(sol.id)) return;
  if (es.published && sol.publishedAt) return;

  throw new AuthorizationError("OUT_OF_SCOPE");
}

async function requireIdeaScope(ctx: AccessContext, entityId: string): Promise<void> {
  const es = effectiveScopes(ctx);
  if (es.platform) {
    const exists = await prisma.idea.findUnique({ where: { id: entityId }, select: { id: true } });
    if (!exists) throw new AuthorizationError("NOT_FOUND");
    return;
  }
  const idea = await prisma.idea.findUnique({
    where: { id: entityId },
    select: { id: true, submittedById: true, departmentId: true, department: { select: { organizationId: true } } },
  });
  if (!idea) throw new AuthorizationError("NOT_FOUND");

  if (idea.submittedById && idea.submittedById === ctx.userId) return; // author always
  if (idea.departmentId && es.departmentIds.includes(idea.departmentId)) return;
  if (idea.department && es.organizationIds.includes(idea.department.organizationId)) return;

  throw new AuthorizationError("OUT_OF_SCOPE");
}

/**
 * WHERE fragment restricting Idea rows to the caller's scope: their own
 * authored ideas plus ideas owned by a department/organization they hold.
 * PLATFORM → unrestricted.
 */
export function ideaScopeWhere(ctx: AccessContext): Prisma.IdeaWhereInput {
  const es = effectiveScopes(ctx);
  if (es.platform) return {};
  const or: Prisma.IdeaWhereInput[] = [{ submittedById: ctx.userId }];
  if (es.departmentIds.length) or.push({ departmentId: { in: es.departmentIds } });
  if (es.organizationIds.length) or.push({ department: { organizationId: { in: es.organizationIds } } });
  return { OR: or };
}

/** Assert the caller may OWN a record in this department (create/re-home). */
export async function requireDepartmentScope(ctx: AccessContext, departmentId: string): Promise<void> {
  const es = effectiveScopes(ctx);
  if (es.platform) return;
  if (es.departmentIds.includes(departmentId)) return;
  if (es.organizationIds.length) {
    const dept = await prisma.department.findUnique({ where: { id: departmentId }, select: { organizationId: true } });
    if (dept && es.organizationIds.includes(dept.organizationId)) return;
  }
  throw new AuthorizationError("OUT_OF_SCOPE");
}

/** Published-only readers may see a record only when it is explicitly published. */
export function requirePublished(record: { publishedAt: Date | null }): void {
  if (!record.publishedAt) throw new AuthorizationError("NOT_PUBLISHED");
}

/**
 * Require the caller owns the record: is the named owner, or holds department/
 * organization/platform scope containing it. Used for owner-only mutations.
 */
export function requireOwnership(
  ctx: AccessContext,
  record: { ownerUserId?: string | null; owningDepartmentId?: string | null; organizationId?: string | null },
): void {
  const es = effectiveScopes(ctx);
  if (es.platform) return;
  if (record.ownerUserId && record.ownerUserId === ctx.userId) return;
  if (record.owningDepartmentId && es.departmentIds.includes(record.owningDepartmentId)) return;
  if (record.organizationId && es.organizationIds.includes(record.organizationId)) return;
  throw new AuthorizationError("NOT_OWNER");
}
