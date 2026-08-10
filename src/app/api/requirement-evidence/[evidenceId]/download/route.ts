import { NextResponse } from "next/server";
import { getAccessContext } from "@/server/authz";
import { prisma } from "@/server/db";
import { getStorage } from "@/server/storage";
import { getRequirementByCode } from "@/modules/dga/workspace-config";
import { loadRequirementWorkspace } from "@/modules/dga/workspace-service";
import { writeAudit, AUDIT } from "@/server/audit";

export const dynamic = "force-dynamic";
export async function GET(_request:Request,{params}:{params:{evidenceId:string}}){
  const actor=await getAccessContext(); if(!actor)return NextResponse.json({error:"غير مصرح"},{status:401});
  const row=await prisma.evidence.findFirst({where:{id:params.evidenceId,archivedAt:null,links:{some:{entityType:"REQUIREMENT_ASSIGNMENT"}}},include:{links:{where:{entityType:"REQUIREMENT_ASSIGNMENT"},include:{requirement:{select:{code:true}}}}}});
  const link=row?.links[0]; const config=link?.requirement?.code?getRequirementByCode(link.requirement.code):undefined;
  if(!row||!link||!config||!row.storagePath)return NextResponse.json({error:"غير موجود"},{status:404});
  try{const workspace=await loadRequirementWorkspace(actor,config.requirementId);if(workspace.assignment.id!==link.entityId)return NextResponse.json({error:"غير مصرح"},{status:403});const stored=await (await getStorage()).get(row.storagePath);await writeAudit({actorUserId:actor.userId,action:AUDIT.EVIDENCE_DOWNLOADED,entityType:"EVIDENCE",entityId:row.id,departmentId:workspace.assignment.departmentId,summary:"تنزيل إثبات متطلب"});return new NextResponse(new Uint8Array(stored.body),{headers:{"Content-Type":row.mimeType??stored.contentType??"application/octet-stream","Content-Disposition":`attachment; filename*=UTF-8''${encodeURIComponent(row.fileName??"evidence")}`,"Cache-Control":"private, no-store"}});}catch{return NextResponse.json({error:"تعذر تنزيل الملف"},{status:403});}
}
