import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import type { AccessContext } from "@/server/access-context";
import { effectiveScopes } from "@/server/authorization";
import { writeAudit, AUDIT } from "@/server/audit";
import { buildEntityEvidenceKey, getStorage } from "@/server/storage";
import { validateFile, type EvidenceFileInput } from "@/modules/evidence/service";
import { deriveOperationalStatus, type WorkspaceData } from "./workspace-status";
import { getWorkspaceConfig } from "./workspace-config";

export class WorkspaceError extends Error { constructor(public code: "FORBIDDEN"|"NOT_FOUND"|"VALIDATION"|"STORAGE_FAILED", message?: string) { super(message ?? code); } }

function canRead(actor: AccessContext) { return actor.permissions.has("compliance.view"); }
function canMutate(actor: AccessContext, code: string, departmentId: string) {
  if (!actor.permissions.has("evidence.upload")) return false;
  const scopes = effectiveScopes(actor);
  if (scopes.platform || scopes.departmentIds.includes(departmentId)) return true;
  if (scopes.organizationIds.length) return true; // verified against department organization in load query
  return (code === "5.23.1.3" || code === "5.23.2.4") && scopes.agreementIds.length > 0;
}

export async function loadRequirementWorkspace(actor: AccessContext, requirementId: string) {
  if (!canRead(actor)) throw new WorkspaceError("FORBIDDEN");
  const config = getWorkspaceConfig(requirementId);
  if (!config) throw new WorkspaceError("NOT_FOUND");
  const scopes = effectiveScopes(actor);
  const assignment = await prisma.complianceRequirementAssignment.findFirst({
    where: { archivedAt:null, requirement:{code:config.code}, ...(scopes.platform ? {} : { OR:[
      ...(scopes.departmentIds.length ? [{departmentId:{in:scopes.departmentIds}}] : []),
      ...(scopes.organizationIds.length ? [{department:{organizationId:{in:scopes.organizationIds}}}] : []),
      ...((config.code === "5.23.1.3" || config.code === "5.23.2.4") && scopes.agreementIds.length ? [{department:{organization:{agreements:{some:{id:{in:scopes.agreementIds},archivedAt:null}}}}}] : []),
    ] } ) },
    include:{ requirement:true, department:{include:{organization:true}},raciAssignments:true,tasks:{orderBy:{createdAt:"desc"},take:20},workflowEvents:{orderBy:{createdAt:"desc"},take:30},versions:{orderBy:{version:"desc"}},collaboration:{orderBy:{createdAt:"desc"},take:30} }, orderBy:{createdAt:"asc"}
  });
  if (!assignment) throw new WorkspaceError("NOT_FOUND");
  const links = await prisma.evidenceLink.findMany({ where:{entityType:"REQUIREMENT_ASSIGNMENT",entityId:assignment.id,requirementId:assignment.complianceRequirementId,evidence:{archivedAt:null,reviewStatus:{not:"ARCHIVED"}}}, include:{evidence:{include:{uploadedBy:{select:{name:true}}}}}, orderBy:{createdAt:"desc"} });
  const counts:Record<string,number>={}; links.forEach(({evidence})=>{ if(evidence.classification) counts[evidence.classification]=(counts[evidence.classification]??0)+1; });
  const approvedCounts:Record<string,number>={}; links.forEach(({evidence})=>{ if(evidence.classification&&evidence.reviewStatus==="APPROVED") approvedCounts[evidence.classification]=(approvedCounts[evidence.classification]??0)+1; });
  const userIds=[assignment.ownerUserId,assignment.responsibleUserId,...assignment.raciAssignments.map(x=>x.userId),...assignment.tasks.flatMap(x=>[x.requestedById,x.assignedToUserId]),...assignment.workflowEvents.flatMap(x=>[x.actorUserId,x.assigneeUserId]),...assignment.collaboration.map(x=>x.authorUserId)].filter(Boolean) as string[];
  const users=await prisma.user.findMany({where:{id:{in:[...new Set(userIds)]}},select:{id:true,name:true,email:true}});const names=Object.fromEntries(users.map(user=>[user.id,user.name]));
  const availableUsers=await prisma.user.findMany({where:{status:"ACTIVE",registrationStatus:"APPROVED",...(scopes.platform?{}:{memberships:{some:{OR:[...(scopes.organizationIds.length?[{organizationId:{in:scopes.organizationIds}}]:[]),...(scopes.departmentIds.length?[{departmentId:{in:scopes.departmentIds}}]:[])]}}})},select:{id:true,name:true,email:true},orderBy:{name:"asc"}});
  return { assignment, evidence:links.map(({evidence})=>({id:evidence.id,title:evidence.title,classification:evidence.classification,fileName:evidence.fileName,version:evidence.version,reviewStatus:evidence.reviewStatus,uploadedAt:evidence.createdAt.toISOString(),uploader:evidence.uploadedBy?.name??"—"})), counts, approvedCounts, canEdit:canMutate(actor,config.code,assignment.departmentId),canConfigure:scopes.platform&&actor.permissions.has("compliance.configure"),canReview:actor.permissions.has("evidence.approve")||(scopes.platform&&actor.permissions.has("compliance.configure")),names,availableUsers };
}

