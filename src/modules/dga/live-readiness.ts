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
  /** 5.23 الابتكار المؤسسي / 5.24 الحلول الابتكارية — رول-أب مطلوب صراحة في ملف الدكتور. */
  groups: { code: "5.23" | "5.24"; name: string; readiness: number }[];
  solutionsSummary: {
    total: number;
    operational: number;
    inPipeline: number;
    totalBeneficiaries: number;
    awards: number;
  };
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

/**
 * Readiness must reflect Review + Approval, not just data/evidence completion
 * (per official requirement + doctor-file "لا تجعل الجاهزية رقمًا ثابتًا أو
 * تجميليًا"). A requirement whose data and evidence are COMPLETED but whose
 * governance workflow never reached approval is not fully ready yet.
 */
function combinedScore(operationalStatus: RequirementOperationalStatus, workflowState: string): number {
  const base = STATUS_SCORE[operationalStatus];
  if (operationalStatus !== "COMPLETED") return base; // data/evidence gaps dominate regardless of workflow
  if (workflowState === "APPROVED" || workflowState === "COMPLETED") return 100;
  if (workflowState === "PENDING_APPROVAL" || workflowState === "RESUBMITTED") return 90;
  if (workflowState === "UNDER_REVIEW" || workflowState === "SUBMITTED_FOR_REVIEW") return 85;
  return 80; // data ready but not yet sent for review/approval (DRAFT/IN_PROGRESS/RETURNED_FOR_AMENDMENT/BLOCKED)
}

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

  const [assignments, solutions, indicators, awardsCount] = await Promise.all([
    prisma.complianceRequirementAssignment.findMany({
      where: {
        archivedAt: null,
        requirement: { code: { startsWith: "5.23." } },
        ...scopedAssignments,
      },
      select: {
        id: true,
        operationalStatus: true,
        workflowState: true,
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
        beneficiaryCount: true,
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
    prisma.solutionAward.count({ where: { archivedAt: null, solution: { is: { AND: [scopedSolutions, { archivedAt: null }] } } } }),
  ]);

  const assignmentLinks = assignments.length
    ? await prisma.evidenceLink.findMany({
        where: {
          entityType: "REQUIREMENT_ASSIGNMENT",
          entityId: { in: assignments.map((assignment) => assignment.id) },
          evidence: { archivedAt: null, reviewStatus: "APPROVED" },
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
    const completed = rows.filter((row) => row.operationalStatus === "COMPLETED" && (row.workflowState === "APPROVED" || row.workflowState === "COMPLETED")).length;
    units.push({
      code,
      ...UNITS[code],
      readiness: percentage(rows.reduce((sum, row) => sum + combinedScore(row.operationalStatus, row.workflowState), 0), rows.length * 100),
      completed,
      total: rows.length,
      missingEvidence,
      overdue: rows.filter((row) => row.dueDate && row.dueDate < now && !(row.operationalStatus === "COMPLETED" && (row.workflowState === "APPROVED" || row.workflowState === "COMPLETED"))).length,
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

  const rollup = (prefix: "5.23" | "5.24") => {
    const rows = units.filter((u) => u.code.startsWith(prefix));
    return { code: prefix, name: prefix === "5.23" ? "الابتكار المؤسسي" : "الحلول الابتكارية", readiness: rows.length ? Math.round(rows.reduce((s, u) => s + u.readiness, 0) / rows.length) : 0 };
  };

  return {
    overall: units.length ? Math.round(units.reduce((sum, unit) => sum + unit.readiness, 0) / units.length) : 0,
    completed: units.reduce((sum, unit) => sum + unit.completed, 0),
    incomplete: units.reduce((sum, unit) => sum + Math.max(0, unit.total - unit.completed), 0),
    missingEvidence: units.reduce((sum, unit) => sum + unit.missingEvidence, 0),
    overdue: units.reduce((sum, unit) => sum + unit.overdue, 0),
    units,
    groups: [rollup("5.23"), rollup("5.24")],
    solutionsSummary: {
      total: solutions.length,
      operational: solutions.filter((s) => s.implementationStatus === "OPERATING" || s.implementationStatus === "COMPLETED").length,
      inPipeline: solutions.filter((s) => s.implementationStatus === "PLANNING" || s.implementationStatus === "IN_PROGRESS").length,
      totalBeneficiaries: solutions.reduce((sum, s) => sum + (s.beneficiaryCount ?? 0), 0),
      awards: awardsCount,
    },
  };
}
