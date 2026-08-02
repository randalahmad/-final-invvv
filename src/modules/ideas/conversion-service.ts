import { prisma } from "@/server/db";
import { writeAudit, AUDIT } from "@/server/audit";
import type { AccessContext } from "@/server/access-context";
import { requirePermission, requireScope } from "@/server/authorization";
import { DecisionError } from "./decision-service";

/**
 * Convert an APPROVED_FOR_PILOT idea into exactly one InnovationSolution.
 *
 * Copies only justified fields (title, problem/description, department,
 * activity/source linkage, responsible owner), links Idea ↔ Solution via the
 * unique `ideaId`, sets the idea to CONVERTED_TO_SOLUTION, records a
 * CONVERT_TO_SOLUTION decision for history, and audits — all in one
 * transaction. Duplicate conversion is blocked (explicit check + unique index).
 *
 * This is NOT solution CRUD: the created solution starts as a DRAFT record.
 */
export async function convertApprovedIdeaToSolution(actor: AccessContext, ideaId: string): Promise<{ solutionId: string }> {
  requirePermission(actor, "idea.decide");
  requirePermission(actor, "solution.create");
  await requireScope(actor, "IDEA", ideaId);

  const idea = await prisma.idea.findUniqueOrThrow({
    where: { id: ideaId },
    select: {
      id: true,
      status: true,
      titleAr: true,
      description: true,
      departmentId: true,
      activityId: true,
      submittedById: true,
    },
  });

  if (idea.status !== "APPROVED_FOR_PILOT") {
    throw new DecisionError("NOT_APPROVED", "التحويل متاح فقط للأفكار المعتمدة للتجريب");
  }
  const existing = await prisma.innovationSolution.findUnique({ where: { ideaId }, select: { id: true } });
  if (existing) throw new DecisionError("ALREADY_CONVERTED", "تم تحويل هذه الفكرة إلى حل مسبقًا");

  try {
    return await prisma.$transaction(async (tx) => {
      const solution = await tx.innovationSolution.create({
        data: {
          nameAr: idea.titleAr,
          description: idea.description,
          problemStatement: idea.description, // problem context carried from the idea
          source: idea.activityId ? "ACTIVITY" : "INTERNAL_PROPOSAL",
          activityId: idea.activityId,
          ideaId: idea.id,
          owningDepartmentId: idea.departmentId,
          ownerUserId: idea.submittedById, // responsible owner when available
          status: "DRAFT",
        },
        select: { id: true },
      });

      await tx.idea.update({ where: { id: idea.id }, data: { status: "CONVERTED_TO_SOLUTION" } });

      // Record the conversion in the decision history (finalized).
      await tx.ideaDecision.create({
        data: {
          ideaId: idea.id,
          decidedById: actor.userId,
          decision: "CONVERT_TO_SOLUTION",
          notes: "تحويل الفكرة إلى حل ابتكاري",
          finalizedAt: new Date(),
          finalizedById: actor.userId,
        },
      });

      await writeAudit(
        {
          actorUserId: actor.userId,
          action: AUDIT.IDEA_CONVERTED,
          entityType: "IDEA",
          entityId: idea.id,
          departmentId: idea.departmentId,
          summary: "تحويل فكرة إلى حل ابتكاري",
          before: { status: "APPROVED_FOR_PILOT" },
          after: { status: "CONVERTED_TO_SOLUTION", solutionId: solution.id },
        },
        tx,
      );

      return { solutionId: solution.id };
    });
  } catch (e) {
    // Unique-index race on ideaId → another conversion won.
    if (typeof e === "object" && e && (e as { code?: string }).code === "P2002") {
      throw new DecisionError("ALREADY_CONVERTED", "تم تحويل هذه الفكرة إلى حل مسبقًا");
    }
    throw e;
  }
}

/** Linked solution summary for the idea details page (read-only). */
export async function getLinkedSolution(actor: AccessContext, ideaId: string) {
  requirePermission(actor, "idea.view");
  await requireScope(actor, "IDEA", ideaId);
  return prisma.innovationSolution.findUnique({
    where: { ideaId },
    select: { id: true, nameAr: true, status: true, maturityStage: true, implementationStatus: true, createdAt: true },
  });
}
