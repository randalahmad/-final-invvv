import type { AccessContext } from "@/server/access-context";
import { effectiveScopes } from "@/server/authorization";
import { prisma } from "@/server/db";
import { getRequirementByCode } from "@/modules/dga/workspace-config";
import { requirementHref } from "./links";

export async function evidenceMatrix(actor: AccessContext) {
  if (!actor.permissions.has("evidence.view")) throw new Error("FORBIDDEN");
  const scopes = effectiveScopes(actor);
  const assignments = await prisma.complianceRequirementAssignment.findMany({
    where: { archivedAt: null, requirement: { code: { startsWith: "5.23." } }, ...(scopes.platform ? {} : { OR: [...(scopes.departmentIds.length ? [{ departmentId: { in: scopes.departmentIds } }] : []), ...(scopes.organizationIds.length ? [{ department: { organizationId: { in: scopes.organizationIds } } }] : [])] }) },
    include: { requirement: { include: { evidenceRules: true } }, department: true, raciAssignments: { where: { responsibility: "RESPONSIBLE" } } },
  });
  const links = await prisma.evidenceLink.findMany({ where: { entityType: "REQUIREMENT_ASSIGNMENT", entityId: { in: assignments.map(x => x.id) }, evidence: { archivedAt: null } }, include: { evidence: { include: { uploadedBy: { select: { name: true } } } } }, orderBy: { createdAt: "desc" } });
  const ownerIds = [...new Set([...assignments.map(x => x.ownerUserId), ...links.map(x => x.evidence.ownerUserId)].filter(Boolean) as string[])];
  const owners = await prisma.user.findMany({ where: { id: { in: ownerIds } }, select: { id: true, name: true } });
  const ownerNames = Object.fromEntries(owners.map(owner => [owner.id, owner.name]));
  return assignments.flatMap(assignment => assignment.requirement.evidenceRules.map(rule => {
    const matching = links.filter(link => link.entityId === assignment.id && link.evidence.classification === rule.evidenceTypeKey);
    const evidence = matching[0]?.evidence;
    const ownerUserId = evidence?.ownerUserId ?? assignment.ownerUserId;
    return { assignmentId: assignment.id, code: assignment.requirement.code, title: assignment.requirement.titleAr, evidenceName: rule.evidenceTypeKey, evidenceId: evidence?.id ?? null, fileName: evidence?.fileName ?? null, ownerUserId, owner: ownerUserId ? ownerNames[ownerUserId] ?? "—" : "غير مسند", department: assignment.department.nameAr, date: evidence?.createdAt.toISOString() ?? null, reviewStatus: evidence?.reviewStatus ?? "MISSING", approvalStatus: evidence?.approvedAt ? "APPROVED" : "NOT_APPROVED", needsUpdate: Boolean(evidence?.validUntil && evidence.validUntil < new Date()) || evidence?.reviewStatus === "NEEDS_UPDATE", href: requirementHref(assignment.requirement.code), minimum: rule.minCount, current: matching.length, config: getRequirementByCode(assignment.requirement.code) };
  }));
}
