import { prisma } from "@/server/db";
import type { AccessContext } from "@/server/access-context";
import { requirePermission, requireScope } from "@/server/authorization";

/**
 * Read-only lifecycle history for a solution, derived entirely from the
 * append-only AuditLog — no separate history model is introduced. Covers
 * creation, edits, status/maturity/implementation changes, publish/unpublish,
 * share grants/updates/revocations and participating-organization changes.
 */
export async function getSolutionHistory(actor: AccessContext, solutionId: string) {
  requirePermission(actor, "solution.view");
  await requireScope(actor, "INNOVATION_SOLUTION", solutionId);
  return prisma.auditLog.findMany({
    where: { entityType: "INNOVATION_SOLUTION", entityId: solutionId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      action: true,
      summary: true,
      beforeData: true,
      afterData: true,
      metadata: true,
      createdAt: true,
      actor: { select: { name: true } },
    },
  });
}

export type SolutionHistoryRow = Awaited<ReturnType<typeof getSolutionHistory>>[number];