export async function saveRequirementWorkspace(actor: AccessContext, requirementId:string, data:WorkspaceData) {
  const loaded=await loadRequirementWorkspace(actor,requirementId); const config=getWorkspaceConfig(requirementId)!;
  if(!loaded.canEdit) throw new WorkspaceError("FORBIDDEN");
  const status=deriveOperationalStatus(config,data,loaded.approvedCounts);
  await prisma.$transaction(async(tx)=>{ await tx.complianceRequirementAssignment.update({where:{id:loaded.assignment.id},data:{workspaceData:data as Prisma.InputJsonValue,operationalStatus:status,lastSavedById:actor.userId}}); await writeAudit({actorUserId:actor.userId,action:AUDIT.COMPLIANCE_ASSIGNMENT_UPDATED,entityType:"COMPLIANCE_REQUIREMENT",entityId:loaded.assignment.complianceRequirementId,departmentId:loaded.assignment.departmentId,summary:"تحديث مساحة عمل متطلب",after:{status,requirementCode:config.code}},tx); });
  return {status};
}

export async function uploadRequirementEvidence(actor:AccessContext,requirementId:string,evidenceType:string,file:EvidenceFileInput) {
  const loaded=await loadRequirementWorkspace(actor,requirementId); const config=getWorkspaceConfig(requirementId)!;
  if(!loaded.canEdit || !config.evidence.some((rule)=>rule.key===evidenceType)) throw new WorkspaceError("FORBIDDEN");
  const validated=validateFile(file); const storage=await getStorage(); const key=buildEntityEvidenceKey({namespace:"requirement-workspaces",entityId:loaded.assignment.id,fileName:validated.fileName});
  try { await storage.put(key,validated.bytes,{contentType:validated.mimeType,checksum:validated.checksum,fileName:validated.fileName}); } catch(error){ throw new WorkspaceError("STORAGE_FAILED",error instanceof Error?error.message:undefined); }
  try { return await prisma.$transaction(async(tx)=>{ const previous=await tx.evidence.findFirst({where:{links:{some:{entityType:"REQUIREMENT_ASSIGNMENT",entityId:loaded.assignment.id}},classification:evidenceType,archivedAt:null},orderBy:{version:"desc"},select:{version:true}}); const created=await tx.evidence.create({data:{title:config.evidence.find((r)=>r.key===evidenceType)!.title,classification:evidenceType,fileName:validated.fileName,mimeType:validated.mimeType,sizeBytes:validated.sizeBytes,checksum:validated.checksum,storagePath:key,version:(previous?.version??0)+1,ownerUserId:loaded.assignment.ownerUserId,uploadedById:actor.userId,reviewStatus:"DRAFT",fileProcessingStatus:"UPLOADED"}}); await tx.evidenceLink.create({data:{evidenceId:created.id,entityType:"REQUIREMENT_ASSIGNMENT",entityId:loaded.assignment.id,requirementId:loaded.assignment.complianceRequirementId}}); const status=deriveOperationalStatus(config,loaded.assignment.workspaceData as WorkspaceData,loaded.approvedCounts); await tx.complianceRequirementAssignment.update({where:{id:loaded.assignment.id},data:{operationalStatus:status,lastSavedById:actor.userId}}); await writeAudit({actorUserId:actor.userId,action:AUDIT.EVIDENCE_UPLOADED,entityType:"EVIDENCE",entityId:created.id,departmentId:loaded.assignment.departmentId,summary:"رفع إثبات لمتطلب تشغيلي",metadata:{requirementCode:config.code,evidenceType,assignmentId:loaded.assignment.id,version:created.version}},tx); return {id:created.id,status}; }); } catch(error){ try{await storage.delete(key);}catch{} throw error; }
}
