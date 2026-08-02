import type { ImplementationStatus, MaturityStage } from "@prisma/client";

import { prisma } from "@/server/db";
import type { AccessContext } from "@/server/access-context";
import { requirePermission, solutionScopeWhere } from "@/server/authorization";
import { MATURITY_ORDER } from "./lifecycle-service";
import { IMPLEMENTATION_STATUSES } from "./schema";

export interface SolutionStats {
  total: number;
  byMaturity: { key: MaturityStage; count: number }[];
  byImplementation: { key: ImplementationStatus; count: number }[];
  completeness: { label: string; range: string; count: number }[];
}

/**
 * Real, scope-filtered dashboard aggregates for solutions (replaces the mock
 * counts). Archived records are excluded. These are record counts and data
 * completeness only — no compliance/readiness claim is made here.
 */
export async function getSolutionStats(actor: AccessContext): Promise<SolutionStats> {
  requirePermission(actor, "solution.view");
  const scope = await solutionScopeWhere(actor);
  const where = { AND: [scope, { status: { not: "ARCHIVED" as const } }] };

  const [total, maturityGroups, implementationGroups, rows] = await Promise.all([
    prisma.innovationSolution.count({ where }),
    prisma.innovationSolution.groupBy({ by: ["maturityStage"], where, _count: { _all: true } }),
    prisma.innovationSolution.groupBy({ by: ["implementationStatus"], where, _count: { _all: true } }),
    prisma.innovationSolution.findMany({ where, select: { completionPct: true } }),
  ]);

  const maturityMap = new Map(maturityGroups.map((g) => [g.maturityStage, g._count._all]));
  const implMap = new Map(implementationGroups.map((g) => [g.implementationStatus, g._count._all]));

  const buckets = [
    { label: "أقل من 40%", range: "0-39", test: (n: number) => n < 40 },
    { label: "40% – 69%", range: "40-69", test: (n: number) => n >= 40 && n < 70 },
    { label: "70% – 89%", range: "70-89", test: (n: number) => n >= 70 && n < 90 },
    { label: "90% فأكثر", range: "90-100", test: (n: number) => n >= 90 },
  ];

  return {
    total,
    byMaturity: MATURITY_ORDER.map((key) => ({ key, count: maturityMap.get(key) ?? 0 })),
    byImplementation: IMPLEMENTATION_STATUSES.map((key) => ({ key, count: implMap.get(key) ?? 0 })),
    completeness: buckets.map((b) => ({
      label: b.label,
      range: b.range,
      count: rows.filter((r) => b.test(r.completionPct)).length,
    })),
  };
}
