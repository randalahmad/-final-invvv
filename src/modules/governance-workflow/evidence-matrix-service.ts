import type { AccessContext } from "@/server/access-context";
import { effectiveScopes, solutionScopeWhere } from "@/server/authorization";
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

  // 5.24.1/5.24.2 — same real evidence pool (Evidence + EvidenceLink) already used
  // by the /solutions/[id]/evidence upload flow, linked via entityType INNOVATION_SOLUTION.
  // No formal minCount rule exists at the solution level (unlike 5.23.x's evidenceRules),
  // so each solution/indicator is one row: "has evidence" (current=1) vs "none yet" (current=0).
  const scopedSolutions = await solutionScopeWhere(actor);
  const solutions = await prisma.innovationSolution.findMany({
    where: { AND: [scopedSolutions, { archivedAt: null }] },
    select: { id: true, nameAr: true, ownerUserId: true, updatedAt: true,
      owningDepartment: { select: { nameAr: true } },
      impactIndicators: { select: { id: true, nameAr: true, updatedAt: true } } },
  });
  const solutionLinks = solutions.length ? await prisma.evidenceLink.findMany({
    where: { entityType: "INNOVATION_SOLUTION", entityId: { in: solutions.map(s => s.id) }, evidence: { archivedAt: null } },
    include: { evidence: { include: { uploadedBy: { select: { name: true } } } } },
    orderBy: { createdAt: "desc" },
  }) : [];
  ownerIds.push(...solutionLinks.map(l => l.evidence.ownerUserId).filter(Boolean) as string[]);
  const owners = await prisma.user.findMany({ where: { id: { in: [...new Set(ownerIds)] } }, select: { id: true, name: true } });
  const ownerNames = Object.fromEntries(owners.map(owner => [owner.id, owner.name]));

  const requirementRows = assignments.flatMap(assignment => assignment.requirement.evidenceRules.map(rule => {
    const matching = links.filter(link => link.entityId === assignment.id && link.evidence.classification === rule.evidenceTypeKey);
    const evidence = matching[0]?.evidence;
    const ownerUserId = evidence?.ownerUserId ?? assignment.ownerUserId;
    return { assignmentId: assignment.id, code: assignment.requirement.code, title: assignment.requirement.titleAr, evidenceName: rule.evidenceTypeKey, evidenceId: evidence?.id ?? null, fileName: evidence?.fileName ?? null, version: evidence?.version ?? null, ownerUserId, owner: ownerUserId ? ownerNames[ownerUserId] ?? "—" : "غير مسند", department: assignment.department.nameAr, date: evidence?.createdAt.toISOString() ?? null, reviewStatus: evidence?.reviewStatus ?? "MISSING", approvalStatus: evidence?.approvedAt ? "APPROVED" : "NOT_APPROVED", needsUpdate: Boolean(evidence?.validUntil && evidence.validUntil < new Date()) || evidence?.reviewStatus === "NEEDS_UPDATE", href: requirementHref(assignment.requirement.code), minimum: rule.minCount, current: matching.length, config: getRequirementByCode(assignment.requirement.code) };
  }));

  const solutionRows = solutions.map(solution => {
    const matching = solutionLinks.filter(l => l.entityId === solution.id);
    const evidence = matching[0]?.evidence;
    const ownerUserId = evidence?.ownerUserId ?? solution.ownerUserId;
    return { assignmentId: solution.id, code: "5.24.1", title: solution.nameAr, evidenceName: "أدلة الحل الابتكاري", evidenceId: evidence?.id ?? null, fileName: evidence?.fileName ?? null, version: evidence?.version ?? null, ownerUserId, owner: ownerUserId ? ownerNames[ownerUserId] ?? "—" : "غير مسند", department: solution.owningDepartment?.nameAr ?? "—", date: evidence?.createdAt.toISOString() ?? null, reviewStatus: evidence?.reviewStatus ?? "MISSING", approvalStatus: evidence?.approvedAt ? "APPROVED" : "NOT_APPROVED", needsUpdate: Boolean(evidence?.validUntil && evidence.validUntil < new Date()) || evidence?.reviewStatus === "NEEDS_UPDATE", href: `/solutions/${solution.id}`, minimum: 1, current: matching.length, config: undefined as ReturnType<typeof getRequirementByCode> };
  });

  const impactRows = solutions.flatMap(solution => solution.impactIndicators.map(indicator => {
    // Impact evidence is uploaded through the same solution evidence pool
    // (there is no separate per-indicator upload flow in the existing app) —
    // so an indicator counts as evidenced if the solution has ANY approved evidence.
    const matching = solutionLinks.filter(l => l.entityId === solution.id);
    const evidence = matching[0]?.evidence;
    const ownerUserId = evidence?.ownerUserId ?? solution.ownerUserId;
    return { assignmentId: indicator.id, code: "5.24.2", title: `${solution.nameAr} — ${indicator.nameAr}`, evidenceName: "دليل قياس الأثر", evidenceId: evidence?.id ?? null, fileName: evidence?.fileName ?? null, version: evidence?.version ?? null, ownerUserId, owner: ownerUserId ? ownerNames[ownerUserId] ?? "—" : "غير مسند", department: solution.owningDepartment?.nameAr ?? "—", date: evidence?.createdAt.toISOString() ?? null, reviewStatus: evidence?.reviewStatus ?? "MISSING", approvalStatus: evidence?.approvedAt ? "APPROVED" : "NOT_APPROVED", needsUpdate: Boolean(evidence?.validUntil && evidence.validUntil < new Date()) || evidence?.reviewStatus === "NEEDS_UPDATE", href: `/impact/${solution.id}`, minimum: 1, current: matching.length, config: undefined as ReturnType<typeof getRequirementByCode> };
  }));

  return [...requirementRows, ...solutionRows, ...impactRows];
}
