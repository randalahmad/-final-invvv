import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import type { AccessContext } from "@/server/access-context";
import { effectiveScopes, getActiveShareAgreementIds } from "@/server/authorization";
import { writeAudit, AUDIT } from "@/server/audit";
import { buildEntityEvidenceKey, getStorage } from "@/server/storage";
import { validateFile, type EvidenceFileInput } from "@/modules/evidence/service";
import { deriveOperationalStatus, missingWorkspaceFields, type WorkspaceData } from "./workspace-status";
import { getWorkspaceConfig } from "./workspace-config";
import { DGA_UNITS, getDgaRequirement } from "./source-of-truth";
import { buildEvidenceDocumentBuffer } from "./evidence-generator";
import { getContributionDefinition } from "@/modules/requirement-contributions/types";

export class WorkspaceError extends Error { constructor(public code: "FORBIDDEN"|"NOT_FOUND"|"VALIDATION"|"STORAGE_FAILED", message?: string) { super(message ?? code); } }

// 5.23.1.3 (اتفاقية تعاون) و5.23.2.4 (تفعيل اتفاقية) هما المتطلبان الوحيدان التي
// يمكن أن يصل إليهما شريك خارجي عبر منح اتفاقية فقط (بلا نطاق قسم/منظمة).
// المنح تأتي من مصدرين ولا يجوز الاكتفاء بأحدهما فقط:
//  1) RBAC صريح: UserRole بـ scopeType=AGREEMENT (effectiveScopes().agreementIds)
//  2) ResourceShare على اتفاقية محددة (النمط المعتاد لشريك خارجي، راجع تعليق
//     model ResourceShare في schema.prisma) — كانت getActiveShareAgreementIds
//     معرّفة ومُصدَّرة في src/server/authorization لكن غير مستدعاة من أي مكان،
//     فكان أي منح عبر ResourceShare يُفقد بصمت هنا.
async function agreementScopeIds(actor: AccessContext, scopes: ReturnType<typeof effectiveScopes>) {
  const shared = await getActiveShareAgreementIds(actor.userId);
  return [...new Set([...scopes.agreementIds, ...shared])];
}

// PHASE 10 resolution: compliance.view is deliberately withheld from
// EXTERNAL_PARTNER platform-wide (docs/roles-and-permissions.md §7, "correction
// #4" — never touched here, no permissions.ts change). Without a code-aware
// read gate, that made the 5.23.1.3/5.23.2.4 agreement-scope fix unreachable
// for its only intended audience. canRead is now code-aware: compliance.view
// still grants normal access to everything (Admin/Internal/Viewer unaffected);
// a partner with NO compliance.view can read ONLY these two specific codes,
// and only while holding an explicit agreement scope (RBAC AGREEMENT grant or
// ResourceShare) plus evidence.view (already granted to partners, restricted
// to shared records). Row-level access is still enforced by the OR-scoped
// query in loadRequirementWorkspace below — this gate only decides whether the
// attempt is allowed at all, never widens which rows come back.
function canRead(actor: AccessContext, code: string, agreementIds: string[]) {
  if (actor.permissions.has("compliance.view")) return true;
  return (code === "5.23.1.3" || code === "5.23.2.4") && agreementIds.length > 0 && actor.permissions.has("evidence.view");
}
function canMutate(actor: AccessContext, code: string, departmentId: string, scopes: ReturnType<typeof effectiveScopes>, agreementIds: string[]) {
  if (!actor.permissions.has("evidence.upload")) return false;
  if (scopes.platform || scopes.departmentIds.includes(departmentId)) return true;
  if (scopes.organizationIds.length) return true; // verified against department organization in load query
  return (code === "5.23.1.3" || code === "5.23.2.4") && agreementIds.length > 0;
}

