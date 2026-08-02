import { prisma } from "@/server/db";
import type { AccessContext } from "@/server/access-context";
import { requirePermission, effectiveScopes } from "@/server/authorization";

const VIEW = "compliance.view" as const;

export interface PlatformSummary {
  solutions: number;
  ideas: number;
  strategicObjectives: number;
  activitiesThisYear: number;
  challenges: number;
  committees: number;
}

/** Live counts across modules, respecting the caller's department/organization scope where the underlying table supports it. */
export async function getPlatformSummary(actor: AccessContext): Promise<PlatformSummary> {
  requirePermission(actor, VIEW);
  const es = effectiveScopes(actor);
  const deptFilter = es.platform ? {} : { departmentId: { in: es.departmentIds } };
  const orgFilter = es.platform ? {} : { organizationId: { in: es.organizationIds } };
  const currentYear = new Date().getFullYear();

  const [solutions, ideas, strategicObjectives, activitiesThisYear, challenges, committees] = await Promise.all([
    prisma.innovationSolution.count({ where: es.platform ? {} : { owningDepartmentId: { in: es.departmentIds } } }),
    prisma.idea.count({ where: { status: { not: "ARCHIVED" }, ...deptFilter } }),
    prisma.strategicObjective.count({ where: { status: { not: "ARCHIVED" }, ...deptFilter } }),
    prisma.innovationActivity.count({
      where: { archivedAt: null, startDate: { gte: new Date(`${currentYear}-01-01`), lt: new Date(`${currentYear + 1}-01-01`) }, ...deptFilter },
    }),
    prisma.challenge.count({ where: { archivedAt: null, ...deptFilter } }),
    prisma.committee.count({ where: { archivedAt: null, ...orgFilter } }),
  ]);

  return { solutions, ideas, strategicObjectives, activitiesThisYear, challenges, committees };
}
