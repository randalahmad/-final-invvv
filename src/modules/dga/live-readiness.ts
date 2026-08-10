import type { Prisma, RequirementOperationalStatus } from "@prisma/client";

import type { AccessContext } from "@/server/access-context";
import { effectiveScopes, solutionScopeWhere } from "@/server/authorization";
import { prisma } from "@/server/db";

export interface UnitReadiness {
  code: string;
  name: string;
  href: string;
  readiness: number;
  completed: number;
  total: number;
  missingEvidence: number;
  overdue: number;
  latestUpdate: string | null;
}

export interface LiveReadiness {
  overall: number;
  completed: number;
  incomplete: number;
  missingEvidence: number;
  overdue: number;
  units: UnitReadiness[];
}

const UNITS: Record<string, { name: string; href: string }> = {
  "5.23.1": { name: "التوجه الاستراتيجي", href: "/strategy" },
  "5.23.2": { name: "منهجيات الابتكار وفعالياته", href: "/activities" },
  "5.23.3": { name: "حوكمة وتفعيل الابتكار", href: "/governance" },
  "5.24.1": { name: "حصر الحلول الابتكارية", href: "/solutions" },
  "5.24.2": { name: "قياس أثر الحلول", href: "/impact" },
};

const STATUS_SCORE: Record<RequirementOperationalStatus, number> = {
  NOT_STARTED: 0,
  IN_PROGRESS: 35,
  AWAITING_EVIDENCE: 75,
  COMPLETED: 100,
};

function percentage(done: number, total: number) {
  return total > 0 ? Math.round((done / total) * 100) : 0;
}

function latest(values: Date[]) {
  return values.sort((a, b) => b.getTime() - a.getTime())[0]?.toISOString() ?? null;
}