export async function loadRequirementWorkspace(actor: AccessContext, requirementId: string) {
  const config = getWorkspaceConfig(requirementId);
  if (!config) throw new WorkspaceError("NOT_FOUND");
  const scopes = effectiveScopes(actor);
  const agreementIds = (config.code === "5.23.1.3" || config.code === "5.23.2.4") ? await agreementScopeIds(actor, scopes) : scopes.agreementIds;
  if (!canRead(actor, config.code, agreementIds)) throw new WorkspaceError("FORBIDDEN");
  const assignment = await prisma.complianceRequirementAssignment.findFirst({
    where: { archivedAt:null, requirement:{code:config.code}, ...(scopes.platform ? {} : { OR:[
      ...(scopes.departmentIds.length ? [{departmentId:{in:scopes.departmentIds}}] : []),
      ...(scopes.organizationIds.length ? [{department:{organizationId:{in:scopes.organizationIds}}}] : []),
      // 5.23.1.3/5.23.2.4 فقط: منح وجودي (بلا مطابقة قسم/منظمة) لمن يملك اتفاقية
      // فعّالة — سواء عبر RBAC أو ResourceShare — بنفس منطق canMutate أدناه.
      // (الاستعلام السابق كان يتحقق من department.organization.agreements، وهو
      // اتجاه علاقة معكوس: الـ assignment يعيش دائمًا تحت قسم داخلي وليس تحت
      // منظمة الشريك، فكان هذا الفرع لا يطابق أي صف عمليًا.)
      ...((config.code === "5.23.1.3" || config.code === "5.23.2.4") && agreementIds.length ? [{}] : []),
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
  return { assignment, evidence:links.map(({evidence})=>({id:evidence.id,title:evidence.title,classification:evidence.classification,fileName:evidence.fileName,version:evidence.version,reviewStatus:evidence.reviewStatus,uploadedAt:evidence.createdAt.toISOString(),uploader:evidence.uploadedBy?.name??"—",relatedRecord:evidence.notes?.startsWith("مرتبط بالمبادرة: ")?evidence.notes.slice("مرتبط بالمبادرة: ".length):null})), counts, approvedCounts, canEdit:canMutate(actor,config.code,assignment.departmentId,scopes,agreementIds),canConfigure:scopes.platform&&actor.permissions.has("compliance.configure"),canReview:actor.permissions.has("evidence.approve")||(scopes.platform&&actor.permissions.has("compliance.configure")),names,availableUsers };
}

export async function saveRequirementWorkspace(actor: AccessContext, requirementId:string, data:WorkspaceData) {
  const loaded=await loadRequirementWorkspace(actor,requirementId); const config=getWorkspaceConfig(requirementId)!;
  if(!loaded.canEdit) throw new WorkspaceError("FORBIDDEN");
  if(getContributionDefinition(requirementId)){
    const delegated=await prisma.requirementSectionContribution.findMany({where:{assignmentId:loaded.assignment.id,status:{in:["NOT_SENT","INVITATION_SENT","OPENED","IN_PROGRESS","SUBMITTED","UNDER_REVIEW","NEEDS_AMENDMENT","OVERDUE"]}},select:{sectionKey:true,contributorName:true}});
    const previous=loaded.assignment.workspaceData as WorkspaceData;
    const conflict=delegated.find(item=>JSON.stringify(previous[item.sectionKey])!==JSON.stringify(data[item.sectionKey]));
    if(conflict)throw new WorkspaceError("VALIDATION",`القسم «${config.sections.find(section=>section.key===conflict.sectionKey)?.title??conflict.sectionKey}» مسند حاليًا إلى ${conflict.contributorName}. ألغِ الإسناد أو راجع المساهمة قبل التعديل المباشر.`);
  }
  const status=deriveOperationalStatus(config,data,loaded.approvedCounts);
  await prisma.$transaction(async(tx)=>{
    await tx.complianceRequirementAssignment.update({where:{id:loaded.assignment.id},data:{workspaceData:data as Prisma.InputJsonValue,operationalStatus:status,lastSavedById:actor.userId}});
    await writeAudit({actorUserId:actor.userId,action:AUDIT.COMPLIANCE_ASSIGNMENT_UPDATED,entityType:"COMPLIANCE_REQUIREMENT",entityId:loaded.assignment.complianceRequirementId,departmentId:loaded.assignment.departmentId,summary:"تحديث مساحة عمل متطلب",after:{status,requirementCode:config.code}},tx);
    if(requirementId==="5-23-1-r2"){
      const previous=loaded.assignment.workspaceData as WorkspaceData;
      const beforeInitiatives=Array.isArray(previous.initiatives)?previous.initiatives:[];
      const afterInitiatives=Array.isArray(data.initiatives)?data.initiatives:[];
      if(afterInitiatives.length>beforeInitiatives.length)await writeAudit({actorUserId:actor.userId,action:AUDIT.INITIATIVE_RECORD_CREATED,entityType:"COMPLIANCE_REQUIREMENT",entityId:loaded.assignment.complianceRequirementId,departmentId:loaded.assignment.departmentId,summary:"إنشاء سجل مبادرة ضمن المتطلب 5.23.1.2",metadata:{count:afterInitiatives.length-beforeInitiatives.length}},tx);
      else if(JSON.stringify(beforeInitiatives)!==JSON.stringify(afterInitiatives))await writeAudit({actorUserId:actor.userId,action:AUDIT.INITIATIVE_RECORD_UPDATED,entityType:"COMPLIANCE_REQUIREMENT",entityId:loaded.assignment.complianceRequirementId,departmentId:loaded.assignment.departmentId,summary:"تحديث سجل مبادرة ضمن المتطلب 5.23.1.2"},tx);
      if(JSON.stringify(previous.strategicAlignment)!==JSON.stringify(data.strategicAlignment))await writeAudit({actorUserId:actor.userId,action:AUDIT.INITIATIVE_OBJECTIVE_LINKED,entityType:"COMPLIANCE_REQUIREMENT",entityId:loaded.assignment.complianceRequirementId,departmentId:loaded.assignment.departmentId,summary:"ربط مبادرة بهدف استراتيجي معتمد في المتطلب 01"},tx);
      if(JSON.stringify(previous.initiativeKpis)!==JSON.stringify(data.initiativeKpis))await writeAudit({actorUserId:actor.userId,action:AUDIT.INITIATIVE_KPI_LINKED,entityType:"COMPLIANCE_REQUIREMENT",entityId:loaded.assignment.complianceRequirementId,departmentId:loaded.assignment.departmentId,summary:"ربط مبادرة بمؤشر أداء معتمد في المتطلب 01"},tx);
    }
  });
  return {status};
}

export async function uploadRequirementEvidence(actor:AccessContext,requirementId:string,evidenceType:string,file:EvidenceFileInput,relatedRecord?:string) {
  const loaded=await loadRequirementWorkspace(actor,requirementId); const config=getWorkspaceConfig(requirementId)!;
  if(!loaded.canEdit || !config.evidence.some((rule)=>rule.key===evidenceType)) throw new WorkspaceError("FORBIDDEN");
  const validated=validateFile(file); const storage=await getStorage(); const key=buildEntityEvidenceKey({namespace:"requirement-workspaces",entityId:loaded.assignment.id,fileName:validated.fileName});
  try { await storage.put(key,validated.bytes,{contentType:validated.mimeType,checksum:validated.checksum,fileName:validated.fileName}); } catch(error){ throw new WorkspaceError("STORAGE_FAILED",error instanceof Error?error.message:undefined); }
  try { return await prisma.$transaction(async(tx)=>{ const previous=await tx.evidence.findFirst({where:{links:{some:{entityType:"REQUIREMENT_ASSIGNMENT",entityId:loaded.assignment.id}},classification:evidenceType,archivedAt:null},orderBy:{version:"desc"},select:{version:true}}); const created=await tx.evidence.create({data:{title:config.evidence.find((r)=>r.key===evidenceType)!.title,classification:evidenceType,fileName:validated.fileName,mimeType:validated.mimeType,sizeBytes:validated.sizeBytes,checksum:validated.checksum,storagePath:key,version:(previous?.version??0)+1,ownerUserId:loaded.assignment.ownerUserId,uploadedById:actor.userId,reviewStatus:"DRAFT",fileProcessingStatus:"UPLOADED",notes:relatedRecord?.trim()?`مرتبط بالمبادرة: ${relatedRecord.trim()}`:null}}); await tx.evidenceLink.create({data:{evidenceId:created.id,entityType:"REQUIREMENT_ASSIGNMENT",entityId:loaded.assignment.id,requirementId:loaded.assignment.complianceRequirementId}}); const status=deriveOperationalStatus(config,loaded.assignment.workspaceData as WorkspaceData,loaded.approvedCounts); await tx.complianceRequirementAssignment.update({where:{id:loaded.assignment.id},data:{operationalStatus:status,lastSavedById:actor.userId}}); await writeAudit({actorUserId:actor.userId,action:AUDIT.EVIDENCE_UPLOADED,entityType:"EVIDENCE",entityId:created.id,departmentId:loaded.assignment.departmentId,summary:"رفع إثبات لمتطلب تشغيلي",metadata:{requirementCode:config.code,evidenceType,assignmentId:loaded.assignment.id,version:created.version,relatedRecord:relatedRecord?.trim()||null}},tx); return {id:created.id,status}; }); } catch(error){ try{await storage.delete(key);}catch{} throw error; }
}

/**
 * 8.4 — Evidence Generator. Builds a REAL .docx from this requirement's actual
 * data (fields entered, RACI, tasks, evidence refs, workflow/approval state)
 * and hands it to uploadRequirementEvidence() — the SAME pipeline manual
 * uploads use (storage, Evidence+EvidenceLink rows, audit, status recompute).
 * No parallel evidence system. Gated on data completeness: refuses to
 * generate while required fields are still missing, per the reference's
 * "sufficient completed data" requirement.
 */
export async function generateRequirementEvidence(actor: AccessContext, requirementId: string, evidenceType: string) {
  const loaded = await loadRequirementWorkspace(actor, requirementId);
  const config = getWorkspaceConfig(requirementId)!;
  if (!loaded.canEdit || !config.evidence.some((rule) => rule.key === evidenceType)) throw new WorkspaceError("FORBIDDEN");
  const data = (loaded.assignment.workspaceData as WorkspaceData) ?? {};
  const missing = missingWorkspaceFields(config, data);
  if (missing.length) throw new WorkspaceError("VALIDATION", `لا يمكن توليد مستند الإثبات قبل استكمال الحقول التالية: ${missing.join("، ")}`);

  const match = DGA_UNITS.map((u) => ({ unit: u, req: getDgaRequirement(u, requirementId) })).find((x) => x.req);
  if (!match?.req) throw new WorkspaceError("NOT_FOUND");
  const names = loaded.names;
  const owner = loaded.assignment.ownerUserId ? names[loaded.assignment.ownerUserId] ?? null : null;
  const responsible = loaded.assignment.responsibleUserId ? names[loaded.assignment.responsibleUserId] ?? null : null;
  const latestVersion = loaded.assignment.versions[0];
  // Real approval record — the workflow event that moved the assignment into
  // APPROVED/COMPLETED (workflowEvents is already ordered desc by createdAt).
  // Never guessed: if no such event exists yet, both fields stay null.
  const approvalEvent = loaded.assignment.workflowEvents.find((e) => e.newState === "APPROVED" || e.newState === "COMPLETED");

  const buffer = await buildEvidenceDocumentBuffer({
    unitCode: match.unit.code,
    unitName: match.unit.name,
    requirementCode: config.code,
    requirementTitle: match.req.title,
    applicationRequirement: match.req.applicationRequirement,
    config,
    workspaceData: data,
    ownerName: owner,
    responsibleName: responsible,
    raci: loaded.assignment.raciAssignments.map((r) => ({ responsibility: r.responsibility, name: r.userId ? names[r.userId] ?? null : null })),
    tasks: loaded.assignment.tasks.map((t) => ({ title: t.title, status: t.status, assignedTo: t.assignedToUserId ? names[t.assignedToUserId] ?? "—" : "غير مسندة" })),
    evidenceRefs: loaded.evidence.map((e) => ({ title: e.title, fileName: e.fileName, reviewStatus: e.reviewStatus })),
    workflowState: loaded.assignment.workflowState,
    reviewComment: latestVersion?.reviewComment ?? null,
    approvedByName: approvalEvent ? (names[approvalEvent.actorUserId] ?? "—") : null,
    approvedAt: approvalEvent ? approvalEvent.createdAt.toLocaleDateString("ar-SA") : null,
    version: (latestVersion?.version ?? 0) + 1,
    generatedByName: names[actor.userId] ?? "مستخدم",
    generatedAt: new Date(),
  });

  const fileName = `evidence-${config.code}-${Date.now()}.docx`;
  return uploadRequirementEvidence(actor, requirementId, evidenceType, {
    fileName,
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    bytes: buffer,
  });
}
