import { notFound } from "next/navigation";
import { requireUser } from "@/server/authz";
import { DGA_UNITS, getDgaRequirement } from "../source-of-truth";
import { getWorkspaceConfig } from "../workspace-config";
import { loadRequirementWorkspace, WorkspaceError } from "../workspace-service";
import type { WorkspaceData, OperationalStatus } from "../workspace-status";
import { OperationalWorkspace } from "./operational-workspace";
import type { GovernanceView } from "@/modules/governance-workflow/components/governance-panel";

export async function RequirementRoute({unitIndex,requirementId}:{unitIndex:number;requirementId:string}){
  const unit=DGA_UNITS[unitIndex]; const requirement=getDgaRequirement(unit,requirementId); const config=getWorkspaceConfig(requirementId); if(!requirement||!config)notFound();
  const actor=await requireUser();
  try { const loaded=await loadRequirementWorkspace(actor,requirementId);const names=loaded.names;const governance:GovernanceView={assignmentId:loaded.assignment.id,workflowState:loaded.assignment.workflowState,priority:loaded.assignment.priority,ownerUserId:loaded.assignment.ownerUserId,responsibleUserId:loaded.assignment.responsibleUserId,dueDate:loaded.assignment.dueDate?.toISOString()??null,nextAction:loaded.assignment.nextAction,raci:loaded.assignment.raciAssignments.map(x=>({responsibility:x.responsibility,userId:x.userId,departmentId:x.departmentId,organizationalRole:x.organizationalRole})),events:loaded.assignment.workflowEvents.map(x=>({id:x.id,previousState:x.previousState,newState:x.newState,comment:x.comment,reason:x.reason,actor:names[x.actorUserId]??"مستخدم",createdAt:x.createdAt.toISOString()})),versions:loaded.assignment.versions.map(x=>({id:x.id,version:x.version,workflowState:x.workflowState,author:names[x.authorUserId]??"مستخدم",createdAt:x.createdAt.toISOString(),reviewComment:x.reviewComment})),comments:loaded.assignment.collaboration.map(x=>({id:x.id,type:x.type,body:x.body,author:names[x.authorUserId]??"مستخدم",createdAt:x.createdAt.toISOString()})),users:loaded.availableUsers,canConfigure:loaded.canConfigure,canReview:loaded.canReview};return <OperationalWorkspace unit={unit} requirement={requirement} config={config} initial={loaded.assignment.workspaceData as WorkspaceData} initialEvidence={loaded.evidence} initialStatus={loaded.assignment.operationalStatus as OperationalStatus} canEdit={loaded.canEdit} governance={governance}/>; }
  catch(error){ if(error instanceof WorkspaceError&&(error.code==="NOT_FOUND"||error.code==="FORBIDDEN"))notFound(); throw error; }
}
