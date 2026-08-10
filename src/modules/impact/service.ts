import type { AccessContext } from "@/server/access-context";
import { AUDIT, writeAudit } from "@/server/audit";
import { requirePermission, requireScope, solutionScopeWhere } from "@/server/authorization";
import { prisma } from "@/server/db";
import { impactEntrySchema } from "./schema";

export async function listImpactSolutions(actor: AccessContext) {
  requirePermission(actor, "impact.view");
  const scope = await solutionScopeWhere(actor);
  return prisma.innovationSolution.findMany({
    where: { AND: [scope, { archivedAt: null }] }, orderBy: { updatedAt: "desc" },
    select: { id: true, nameAr: true, maturityStage: true, implementationStatus: true, publishedAt: true,
      owningDepartment: { select: { nameAr: true, organization: { select: { nameAr: true } } } },
      impactIndicators: { select: { id: true, type: true, baselineValue: true, targetValue: true, measurements: { where: { supersededBy: { none: {} } }, orderBy: { measuredAt: "desc" }, take: 1, select: { actualValue: true, verificationStatus: true, periodEnd: true } } } },
    },
  });
}

export async function getImpactWorkspace(actor: AccessContext, solutionId: string) {
  requirePermission(actor, "impact.view");
  await requireScope(actor, "INNOVATION_SOLUTION", solutionId);
  return prisma.innovationSolution.findUniqueOrThrow({ where: { id: solutionId }, select: {
    id: true, nameAr: true, description: true, maturityStage: true, implementationStatus: true,
    owningDepartment: { select: { nameAr: true, organization: { select: { nameAr: true } } } },
    impactIndicators: { orderBy: { createdAt: "asc" }, include: { measurements: { where: { supersededBy: { none: {} } }, orderBy: { measuredAt: "desc" } } } },
  }});
}

export async function saveImpactEntry(actor: AccessContext, raw: unknown) {
  requirePermission(actor, "impact.update");
  const input = impactEntrySchema.parse(raw);
  await requireScope(actor, "INNOVATION_SOLUTION", input.solutionId);
  if (input.periodStart && input.periodEnd && input.periodEnd < input.periodStart) throw new Error("INVALID_PERIOD");
  return prisma.$transaction(async (tx) => {
    const indicator = input.indicatorId
      ? await tx.impactIndicator.update({ where: { id: input.indicatorId, solutionId: input.solutionId }, data: { nameAr: input.nameAr, type: input.type, unit: input.unit, baselineValue: input.baselineValue, targetValue: input.targetValue, measurementMethod: input.measurementMethod } })
      : await tx.impactIndicator.create({ data: { solutionId: input.solutionId, nameAr: input.nameAr, type: input.type, unit: input.unit, baselineValue: input.baselineValue, targetValue: input.targetValue, measurementMethod: input.measurementMethod } });
    if (input.actualValue !== null || input.dataSource || input.periodStart || input.periodEnd) {
      const measurement = await tx.impactMeasurement.create({ data: { indicatorId: indicator.id, actualValue: input.actualValue, periodStart: input.periodStart, periodEnd: input.periodEnd, measuredAt: new Date(), dataSource: input.dataSource, notes: input.notes } });
      await writeAudit({ actorUserId: actor.userId, action: AUDIT.IMPACT_MEASUREMENT_RECORDED, entityType: "INNOVATION_SOLUTION", entityId: input.solutionId, summary: "تسجيل قياس أثر", metadata: { measurementId: measurement.id, indicatorId: indicator.id } }, tx);
    }
    await writeAudit({ actorUserId: actor.userId, action: AUDIT.IMPACT_INDICATOR_SAVED, entityType: "INNOVATION_SOLUTION", entityId: input.solutionId, summary: "حفظ مؤشر أثر", metadata: { indicatorId: indicator.id } }, tx);
    return indicator.id;
  });
}
