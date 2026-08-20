import { notFound } from "next/navigation";
import { requireUser, can } from "@/server/authz";
import { DGA_UNITS, getDgaRequirement } from "../source-of-truth";
import { getWorkspaceConfig } from "../workspace-config";
import { loadRequirementWorkspace, WorkspaceError } from "../workspace-service";
import type { WorkspaceData, OperationalStatus } from "../workspace-status";
import { OperationalWorkspace } from "./operational-workspace";
import type { GovernanceView } from "@/modules/governance-workflow/components/governance-panel";
import { listAuditLog } from "@/modules/audit/service";
import { listContributionsForAssignment } from "@/modules/requirement-contributions/service";
import { getContributionDefinition } from "@/modules/requirement-contributions/types";

export async function RequirementRoute({unitIndex,requirementId,eventId}:{unitIndex:number;requirementId:string;eventId?:string}){
  const unit=DGA_UNITS[unitIndex]; const requirement=getDgaRequirement(unit,requirementId); const config=getWorkspaceConfig(requirementId);
  if(!requirement||!config)notFound(); const actor=await requireUser();
  try {
    const loaded=await loadRequirementWorkspace(actor,requirementId); const names=loaded.names;
    const internalScope=actor.scopes.some(scope=>["PLATFORM","ORGANIZATION","DEPARTMENT"].includes(scope.scopeType));
    const referenceData=requirementId==="5-23-1-r2"?(await loadRequirementWorkspace(actor,"5-23-1-r1")).assignment.workspaceData as WorkspaceData:requirementId==="5-23-2-r3"?(await loadRequirementWorkspace(actor,"5-23-2-r1")).assignment.workspaceData as WorkspaceData:requirementId==="5-23-2-r4"&&internalScope?(await loadRequirementWorkspace(actor,"5-23-1-r3")).assignment.workspaceData as WorkspaceData:requirementId==="5-23-3-r2"?{structures:((await loadRequirementWorkspace(actor,"5-23-3-r1")).assignment.workspaceData as WorkspaceData).structures??[],initiatives:((await loadRequirementWorkspace(actor,"5-23-1-r2")).assignment.workspaceData as WorkspaceData).initiatives??[]} as WorkspaceData:{};
    const contributions=getContributionDefinition(requirementId)?await listContributionsForAssignment(loaded.assignment.id):[];
    const canViewAudit=can(actor,"audit.view");
    const auditEntries=canViewAudit?await listAuditLog(actor,{entityTypes:["COMPLIANCE_REQUIREMENT","REQUIREMENT_ASSIGNMENT","EVIDENCE"],entityIds:[loaded.assignment.complianceRequirementId,loaded.assignment.id,...loaded.evidence.map(e=>e.id)]}):[];
    const governance:GovernanceView={assignmentId:loaded.assignment.id,workflowState:loaded.assignment.workflowState,priority:loaded.assignment.priority,ownerUserId:loaded.assignment.ownerUserId,responsibleUserId:loaded.assignment.responsibleUserId,dueDate:loaded.assignment.dueDate?.toISOString()??null,nextAction:loaded.assignment.nextAction,raci:loaded.assignment.raciAssignments.map(x=>({responsibility:x.responsibility,userId:x.userId,departmentId:x.departmentId,organizationalRole:x.organizationalRole})),events:loaded.assignment.workflowEvents.map(x=>({id:x.id,previousState:x.previousState,newState:x.newState,comment:x.comment,reason:x.reason,actor:names[x.actorUserId]??"مستخدم",createdAt:x.createdAt.toISOString()})),versions:loaded.assignment.versions.map(x=>({id:x.id,version:x.version,workflowState:x.workflowState,author:names[x.authorUserId]??"مستخدم",createdAt:x.createdAt.toISOString(),reviewComment:x.reviewComment})),comments:loaded.assignment.collaboration.map(x=>({id:x.id,type:x.type,body:x.body,author:names[x.authorUserId]??"مستخدم",createdAt:x.createdAt.toISOString()})),tasks:loaded.assignment.tasks.map(x=>({id:x.id,type:x.type,title:x.title,status:x.status,priority:x.priority,assignedTo:x.assignedToUserId?(names[x.assignedToUserId]??"مستخدم"):"غير مسندة",dueDate:x.dueDate?.toISOString()??null,nextAction:x.nextAction})),auditEntries:auditEntries.map(x=>({id:x.id,action:x.action,actor:x.actorName??"النظام",summary:x.summary,createdAt:x.createdAt.toISOString()})),canViewAudit,users:loaded.availableUsers,canConfigure:loaded.canConfigure,canReview:loaded.canReview};
    return <OperationalWorkspace unit={unit} requirement={requirement} config={config} initial={loaded.assignment.workspaceData as WorkspaceData} initialEvidence={loaded.evidence} initialStatus={loaded.assignment.operationalStatus as OperationalStatus} canEdit={loaded.canEdit} governance={governance} contributions={contributions} referenceData={referenceData} initialEventId={eventId}/>;
  } catch(error) { if(error instanceof WorkspaceError&&(error.code==="NOT_FOUND"||error.code==="FORBIDDEN"))notFound(); throw error; }
}
