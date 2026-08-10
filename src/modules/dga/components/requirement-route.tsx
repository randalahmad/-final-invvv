import { notFound } from "next/navigation";
import { requireUser } from "@/server/authz";
import { DGA_UNITS, getDgaRequirement } from "../source-of-truth";
import { getWorkspaceConfig } from "../workspace-config";
import { loadRequirementWorkspace, WorkspaceError } from "../workspace-service";
import type { WorkspaceData, OperationalStatus } from "../workspace-status";
import { OperationalWorkspace } from "./operational-workspace";

export async function RequirementRoute({unitIndex,requirementId}:{unitIndex:number;requirementId:string}){
  const unit=DGA_UNITS[unitIndex]; const requirement=getDgaRequirement(unit,requirementId); const config=getWorkspaceConfig(requirementId); if(!requirement||!config)notFound();
  const actor=await requireUser();
  try { const loaded=await loadRequirementWorkspace(actor,requirementId); return <OperationalWorkspace unit={unit} requirement={requirement} config={config} initial={loaded.assignment.workspaceData as WorkspaceData} initialEvidence={loaded.evidence} initialStatus={loaded.assignment.operationalStatus as OperationalStatus} canEdit={loaded.canEdit}/>; }
  catch(error){ if(error instanceof WorkspaceError&&(error.code==="NOT_FOUND"||error.code==="FORBIDDEN"))notFound(); throw error; }
}