export async function getLiveReadiness(actor: AccessContext): Promise<LiveReadiness> {
  const scopes = effectiveScopes(actor);
  const now = new Date();
  const scopedAssignments: Prisma.ComplianceRequirementAssignmentWhereInput = scopes.platform
    ? {}
    : {
        OR: [
          ...(scopes.departmentIds.length ? [{ departmentId: { in: scopes.departmentIds } }] : []),
          ...(scopes.organizationIds.length
            ? [{ department: { organizationId: { in: scopes.organizationIds } } }]
            : []),
        ],
      };
  const scopedSolutions = await solutionScopeWhere(actor);

  const [assignments, solutions, indicators] = await Promise.all([
    prisma.complianceRequirementAssignment.findMany({
      where: {
        archivedAt: null,
        requirement: { code: { startsWith: "5.23." } },
        ...scopedAssignments,
      },
      select: {
        id: true,
        operationalStatus: true,
        dueDate: true,
        updatedAt: true,
        requirement: { select: { code: true, evidenceRules: true } },
      },
    }),
    prisma.innovationSolution.findMany({
      where: { AND: [scopedSolutions, { archivedAt: null }] },
      select: {
        id: true,
        nameAr: true,
        description: true,
        source: true,
        owningDepartmentId: true,
        strategicObjectiveId: true,
        cost: true,
        durationMonths: true,
        targetBeneficiaries: true,
        technologies: true,
        maturityStage: true,
        implementationStatus: true,
        updatedAt: true,
        evidenceReadinessPct: true,
      },
    }),
    prisma.impactIndicator.findMany({
      where: { solution: { is: { AND: [scopedSolutions, { archivedAt: null }] } } },
      select: {
        id: true,
        solutionId: true,
        nameAr: true,
        baselineValue: true,
        targetValue: true,
        measurementMethod: true,
        updatedAt: true,
        measurements: {
          where: { supersededBy: { none: {} } },
          orderBy: { measuredAt: "desc" },
          select: {
            actualValue: true,
            periodStart: true,
            periodEnd: true,
            dataSource: true,
            verificationStatus: true,
            updatedAt: true,
          },
        },
      },
    }),
  ]);

  const assignmentLinks = assignments.length
    ? await prisma.evidenceLink.findMany({
        where: {
          entityType: "REQUIREMENT_ASSIGNMENT",
          entityId: { in: assignments.map((assignment) => assignment.id) },
          evidence: { archivedAt: null, reviewStatus: { not: "ARCHIVED" } },
        },
        select: { entityId: true, evidence: { select: { classification: true } } },
      })
    : [];
  const evidenceCounts = new Map<string, Record<string, number>>();
  for (const link of assignmentLinks) {
    if (!link.evidence.classification) continue;
    const counts = evidenceCounts.get(link.entityId) ?? {};
    counts[link.evidence.classification] = (counts[link.evidence.classification] ?? 0) + 1;
    evidenceCounts.set(link.entityId, counts);
  }

  const units: UnitReadiness[] = [];
  for (const code of ["5.23.1", "5.23.2", "5.23.3"]) {
    const rows = assignments.filter((row) => row.requirement.code.startsWith(`${code}.`));
    const missingEvidence = rows.reduce((sum, row) => {
      const counts = evidenceCounts.get(row.id) ?? {};
      return sum + row.requirement.evidenceRules.reduce(
        (ruleSum, rule) => ruleSum + Math.max(0, rule.minCount - (counts[rule.evidenceTypeKey] ?? 0)),
        0,
      );
    }, 0);
    const completed = rows.filter((row) => row.operationalStatus === "COMPLETED").length;
    units.push({
      code,
      ...UNITS[code],
      readiness: percentage(rows.reduce((sum, row) => sum + STATUS_SCORE[row.operationalStatus], 0), rows.length * 100),
      completed,
      total: rows.length,
      missingEvidence,
      overdue: rows.filter((row) => row.dueDate && row.dueDate < now && row.operationalStatus !== "COMPLETED").length,
      latestUpdate: latest(rows.map((row) => row.updatedAt)),
    });
  }

  const solutionScores = solutions.map((solution) =>
    percentage(
      [solution.nameAr, solution.description, solution.source, solution.owningDepartmentId,
        solution.strategicObjectiveId, solution.cost, solution.durationMonths, solution.targetBeneficiaries,
        solution.technologies, solution.maturityStage, solution.implementationStatus]
        .filter((value) => value !== null && value !== undefined && value !== "").length,
      11,
    ),
  );
  units.push({
    code: "5.24.1",
    ...UNITS["5.24.1"],
    readiness: solutionScores.length ? Math.round(solutionScores.reduce((a, b) => a + b, 0) / solutionScores.length) : 0,
    completed: solutionScores.filter((score) => score === 100).length,
    total: solutions.length,
    missingEvidence: solutions.filter((solution) => solution.evidenceReadinessPct === 0).length,
    overdue: 0,
    latestUpdate: latest(solutions.map((solution) => solution.updatedAt)),
  });

  const impactScores = indicators.map((indicator) => {
    const measurement = indicator.measurements[0];
    return percentage(
      [indicator.nameAr, indicator.baselineValue, indicator.targetValue, indicator.measurementMethod,
        measurement?.actualValue, measurement?.periodStart, measurement?.periodEnd, measurement?.dataSource]
        .filter((value) => value !== null && value !== undefined && value !== "").length,
      8,
    );
  });
  units.push({
    code: "5.24.2",
    ...UNITS["5.24.2"],
    readiness: impactScores.length ? Math.round(impactScores.reduce((a, b) => a + b, 0) / impactScores.length) : 0,
    completed: impactScores.filter((score) => score === 100).length,
    total: indicators.length,
    missingEvidence: 0,
    overdue: indicators.filter((indicator) =>
      indicator.measurements.some((measurement) =>
        Boolean(measurement.periodEnd && measurement.periodEnd < now && measurement.verificationStatus === "UNVERIFIED"),
      ),
    ).length,
    latestUpdate: latest(indicators.flatMap((indicator) => [indicator.updatedAt, ...indicator.measurements.map((m) => m.updatedAt)])),
  });

  return {
    overall: units.length ? Math.round(units.reduce((sum, unit) => sum + unit.readiness, 0) / units.length) : 0,
    completed: units.reduce((sum, unit) => sum + unit.completed, 0),
    incomplete: units.reduce((sum, unit) => sum + Math.max(0, unit.total - unit.completed), 0),
    missingEvidence: units.reduce((sum, unit) => sum + unit.missingEvidence, 0),
    overdue: units.reduce((sum, unit) => sum + unit.overdue, 0),
    units,
  };
}
