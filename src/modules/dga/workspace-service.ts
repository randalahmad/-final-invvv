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

async function syncCooperationRecords(tx:Prisma.TransactionClient,data:WorkspaceData){const cooperations=Array.isArray(data.cooperations)?data.cooperations:[];const agreements=Array.isArray(data.agreements)?data.agreements:[];const contacts=Array.isArray(data.partnerContacts)?data.partnerContacts:[];for(const agreementRow of agreements){const partnerName=String(agreementRow.cooperationName??"").trim();const title=String(agreementRow.title??"").trim();if(!partnerName||!title)continue;const cooperation=cooperations.find(row=>String(row.partnerName??"").trim()===partnerName);let partner=await tx.organization.findFirst({where:{nameAr:partnerName,archivedAt:null}});if(!partner)partner=await tx.organization.create({data:{nameAr:partnerName,type:String(cooperation?.partnerType??"").includes("جامعة")?"UNIVERSITY":"PARTNER",status:"ACTIVE"}});const statusText=String(agreementRow.status??"");const status=statusText.includes("منته")?"EXPIRED":statusText.includes("سارية")?"ACTIVE":"DRAFT";const contact=contacts.find(row=>String(row.cooperationName??"")===partnerName);let agreement=await tx.cooperationAgreement.findFirst({where:{partnerOrgId:partner.id,titleAr:title,archivedAt:null}});if(agreement)agreement=await tx.cooperationAgreement.update({where:{id:agreement.id},data:{effectiveDate:agreementRow.startDate?new Date(String(agreementRow.startDate)):null,expiryDate:agreementRow.endDate?new Date(String(agreementRow.endDate)):null,status,externalContact:contact?`${String(contact.name??"")} | ${String(contact.email??"")}`:null}});else agreement=await tx.cooperationAgreement.create({data:{partnerOrgId:partner.id,titleAr:title,type:"RESEARCH",effectiveDate:agreementRow.startDate?new Date(String(agreementRow.startDate)):null,expiryDate:agreementRow.endDate?new Date(String(agreementRow.endDate)):null,status,externalContact:contact?`${String(contact.name??"")} | ${String(contact.email??"")}`:null}});agreementRow.agreementId=agreement.id;agreementRow.partnerOrgId=partner.id;}}

async function syncCooperationContacts(tx:Prisma.TransactionClient,data:WorkspaceData,actorUserId:string){
  const cooperations=Array.isArray(data.cooperations)?data.cooperations:[];
  const agreements=Array.isArray(data.agreements)?data.agreements:[];
  const contacts=Array.isArray(data.partnerContacts)?data.partnerContacts:[];
  for(const cooperation of cooperations){
    const partnerName=String(cooperation.partnerName??"").trim();if(!partnerName)continue;
    let organization=await tx.organization.findFirst({where:{nameAr:partnerName,archivedAt:null}});
    if(!organization)organization=await tx.organization.create({data:{nameAr:partnerName,type:String(cooperation.partnerType??"").includes("جامعة")?"UNIVERSITY":"PARTNER",status:"ACTIVE"}});
    const agreementRow=agreements.find(row=>String(row.cooperationName??"").trim()===partnerName);
    const agreementId=agreementRow?.agreementId?String(agreementRow.agreementId):null;
    const partnerContacts=contacts.filter(row=>String(row.cooperationName??"").trim()===partnerName&&String(row.name??"").trim()&&String(row.email??"").trim());
    for(const contact of partnerContacts){
      const email=String(contact.email).trim().toLowerCase();const archived=String(contact.status??"").includes("مؤرشف");const primary=String(contact.isPrimary??"")==="نعم"&&!archived;
      if(primary)await tx.cooperationContact.updateMany({where:{organizationId:organization.id,status:"ACTIVE",email:{not:email}},data:{isPrimary:false}});
      const existing=await tx.cooperationContact.findFirst({where:{organizationId:organization.id,email}});
      const record={agreementId,name:String(contact.name).trim(),jobTitle:String(contact.title??"").trim()||null,departmentName:String(contact.departmentName??"").trim()||null,email,phone:String(contact.phone??"").trim()||null,cooperationRole:String(contact.role??"").trim()||null,isPrimary:primary,notes:String(contact.notes??"").trim()||null,status:archived?"ARCHIVED" as const:"ACTIVE" as const,archivedAt:archived?new Date():null,archivedById:archived?actorUserId:null};
      if(existing)await tx.cooperationContact.update({where:{id:existing.id},data:record});else await tx.cooperationContact.create({data:{...record,organizationId:organization.id,createdById:actorUserId}});
    }
  }
}

// 5.23.3 Requirement 01 — تشكيل وحدة أو لجنة للابتكار. This requirement's
// JSON workspace ("structures", each with nested members/tasks) is the
// SOURCE OF TRUTH; every save projects it onto the pre-existing
// Committee/CommitteeMember tables (idempotent via sourceKey) so the
// standalone /governance/committees pages and Requirement 02 read the same
// rows — no second committee table, no duplicate creation on re-save.
const committeeTypeMap:Record<string,"UNIT"|"COMMITTEE">={"وحدة":"UNIT","لجنة":"COMMITTEE"};
const committeeStatusMap:Record<string,"PROPOSED"|"ACTIVE"|"DISSOLVED">={"مُقترَحة":"PROPOSED","نشطة":"ACTIVE","منحلّة":"DISSOLVED"};
const memberCategoryMap:Record<string,"EMPLOYEE"|"DEPARTMENT_REPRESENTATIVE"|"EXPERT"|"EXTERNAL_MEMBER"|"STUDENT"|"STUDENT_VOLUNTEER"|"VOLUNTEER"|"OTHER"> = {"موظف":"EMPLOYEE","ممثل إدارة":"DEPARTMENT_REPRESENTATIVE","خبير":"EXPERT","عضو خارجي":"EXTERNAL_MEMBER","طالب":"STUDENT","طالب متطوع":"STUDENT_VOLUNTEER","متطوع":"VOLUNTEER","فئة أخرى":"OTHER"};
const memberStatusMap:Record<string,"ACTIVE"|"ENDED"|"SUSPENDED">={"نشط":"ACTIVE","منتهي":"ENDED","موقوف":"SUSPENDED"};
const optionalDateValue=(value:unknown)=>value?new Date(String(value)):null;
async function syncCommitteeRecords(tx:Prisma.TransactionClient,data:WorkspaceData,assignmentId:string,actorUserId:string,organizationId:string){
  const structures=Array.isArray(data.structures)?data.structures:[];
  for(const row of structures){
    const rowId=String(row.id??"").trim();const name=String(row.name??"").trim();if(!rowId||!name)continue;
    const sourceKey=`committee:${assignmentId}:${rowId}`;
    const input={
      nameAr:name,
      type:committeeTypeMap[String(row.type??"")]??"COMMITTEE" as const,
      purpose:String(row.purpose??"").trim()||null,
      mandateDescription:String(row.mandateDescription??"").trim()||null,
      relatedDepartmentName:String(row.relatedDepartmentName??"").trim()||null,
      chairName:String(row.chairName??"").trim()||null,
      secretaryName:String(row.secretaryName??"").trim()||null,
      formationDate:optionalDateValue(row.formationDate),
      operationStartDate:optionalDateValue(row.operationStartDate),
      meetingFrequency:String(row.meetingFrequency??"").trim()||null,
      notes:String(row.notes??"").trim()||null,
      decisionNumber:String(row.decisionNumber??"").trim()||null,
      decisionDate:optionalDateValue(row.decisionDate),
      decisionApprovingAuthority:String(row.decisionApprovingAuthority??"").trim()||null,
      decisionEffectiveDate:optionalDateValue(row.decisionEffectiveDate),
      decisionNotes:String(row.decisionNotes??"").trim()||null,
      status:committeeStatusMap[String(row.status??"")]??"PROPOSED" as const,
      organizationId,
    };
    const existing=await tx.committee.findUnique({where:{sourceKey},select:{id:true,decisionNumber:true,decisionDate:true}});
    const committee=existing?await tx.committee.update({where:{id:existing.id},data:input}):await tx.committee.create({data:{...input,sourceKey}});
    row.committeeId=committee.id;
    await writeAudit({actorUserId,action:existing?AUDIT.COMMITTEE_UPDATED:AUDIT.COMMITTEE_CREATED,entityType:"COMMITTEE",entityId:committee.id,summary:existing?"تحديث بيانات وحدة/لجنة ضمن المتطلب 5.23.3.1":"تشكيل وحدة/لجنة ابتكار ضمن المتطلب 5.23.3.1",metadata:{requirementCode:"5.23.3.1",assignmentId}},tx);
    const decisionChanged=!existing||existing.decisionNumber!==input.decisionNumber||existing.decisionDate?.toISOString()!==(input.decisionDate?.toISOString()??undefined);
    if(decisionChanged&&(input.decisionNumber||input.decisionDate))await writeAudit({actorUserId,action:AUDIT.COMMITTEE_DECISION_RECORDED,entityType:"COMMITTEE",entityId:committee.id,summary:"توثيق/تحديث قرار التشكيل",metadata:{requirementCode:"5.23.3.1",decisionNumber:input.decisionNumber,decisionDate:input.decisionDate}},tx);

    const members=Array.isArray(row.members)?row.members:[];
    for(const memberRow of members){
      const memberId=String(memberRow.id??"").trim();const memberName=String(memberRow.name??"").trim();if(!memberId||!memberName)continue;
      const memberSourceKey=`committee-member:${assignmentId}:${rowId}:${memberId}`;
      const statusText=String(memberRow.status??"");const status=memberStatusMap[statusText]??"ACTIVE" as const;
      const memberInput={
        name:memberName,
        category:memberCategoryMap[String(memberRow.category??"")]??"EMPLOYEE" as const,
        affiliation:String(memberRow.affiliation??"").trim()||null,
        title:String(memberRow.title??"").trim()||null,
        email:String(memberRow.email??"").trim()||null,
        phone:String(memberRow.phone??"").trim()||null,
        roleInCommittee:String(memberRow.roleInCommittee??"").trim()||null,
        responsibilities:String(memberRow.responsibilities??"").trim()||null,
        responsibilityScope:String(memberRow.responsibilityScope??"").trim()||null,
        isPrimaryResponsible:String(memberRow.isPrimaryResponsible??"")==="نعم",
        delegateName:String(memberRow.delegateName??"").trim()||null,
        membershipEndDate:optionalDateValue(memberRow.membershipEndDate),
        status,
        notes:String(memberRow.notes??"").trim()||null,
        leftAt:status==="ENDED"?(optionalDateValue(memberRow.membershipEndDate)??new Date()):null,
      };
      const existingMember=await tx.committeeMember.findUnique({where:{sourceKey:memberSourceKey},select:{id:true,roleInCommittee:true}});
      const member=existingMember?await tx.committeeMember.update({where:{id:existingMember.id},data:memberInput}):await tx.committeeMember.create({data:{...memberInput,committeeId:committee.id,sourceKey:memberSourceKey}});
      if(!existingMember)await writeAudit({actorUserId,action:AUDIT.COMMITTEE_MEMBER_ADDED,entityType:"COMMITTEE",entityId:committee.id,summary:"إضافة عضو ضمن المتطلب 5.23.3.1",metadata:{requirementCode:"5.23.3.1",memberId:member.id,name:memberName}},tx);
      else if(existingMember.roleInCommittee!==memberInput.roleInCommittee)await writeAudit({actorUserId,action:AUDIT.COMMITTEE_MEMBER_ROLE_UPDATED,entityType:"COMMITTEE",entityId:committee.id,summary:"تغيير دور عضو داخل اللجنة",before:{roleInCommittee:existingMember.roleInCommittee},after:{memberId:member.id,roleInCommittee:memberInput.roleInCommittee}},tx);
      else await writeAudit({actorUserId,action:AUDIT.COMMITTEE_MEMBER_UPDATED,entityType:"COMMITTEE",entityId:committee.id,summary:"تحديث بيانات عضو ضمن المتطلب 5.23.3.1",metadata:{requirementCode:"5.23.3.1",memberId:member.id}},tx);
    }

    const tasks=Array.isArray(row.tasks)?row.tasks:[];
    for(const task of tasks){
      const title=String(task.title??"").trim();const assignedToUserId=String(task.assignedUserId??"").trim()||null;if(!title||!assignedToUserId)continue;
      const taskSourceKey=`committee-task:${assignmentId}:${rowId}:${String(task.id??title)}`;
      const status=task.status==="COMPLETED"?"COMPLETED" as const:task.status==="CANCELLED"?"CANCELLED" as const:task.status==="WAITING"?"WAITING" as const:task.status==="IN_PROGRESS"||task.status==="REVIEW"?"IN_PROGRESS" as const:"OPEN" as const;
      const priority=["LOW","MEDIUM","HIGH","URGENT"].includes(String(task.priority))?String(task.priority) as "LOW"|"MEDIUM"|"HIGH"|"URGENT":"MEDIUM";
      const existingTask=await tx.requirementTask.findUnique({where:{sourceKey:taskSourceKey}});
      await tx.requirementTask.upsert({where:{sourceKey:taskSourceKey},create:{sourceKey:taskSourceKey,committeeId:committee.id,assignmentId,type:"FOLLOW_UP",title,status,priority,requestedById:actorUserId,assignedToUserId,dueDate:optionalDateValue(task.dueDate),nextAction:String(task.nextAction??`فتح وحدة/لجنة «${name}»`),completedAt:status==="COMPLETED"?(optionalDateValue(task.completedAt)??new Date()):null},update:{committeeId:committee.id,title,status,priority,assignedToUserId,dueDate:optionalDateValue(task.dueDate),nextAction:String(task.nextAction??`فتح وحدة/لجنة «${name}»`),completedAt:status==="COMPLETED"?(optionalDateValue(task.completedAt)??new Date()):null}});
      if(!existingTask||existingTask.status!==status)await writeAudit({actorUserId,action:status==="COMPLETED"?AUDIT.COMMITTEE_TASK_COMPLETED:AUDIT.COMMITTEE_TASK_ASSIGNED,entityType:"COMMITTEE",entityId:committee.id,summary:status==="COMPLETED"?`إكمال مهمة «${title}»`:`إسناد مهمة «${title}»`,metadata:{requirementCode:"5.23.3.1",taskSourceKey,assignedToUserId,dueDate:task.dueDate??null}},tx);
    }
  }
}

// 5.23.3 Requirement 02 — تفعيل الوحدة أو اللجنة واعتماد العمليات والإجراءات.
// Unlike 5.23.3.1 (committees), this requirement does NOT need its own
// relational tables: processes/policies/reviews/decisions/performance
// reports stay JSON-only inside workspaceData (same lightweight pattern as
// 5.23.2.4's meetings/decisions/reports) because no other requirement reads
// them relationally. Only two things need real DB rows: corrective actions
// and general follow-up tasks — both reuse the SAME RequirementTask.committeeId
// column 5.23.3.1 already added, so no schema change is needed here either.
// The multi-select "اللجان/الوحدات المعنية" options come from 5.23.3.1's own
// saved structures (passed in as referenceData by the caller) — never a
// second committee list.
const governanceTaskStatusMap=(value:unknown):"OPEN"|"IN_PROGRESS"|"WAITING"|"COMPLETED"|"CANCELLED"=>value==="COMPLETED"?"COMPLETED":value==="CANCELLED"?"CANCELLED":value==="WAITING"?"WAITING":value==="IN_PROGRESS"||value==="REVIEW"?"IN_PROGRESS":"OPEN";
const correctiveActionStatusMap:Record<string,"OPEN"|"IN_PROGRESS"|"WAITING"|"COMPLETED"|"CANCELLED">={"مفتوح":"OPEN","قيد التنفيذ":"IN_PROGRESS","مكتمل":"COMPLETED","مغلق":"COMPLETED"};
async function syncGovernanceOperationsTasks(tx:Prisma.TransactionClient,data:WorkspaceData,assignmentId:string,actorUserId:string){
  const correctiveActions=Array.isArray(data.correctiveActions)?data.correctiveActions:[];
  for(const row of correctiveActions){
    const rowId=String(row.id??"").trim();const assignedToUserId=String(row.assignedUserId??"").trim()||null;if(!rowId||!assignedToUserId)continue;
    const title=`إجراء تصحيحي: ${String(row.action??row.reason??"بلا وصف").trim()||"بلا وصف"}`;
    const sourceKey=`governance-corrective:${assignmentId}:${rowId}`;
    const status=correctiveActionStatusMap[String(row.status??"")]??"OPEN";
    const priority="HIGH" as const; // corrective actions are always follow-up priority by nature
    const committeeId=String(row.committeeId??"").trim()||null;
    const existing=await tx.requirementTask.findUnique({where:{sourceKey}});
    await tx.requirementTask.upsert({where:{sourceKey},create:{sourceKey,committeeId,assignmentId,type:"FOLLOW_UP",title,status,priority,requestedById:actorUserId,assignedToUserId,dueDate:optionalDateValue(row.dueDate),nextAction:String(row.action??"إغلاق الإجراء التصحيحي"),completedAt:status==="COMPLETED"?new Date():null},update:{committeeId,title,status,priority,assignedToUserId,dueDate:optionalDateValue(row.dueDate),nextAction:String(row.action??"إغلاق الإجراء التصحيحي"),completedAt:status==="COMPLETED"?new Date():null}});
    if(!existing||existing.status!==status)await writeAudit({actorUserId,action:status==="COMPLETED"?AUDIT.GOVERNANCE_CORRECTIVE_ACTION_COMPLETED:AUDIT.GOVERNANCE_CORRECTIVE_ACTION_ASSIGNED,entityType:"COMPLIANCE_REQUIREMENT",entityId:assignmentId,summary:status==="COMPLETED"?"إغلاق إجراء تصحيحي":"فتح/إسناد إجراء تصحيحي",metadata:{requirementCode:"5.23.3.2",sourceKey,assignedToUserId,committeeId}},tx);
  }
  const tasks=Array.isArray(data.tasks)?data.tasks:[];
  for(const task of tasks){
    const taskId=String(task.id??"").trim();const title=String(task.title??"").trim();const assignedToUserId=String(task.assignedUserId??"").trim()||null;if(!taskId||!title||!assignedToUserId)continue;
    const sourceKey=`governance-task:${assignmentId}:${taskId}`;
    const status=governanceTaskStatusMap(task.status);
    const priority=["LOW","MEDIUM","HIGH","URGENT"].includes(String(task.priority))?String(task.priority) as "LOW"|"MEDIUM"|"HIGH"|"URGENT":"MEDIUM";
    const committeeId=String(task.committeeId??"").trim()||null;
    const existing=await tx.requirementTask.findUnique({where:{sourceKey}});
    await tx.requirementTask.upsert({where:{sourceKey},create:{sourceKey,committeeId,assignmentId,type:"FOLLOW_UP",title,status,priority,requestedById:actorUserId,assignedToUserId,dueDate:optionalDateValue(task.dueDate),nextAction:String(task.nextAction??"فتح مساحة تفعيل الحوكمة"),completedAt:status==="COMPLETED"?(optionalDateValue(task.completedAt)??new Date()):null},update:{committeeId,title,status,priority,assignedToUserId,dueDate:optionalDateValue(task.dueDate),nextAction:String(task.nextAction??"فتح مساحة تفعيل الحوكمة"),completedAt:status==="COMPLETED"?(optionalDateValue(task.completedAt)??new Date()):null}});
    if(!existing||existing.status!==status)await writeAudit({actorUserId,action:status==="COMPLETED"?AUDIT.GOVERNANCE_TASK_COMPLETED:AUDIT.GOVERNANCE_TASK_ASSIGNED,entityType:"COMPLIANCE_REQUIREMENT",entityId:assignmentId,summary:status==="COMPLETED"?`إكمال مهمة «${title}»`:`إسناد مهمة «${title}»`,metadata:{requirementCode:"5.23.3.2",sourceKey,assignedToUserId,committeeId}},tx);
  }
}

const activityTypeMap:Record<string,"HACKATHON"|"INNOVATION_CAMP"|"WORKSHOP"|"COMPETITION"|"MEETING"|"PROGRAM"|"OTHER">={"هاكاثون":"HACKATHON","معسكر":"INNOVATION_CAMP","ورشة عمل":"WORKSHOP","مسابقة":"COMPETITION","لقاء":"MEETING","برنامج":"PROGRAM"};
async function syncAnnualPlanActivities(tx:Prisma.TransactionClient,data:WorkspaceData,assignmentId:string,departmentId:string,actorUserId:string){
  const activities=Array.isArray(data.activities)?data.activities:[];
  for(const row of activities){
    const name=String(row.name??row.activity??"").trim();if(!name)continue;
    const statusText=String(row.status??"");const status=statusText==="COMPLETED"?"COMPLETED" as const:statusText==="ONGOING"||statusText==="DELAYED"?"ONGOING" as const:statusText==="CANCELLED"?"CANCELLED" as const:"PLANNED" as const;
    const input={nameAr:name,type:activityTypeMap[String(row.type??"")]??"OTHER" as const,description:String(row.description??"").trim()||null,objectivesAr:String(row.objective??row.objectives??"").trim()||null,startDate:row.startDate?new Date(String(row.startDate)):null,endDate:row.endDate?new Date(String(row.endDate)):null,organizerDepartmentId:departmentId,status};
    let activity=row.activityId?await tx.innovationActivity.findUnique({where:{id:String(row.activityId)}}):null;
    if(!activity)activity=await tx.innovationActivity.findFirst({where:{nameAr:name,organizerDepartmentId:departmentId,archivedAt:null}});
    const createdActivity=!activity;activity=activity?await tx.innovationActivity.update({where:{id:activity.id},data:input}):await tx.innovationActivity.create({data:input});row.activityId=activity.id;
    await writeAudit({actorUserId,action:createdActivity?AUDIT.ACTIVITY_CREATED:AUDIT.ACTIVITY_UPDATED,entityType:"INNOVATION_ACTIVITY",entityId:activity.id,departmentId,summary:createdActivity?"إنشاء نشاط ضمن الخطة السنوية":"تحديث نشاط ضمن الخطة السنوية",metadata:{requirementCode:"5.23.2.1",assignmentId}},tx);
    const tasks=Array.isArray(row.tasks)?row.tasks:[];
    for(const task of tasks){
      const title=String(task.title??"").trim();const assignedToUserId=String(task.assignedUserId??"").trim()||null;if(!title||!assignedToUserId)continue;
      const sourceKey=`annual-plan:${assignmentId}:${String(row.id??activity.id)}:${String(task.id??title)}`;
      const taskStatus=task.status==="COMPLETED"?"COMPLETED" as const:task.status==="CANCELLED"?"CANCELLED" as const:task.status==="IN_PROGRESS"||task.status==="REVIEW"?"IN_PROGRESS" as const:task.status==="WAITING"?"WAITING" as const:"OPEN" as const;
      const priority=["LOW","MEDIUM","HIGH","URGENT"].includes(String(task.priority))?String(task.priority) as "LOW"|"MEDIUM"|"HIGH"|"URGENT":"MEDIUM";
      const existingTask=await tx.requirementTask.findUnique({where:{sourceKey}});
      await tx.requirementTask.upsert({where:{sourceKey},create:{sourceKey,activityId:activity.id,assignmentId,type:"FOLLOW_UP",title,status:taskStatus,priority,requestedById:actorUserId,assignedToUserId,dueDate:task.dueDate?new Date(String(task.dueDate)):null,nextAction:`فتح نشاط «${name}» ومتابعة المهمة`,completedAt:taskStatus==="COMPLETED"?(task.completedAt?new Date(String(task.completedAt)):new Date()):null},update:{activityId:activity.id,title,status:taskStatus,priority,assignedToUserId,dueDate:task.dueDate?new Date(String(task.dueDate)):null,nextAction:`فتح نشاط «${name}» ومتابعة المهمة`,completedAt:taskStatus==="COMPLETED"?(task.completedAt?new Date(String(task.completedAt)):new Date()):null}});
      if(!existingTask||existingTask.status!==taskStatus)await writeAudit({actorUserId,action:taskStatus==="COMPLETED"?AUDIT.ACTIVITY_TASK_COMPLETED:AUDIT.ACTIVITY_TASK_ASSIGNED,entityType:"INNOVATION_ACTIVITY",entityId:activity.id,departmentId,summary:taskStatus==="COMPLETED"?`إكمال مهمة «${title}»`:`إسناد مهمة «${title}»`,metadata:{sourceKey,assignedToUserId,dueDate:task.dueDate??null}},tx);
    }
  }
}

async function syncMethodologyApplications(tx:Prisma.TransactionClient,data:WorkspaceData,assignmentId:string,departmentId:string,actorUserId:string){
  const cases=Array.isArray(data.methodologyCases)?data.methodologyCases:[];
  for(const row of cases){const name=String(row.name??"").trim();if(!name)continue;const sourceKey=`methodology:${assignmentId}:${String(row.id??name)}`;const record=await tx.methodologyApplication.upsert({where:{sourceKey},create:{sourceKey,assignmentId,nameAr:name,challengeAr:String(row.challengeTitle??"").trim()||null,methodologyAr:String(row.methodology??"").trim()||null,owningDepartmentName:String(row.department??"").trim()||null,responsibleUserId:String(row.responsibleUserId??"").trim()||null,status:String(row.status??"DRAFT"),startDate:row.startDate?new Date(String(row.startDate)):null,endDate:row.endDate?new Date(String(row.endDate)):null},update:{nameAr:name,challengeAr:String(row.challengeTitle??"").trim()||null,methodologyAr:String(row.methodology??"").trim()||null,owningDepartmentName:String(row.department??"").trim()||null,responsibleUserId:String(row.responsibleUserId??"").trim()||null,status:String(row.status??"DRAFT"),startDate:row.startDate?new Date(String(row.startDate)):null,endDate:row.endDate?new Date(String(row.endDate)):null}});row.methodologyApplicationId=record.id;
    for(const task of Array.isArray(row.tasks)?row.tasks:[]){const title=String(task.title??"").trim();const assignedToUserId=String(task.assignedUserId??"").trim()||null;if(!title||!assignedToUserId)continue;const taskKey=`methodology-task:${sourceKey}:${String(task.id??title)}`;const status=task.status==="COMPLETED"?"COMPLETED" as const:task.status==="CANCELLED"?"CANCELLED" as const:task.status==="WAITING"?"WAITING" as const:task.status==="IN_PROGRESS"||task.status==="REVIEW"?"IN_PROGRESS" as const:"OPEN" as const;const priority=["LOW","MEDIUM","HIGH","URGENT"].includes(String(task.priority))?String(task.priority) as "LOW"|"MEDIUM"|"HIGH"|"URGENT":"MEDIUM";await tx.requirementTask.upsert({where:{sourceKey:taskKey},create:{sourceKey:taskKey,methodologyApplicationId:record.id,assignmentId,type:"FOLLOW_UP",title,status,priority,requestedById:actorUserId,assignedToUserId,dueDate:task.dueDate?new Date(String(task.dueDate)):null,nextAction:`فتح حالة «${name}» ومتابعة المهمة`,completedAt:status==="COMPLETED"?new Date(String(task.completedAt??new Date().toISOString())):null},update:{methodologyApplicationId:record.id,title,status,priority,assignedToUserId,dueDate:task.dueDate?new Date(String(task.dueDate)):null,nextAction:`فتح حالة «${name}» ومتابعة المهمة`,completedAt:status==="COMPLETED"?new Date(String(task.completedAt??new Date().toISOString())):null}});}
  }
}

async function syncOpenInnovationTasks(tx:Prisma.TransactionClient,data:WorkspaceData,assignmentId:string,actorUserId:string){
  for(const event of Array.isArray(data.openInnovationEvents)?data.openInnovationEvents:[]){
    const eventId=String(event.id??"").trim();const eventName=String(event.name??"").trim();if(!eventId||!eventName)continue;
    for(const task of Array.isArray(event.tasks)?event.tasks:[]){
      const title=String(task.title??"").trim();const assignedToUserId=String(task.assignedUserId??"").trim()||null;if(!title||!assignedToUserId)continue;
      const taskId=String(task.id??title);const sourceKey=`open-innovation:${eventId}:${String(task.section??"overview")}:${taskId}`;
      const status=task.status==="COMPLETED"?"COMPLETED" as const:task.status==="CANCELLED"?"CANCELLED" as const:task.status==="WAITING"?"WAITING" as const:task.status==="IN_PROGRESS"||task.status==="REVIEW"?"IN_PROGRESS" as const:"OPEN" as const;
      const priority=["LOW","MEDIUM","HIGH","URGENT"].includes(String(task.priority))?String(task.priority) as "LOW"|"MEDIUM"|"HIGH"|"URGENT":"MEDIUM";
      await tx.requirementTask.upsert({where:{sourceKey},create:{sourceKey,assignmentId,type:"FOLLOW_UP",title,status,priority,requestedById:actorUserId,assignedToUserId,dueDate:task.dueDate?new Date(String(task.dueDate)):null,nextAction:String(task.nextAction??`فتح فعالية «${eventName}»`),completedAt:status==="COMPLETED"?new Date(String(task.completedAt??new Date().toISOString())):null},update:{title,status,priority,assignedToUserId,dueDate:task.dueDate?new Date(String(task.dueDate)):null,nextAction:String(task.nextAction??`فتح فعالية «${eventName}»`),completedAt:status==="COMPLETED"?new Date(String(task.completedAt??new Date().toISOString())):null}});
    }
  }
}

// 5.23.3 Requirement 03 — نشر ثقافة الابتكار. الأنشطة تعيش داخل workspaceData
// فقط (نفس نمط 5.23.2.3 JSON-only) — سواء أُنشئت هنا أو رُبطت بنشاط قائم من
// 5.23.2.1 (annualPlanActivityId فقط للتتبع، بلا كتابة على مساحة عمل متطلب
// آخر). لا تُنشأ جداول علائقية جديدة ولا نظام مهام موازٍ؛ المهام تُزامَن على
// RequirementTask نفسه المستخدم في كل المتطلبات الأخرى.
async function syncCultureActivityTasks(tx:Prisma.TransactionClient,data:WorkspaceData,assignmentId:string,actorUserId:string){
  for(const activity of Array.isArray(data.cultureActivities)?data.cultureActivities:[]){
    const activityId=String(activity.id??"").trim();const activityName=String(activity.name??"").trim();if(!activityId||!activityName)continue;
    for(const task of Array.isArray(activity.tasks)?activity.tasks:[]){
      const title=String(task.title??"").trim();const assignedToUserId=String(task.assignedUserId??"").trim()||null;if(!title||!assignedToUserId)continue;
      const sourceKey=`culture-activity:${activityId}:${String(task.id??title)}`;
      const status=task.status==="COMPLETED"?"COMPLETED" as const:task.status==="CANCELLED"?"CANCELLED" as const:task.status==="WAITING"?"WAITING" as const:task.status==="IN_PROGRESS"||task.status==="REVIEW"?"IN_PROGRESS" as const:"OPEN" as const;
      const priority=["LOW","MEDIUM","HIGH","URGENT"].includes(String(task.priority))?String(task.priority) as "LOW"|"MEDIUM"|"HIGH"|"URGENT":"MEDIUM";
      const existing=await tx.requirementTask.findUnique({where:{sourceKey}});
      await tx.requirementTask.upsert({where:{sourceKey},create:{sourceKey,assignmentId,type:"FOLLOW_UP",title,status,priority,requestedById:actorUserId,assignedToUserId,dueDate:task.dueDate?new Date(String(task.dueDate)):null,nextAction:String(task.nextAction??`فتح نشاط «${activityName}»`),completedAt:status==="COMPLETED"?new Date(String(task.completedAt??new Date().toISOString())):null},update:{title,status,priority,assignedToUserId,dueDate:task.dueDate?new Date(String(task.dueDate)):null,nextAction:String(task.nextAction??`فتح نشاط «${activityName}»`),completedAt:status==="COMPLETED"?new Date(String(task.completedAt??new Date().toISOString())):null}});
      if(!existing||existing.status!==status)await writeAudit({actorUserId,action:status==="COMPLETED"?AUDIT.CULTURE_ACTIVITY_TASK_COMPLETED:AUDIT.CULTURE_ACTIVITY_TASK_ASSIGNED,entityType:"COMPLIANCE_REQUIREMENT",entityId:assignmentId,summary:status==="COMPLETED"?`إكمال مهمة «${title}»`:`إسناد مهمة «${title}»`,metadata:{requirementCode:"5.23.3.3",sourceKey,assignedToUserId,activityId}},tx);
    }
  }
}
// 5.23.3 Requirement 04 — تطوير آلية إدارة الابتكار الرقمي. الإصدارات
// ومراحلها JSON-only داخل workspaceData فقط (نفس نمط 5.23.2.3/5.23.3.3) —
// لا تُنشأ جداول علائقية جديدة ولا نظام Kanban موازٍ؛ مهام توثيق/صيانة كل
// مرحلة تُزامَن على RequirementTask نفسه المستخدم في كل المتطلبات الأخرى،
// بمفتاح مصدر يحمل هوية الإصدار والمرحلة معًا لضمان رابط عميق دقيق.
async function syncMechanismTasks(tx:Prisma.TransactionClient,data:WorkspaceData,assignmentId:string,actorUserId:string){
  for(const version of Array.isArray(data.mechanismVersions)?data.mechanismVersions:[]){
    const versionId=String(version.id??"").trim();if(!versionId)continue;
    for(const stage of Array.isArray(version.stages)?version.stages:[]){
      const stageId=String(stage.id??"").trim();const stageName=String(stage.name??"").trim();if(!stageId)continue;
      for(const task of Array.isArray(stage.tasks)?stage.tasks:[]){
        const title=String(task.title??"").trim();const assignedToUserId=String(task.assignedUserId??"").trim()||null;if(!title||!assignedToUserId)continue;
        const sourceKey=`mechanism-stage:${versionId}:${stageId}:${String(task.id??title)}`;
        const status=task.status==="COMPLETED"?"COMPLETED" as const:task.status==="CANCELLED"?"CANCELLED" as const:task.status==="WAITING"?"WAITING" as const:task.status==="IN_PROGRESS"||task.status==="REVIEW"?"IN_PROGRESS" as const:"OPEN" as const;
        const priority=["LOW","MEDIUM","HIGH","URGENT"].includes(String(task.priority))?String(task.priority) as "LOW"|"MEDIUM"|"HIGH"|"URGENT":"MEDIUM";
        const existing=await tx.requirementTask.findUnique({where:{sourceKey}});
        await tx.requirementTask.upsert({where:{sourceKey},create:{sourceKey,assignmentId,type:"FOLLOW_UP",title,status,priority,requestedById:actorUserId,assignedToUserId,dueDate:task.dueDate?new Date(String(task.dueDate)):null,nextAction:String(task.nextAction??`فتح مرحلة «${stageName}»`),completedAt:status==="COMPLETED"?new Date(String(task.completedAt??new Date().toISOString())):null},update:{title,status,priority,assignedToUserId,dueDate:task.dueDate?new Date(String(task.dueDate)):null,nextAction:String(task.nextAction??`فتح مرحلة «${stageName}»`),completedAt:status==="COMPLETED"?new Date(String(task.completedAt??new Date().toISOString())):null}});
        if(!existing||existing.status!==status)await writeAudit({actorUserId,action:status==="COMPLETED"?AUDIT.MECHANISM_TASK_COMPLETED:AUDIT.MECHANISM_TASK_ASSIGNED,entityType:"COMPLIANCE_REQUIREMENT",entityId:assignmentId,summary:status==="COMPLETED"?`إكمال مهمة «${title}»`:`إسناد مهمة «${title}»`,metadata:{requirementCode:"5.23.3.4",sourceKey,assignedToUserId,versionId,stageId}},tx);
      }
    }
  }
}
async function syncCooperationActivationTasks(tx:Prisma.TransactionClient,data:WorkspaceData,assignmentId:string,actorUserId:string){
  for(const activation of Array.isArray(data.cooperationActivations)?data.cooperationActivations:[]){const activationId=String(activation.id??"");const partner=String(activation.cooperationName??"");if(!activationId)continue;for(const task of Array.isArray(activation.tasks)?activation.tasks:[]){const title=String(task.title??"").trim();const assignedToUserId=String(task.assignedUserId??"").trim()||null;if(!title||!assignedToUserId)continue;const sourceKey=`cooperation-activation:${activationId}:${String(task.section??"overview")}:${String(task.id??title)}`;const status=task.status==="COMPLETED"?"COMPLETED" as const:task.status==="CANCELLED"?"CANCELLED" as const:task.status==="WAITING"?"WAITING" as const:task.status==="IN_PROGRESS"?"IN_PROGRESS" as const:"OPEN" as const;const priority=["LOW","MEDIUM","HIGH","URGENT"].includes(String(task.priority))?String(task.priority) as "LOW"|"MEDIUM"|"HIGH"|"URGENT":"MEDIUM";await tx.requirementTask.upsert({where:{sourceKey},create:{sourceKey,assignmentId,type:"FOLLOW_UP",title,status,priority,requestedById:actorUserId,assignedToUserId,dueDate:task.dueDate?new Date(String(task.dueDate)):null,nextAction:String(task.nextAction??`فتح تفعيل التعاون مع «${partner}»`),completedAt:status==="COMPLETED"?new Date(String(task.completedAt??new Date().toISOString())):null},update:{title,status,priority,assignedToUserId,dueDate:task.dueDate?new Date(String(task.dueDate)):null,nextAction:String(task.nextAction??`فتح تفعيل التعاون مع «${partner}»`),completedAt:status==="COMPLETED"?new Date(String(task.completedAt??new Date().toISOString())):null}});}}
}

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
  return { assignment, evidence:links.map(({evidence})=>({id:evidence.id,title:evidence.title,classification:evidence.classification,fileName:evidence.fileName,version:evidence.version,reviewStatus:evidence.reviewStatus,uploadedAt:evidence.createdAt.toISOString(),uploader:evidence.uploadedBy?.name??"—",relatedRecord:evidence.notes?.startsWith("مرتبط بالسجل: ")?evidence.notes.slice("مرتبط بالسجل: ".length):evidence.notes?.startsWith("مرتبط بالمبادرة: ")?evidence.notes.slice("مرتبط بالمبادرة: ".length):null})), counts, approvedCounts, canEdit:canMutate(actor,config.code,assignment.departmentId,scopes,agreementIds),canConfigure:scopes.platform&&actor.permissions.has("compliance.configure"),canReview:actor.permissions.has("evidence.approve")||(scopes.platform&&actor.permissions.has("compliance.configure")),names,availableUsers };
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
    if(requirementId==="5-23-1-r3"){await syncCooperationRecords(tx,data);await syncCooperationContacts(tx,data,actor.userId);}
    if(requirementId==="5-23-2-r1")await syncAnnualPlanActivities(tx,data,loaded.assignment.id,loaded.assignment.departmentId,actor.userId);
    if(requirementId==="5-23-2-r2")await syncMethodologyApplications(tx,data,loaded.assignment.id,loaded.assignment.departmentId,actor.userId);
    if(requirementId==="5-23-2-r3")await syncOpenInnovationTasks(tx,data,loaded.assignment.id,actor.userId);
    if(requirementId==="5-23-2-r4")await syncCooperationActivationTasks(tx,data,loaded.assignment.id,actor.userId);
    if(requirementId==="5-23-3-r1")await syncCommitteeRecords(tx,data,loaded.assignment.id,actor.userId,loaded.assignment.department.organizationId);
    if(requirementId==="5-23-3-r2")await syncGovernanceOperationsTasks(tx,data,loaded.assignment.id,actor.userId);
    if(requirementId==="5-23-3-r3")await syncCultureActivityTasks(tx,data,loaded.assignment.id,actor.userId);
    if(requirementId==="5-23-3-r4")await syncMechanismTasks(tx,data,loaded.assignment.id,actor.userId);
    await tx.complianceRequirementAssignment.update({where:{id:loaded.assignment.id},data:{workspaceData:data as Prisma.InputJsonValue,operationalStatus:status,lastSavedById:actor.userId}});
    await writeAudit({actorUserId:actor.userId,action:AUDIT.COMPLIANCE_ASSIGNMENT_UPDATED,entityType:"COMPLIANCE_REQUIREMENT",entityId:loaded.assignment.complianceRequirementId,departmentId:loaded.assignment.departmentId,summary:"تحديث مساحة عمل متطلب",after:{status,requirementCode:config.code}},tx);
    if(requirementId==="5-23-2-r1"){
      const previous=loaded.assignment.workspaceData as WorkspaceData;const before=Array.isArray(previous.activities)?previous.activities:[];const after=Array.isArray(data.activities)?data.activities:[];
      const event=async(action:string,summary:string,metadata?:Record<string,unknown>)=>writeAudit({actorUserId:actor.userId,action,entityType:"COMPLIANCE_REQUIREMENT",entityId:loaded.assignment.complianceRequirementId,departmentId:loaded.assignment.departmentId,summary,metadata:{requirementCode:"5.23.2.1",...metadata}},tx);
      if(after.length>before.length)await event(AUDIT.ACTIVITY_CREATED,"إنشاء نشاط ضمن الخطة السنوية",{count:after.length-before.length});
      if(JSON.stringify(before.map(item=>item.milestones))!==JSON.stringify(after.map(item=>item.milestones)))await event(AUDIT.ACTIVITY_MILESTONE_UPDATED,"تحديث محطات نشاط الخطة السنوية");
      if(JSON.stringify(before.map(item=>item.meetings))!==JSON.stringify(after.map(item=>item.meetings)))await event(AUDIT.ACTIVITY_MEETING_RECORDED,"تسجيل لقاء أو قرار ضمن نشاط");
      if(JSON.stringify(before.map(item=>item.deliverables))!==JSON.stringify(after.map(item=>item.deliverables)))await event(AUDIT.ACTIVITY_DELIVERABLE_REVIEWED,"تحديث مراجعة تسليم نشاط");
      if(JSON.stringify(before.map(item=>item.outputs))!==JSON.stringify(after.map(item=>item.outputs)))await event(AUDIT.ACTIVITY_OUTPUT_ADDED,"تحديث مخرجات نشاط الخطة السنوية");
      if(after.some((item,index)=>item.status==="COMPLETED"&&before[index]?.status!=="COMPLETED"))await event(AUDIT.ACTIVITY_CLOSED,"إغلاق نشاط بعد استكمال قائمة الإغلاق");
    }
    if(requirementId==="5-23-2-r2"){
      const previous=loaded.assignment.workspaceData as WorkspaceData;const before=Array.isArray(previous.methodologyCases)?previous.methodologyCases:[];const after=Array.isArray(data.methodologyCases)?data.methodologyCases:[];const event=(action:string,summary:string)=>writeAudit({actorUserId:actor.userId,action,entityType:"REQUIREMENT_ASSIGNMENT",entityId:loaded.assignment.id,departmentId:loaded.assignment.departmentId,summary,metadata:{requirementCode:"5.23.2.2"}},tx);const changed=(key:string)=>JSON.stringify(before.map(x=>x[key]))!==JSON.stringify(after.map(x=>x[key]));
      if(JSON.stringify(before)!==JSON.stringify(after))await event(AUDIT.METHODOLOGY_CASE_UPDATED,after.length>before.length?"إنشاء حالة تطبيق منهجية":"تحديث حالة تطبيق منهجية");
      if(changed("sessions"))await event(AUDIT.METHODOLOGY_SESSION_RECORDED,"توثيق جلسة منهجية ونتائجها");if(changed("participants"))await event(AUDIT.METHODOLOGY_PARTICIPANT_ADDED,"تحديث قائمة المشاركين في تطبيق المنهجية");if(changed("solutions"))await event(AUDIT.METHODOLOGY_SOLUTION_ADDED,"توثيق حل مقترح وربطه بجلسة");if(changed("prototypes"))await event(AUDIT.METHODOLOGY_PROTOTYPE_UPDATED,"تحديث نموذج أولي أو مرحلة تطوير");if(changed("projects"))await event(AUDIT.METHODOLOGY_PROJECT_LINKED,"ربط مشروع أو مبادرة ناتجة");if(changed("indicators"))await event(AUDIT.METHODOLOGY_KPI_LINKED,"ربط مؤشر أداء وملخص أثر");if(after.some((x,i)=>x.status==="COMPLETED"&&before[i]?.status!=="COMPLETED"))await event(AUDIT.METHODOLOGY_CASE_CLOSED,"إغلاق حالة تطبيق منهجية");
    }
    if(requirementId==="5-23-2-r3"){
      const previous=loaded.assignment.workspaceData as WorkspaceData;const before=Array.isArray(previous.openInnovationEvents)?previous.openInnovationEvents:[];const after=Array.isArray(data.openInnovationEvents)?data.openInnovationEvents:[];
      const record=(action:string,summary:string,metadata?:Record<string,unknown>)=>writeAudit({actorUserId:actor.userId,action,entityType:"REQUIREMENT_ASSIGNMENT",entityId:loaded.assignment.id,departmentId:loaded.assignment.departmentId,summary,metadata:{requirementCode:"5.23.2.3",...metadata}},tx);
      const changed=(key:string)=>JSON.stringify(before.map(item=>item[key]))!==JSON.stringify(after.map(item=>item[key]));
      if(after.length>before.length)await record(AUDIT.OPEN_INNOVATION_EVENT_CREATED,"إنشاء فعالية ابتكار مفتوح",{count:after.length-before.length});
      else if(JSON.stringify(before.map(item=>({name:item.name,type:item.type,status:item.status})))!==JSON.stringify(after.map(item=>({name:item.name,type:item.type,status:item.status}))))await record(AUDIT.OPEN_INNOVATION_EVENT_UPDATED,"تحديث بيانات فعالية ابتكار مفتوح");
      if(changed("annualPlanActivityId"))await record(AUDIT.OPEN_INNOVATION_ACTIVITY_LINKED,"ربط فعالية ابتكار مفتوح بالخطة السنوية");
      if(changed("challenges"))await record(AUDIT.OPEN_INNOVATION_CHALLENGE_UPDATED,"إضافة أو تحديث تحدٍ داخل الفعالية");
      if(changed("participants")||changed("teams"))await record(AUDIT.OPEN_INNOVATION_PARTICIPATION_UPDATED,"تحديث المشاركين والفرق داخل الفعالية");
      if(changed("solutions"))await record(AUDIT.OPEN_INNOVATION_SOLUTION_UPDATED,"إضافة أو تحديث حل مقدم داخل الفعالية");
      if(changed("judging")||changed("winners"))await record(AUDIT.OPEN_INNOVATION_JUDGING_UPDATED,"تسجيل نتائج التحكيم والفائزين");
      if(changed("prototypes"))await record(AUDIT.OPEN_INNOVATION_PROTOTYPE_UPDATED,"تحديث نموذج أولي أو إصدار تطوير");
      if(changed("projects"))await record(AUDIT.OPEN_INNOVATION_PROJECT_LINKED,"توثيق مشروع ناتج وربطه بالحل المصدر");
      if(changed("tasks"))await record(AUDIT.OPEN_INNOVATION_TASK_UPDATED,"إنشاء أو تحديث مهمة فعالية");
      if(after.some((item,index)=>item.status==="مغلقة تشغيليًا"&&before[index]?.status!=="مغلقة تشغيليًا"))await record(AUDIT.OPEN_INNOVATION_EVENT_CLOSED,"إغلاق فعالية ابتكار مفتوح تشغيليًا");
    }
    if(requirementId==="5-23-2-r4"){
      const previous=loaded.assignment.workspaceData as WorkspaceData;const before=Array.isArray(previous.cooperationActivations)?previous.cooperationActivations:[];const after=Array.isArray(data.cooperationActivations)?data.cooperationActivations:[];const record=(action:string,summary:string)=>writeAudit({actorUserId:actor.userId,action,entityType:"REQUIREMENT_ASSIGNMENT",entityId:loaded.assignment.id,departmentId:loaded.assignment.departmentId,summary,metadata:{requirementCode:"5.23.2.4"}},tx);const changed=(key:string)=>JSON.stringify(before.map(item=>item[key]))!==JSON.stringify(after.map(item=>item[key]));
      if(after.length>before.length)await record(AUDIT.COOPERATION_ACTIVATION_LINKED,"ربط علاقة تعاون بخطة التفعيل");if(changed("plan"))await record(AUDIT.COOPERATION_ACTIVATION_PLAN_UPDATED,"إنشاء أو تحديث خطة تفعيل التعاون");if(changed("meetings"))await record(AUDIT.COOPERATION_ACTIVATION_MEETING_UPDATED,"إضافة أو تحديث اجتماع متابعة ومحضره");if(changed("commitments")||changed("tasks"))await record(AUDIT.COOPERATION_ACTIVATION_COMMITMENT_UPDATED,"تحديث التزامات ومهام التعاون");if(changed("outputs"))await record(AUDIT.COOPERATION_ACTIVATION_OUTPUT_UPDATED,"توثيق مخرج فعلي للتعاون");if(changed("reports"))await record(AUDIT.COOPERATION_ACTIVATION_REPORT_UPDATED,"إضافة أو تحديث تقرير دوري");if(changed("decisions"))await record(AUDIT.COOPERATION_ACTIVATION_DECISION_UPDATED,"تسجيل قرار متابعة");if(changed("correctiveActions"))await record(AUDIT.COOPERATION_ACTIVATION_CORRECTIVE_UPDATED,"إنشاء أو تحديث إجراء تصحيحي");
    }
    if(requirementId==="5-23-3-r2"){
      const previous=loaded.assignment.workspaceData as WorkspaceData;
      const record=(action:string,summary:string,metadata?:Record<string,unknown>)=>writeAudit({actorUserId:actor.userId,action,entityType:"COMPLIANCE_REQUIREMENT",entityId:loaded.assignment.complianceRequirementId,departmentId:loaded.assignment.departmentId,summary,metadata:{requirementCode:"5.23.3.2",...metadata}},tx);
      const rows=(key:string,source:WorkspaceData)=>Array.isArray(source[key])?(source[key] as Record<string,unknown>[]):[];
      const changed=(key:string)=>JSON.stringify(rows(key,previous))!==JSON.stringify(rows(key,data));
      const before=(key:string)=>rows(key,previous);const after=(key:string)=>rows(key,data);
      if(after("processes").length>before("processes").length)await record(AUDIT.GOVERNANCE_PROCESS_CREATED,"اعتماد عملية/إجراء جديد ضمن تفعيل الحوكمة",{count:after("processes").length-before("processes").length});
      else if(changed("processes"))await record(AUDIT.GOVERNANCE_PROCESS_UPDATED,"تحديث عملية/إجراء ضمن تفعيل الحوكمة");
      if(changed("policies"))await record(AUDIT.GOVERNANCE_POLICY_UPDATED,"إضافة أو تحديث سياسة/وثيقة حوكمة");
      if(changed("reviews"))await record(AUDIT.GOVERNANCE_REVIEW_RECORDED,"توثيق مراجعة حوكمة");
      if(changed("decisions"))await record(AUDIT.GOVERNANCE_DECISION_RECORDED,"تسجيل قرار حوكمة");
      if(changed("performanceReports"))await record(AUDIT.GOVERNANCE_PERFORMANCE_REPORT_RECORDED,"إعداد أو تحديث تقرير أداء حوكمة");
    }
    if(requirementId==="5-23-3-r3"){
      const previous=loaded.assignment.workspaceData as WorkspaceData;const before=Array.isArray(previous.cultureActivities)?previous.cultureActivities:[];const after=Array.isArray(data.cultureActivities)?data.cultureActivities:[];
      const record=(action:string,summary:string,metadata?:Record<string,unknown>)=>writeAudit({actorUserId:actor.userId,action,entityType:"COMPLIANCE_REQUIREMENT",entityId:loaded.assignment.complianceRequirementId,departmentId:loaded.assignment.departmentId,summary,metadata:{requirementCode:"5.23.3.3",...metadata}},tx);
      const changed=(key:string)=>JSON.stringify(before.map(item=>item[key]))!==JSON.stringify(after.map(item=>item[key]));
      if(after.length>before.length)await record(AUDIT.CULTURE_ACTIVITY_CREATED,"إنشاء أو ربط نشاط لنشر ثقافة الابتكار",{count:after.length-before.length});
      else if(JSON.stringify(before.map(item=>({name:item.name,cultureType:item.cultureType,status:item.status})))!==JSON.stringify(after.map(item=>({name:item.name,cultureType:item.cultureType,status:item.status}))))await record(AUDIT.CULTURE_ACTIVITY_UPDATED,"تحديث بيانات نشاط نشر ثقافة الابتكار");
      if(changed("annualPlanActivityId"))await record(AUDIT.CULTURE_ACTIVITY_LINKED,"ربط نشاط نشر ثقافة الابتكار بالخطة السنوية");
      if(changed("participants"))await record(AUDIT.CULTURE_ACTIVITY_PARTICIPATION_UPDATED,"تحديث سجل المشاركين في نشاط نشر ثقافة الابتكار");
      if(changed("files"))await record(AUDIT.CULTURE_ACTIVITY_MATERIAL_UPDATED,"إضافة أو تحديث مادة معرفية/توعوية");
      if(after.some((item,index)=>item.status==="مكتملة"&&before[index]?.status!=="مكتملة"))await record(AUDIT.CULTURE_ACTIVITY_CLOSED,"إغلاق نشاط نشر ثقافة الابتكار");
    }
    if(requirementId==="5-23-3-r4"){
      const previous=loaded.assignment.workspaceData as WorkspaceData;const before=Array.isArray(previous.mechanismVersions)?previous.mechanismVersions:[];const after=Array.isArray(data.mechanismVersions)?data.mechanismVersions:[];
      const record=(action:string,summary:string,metadata?:Record<string,unknown>)=>writeAudit({actorUserId:actor.userId,action,entityType:"COMPLIANCE_REQUIREMENT",entityId:loaded.assignment.complianceRequirementId,departmentId:loaded.assignment.departmentId,summary,metadata:{requirementCode:"5.23.3.4",...metadata}},tx);
      const stagesOf=(row:Record<string,unknown>)=>Array.isArray(row.stages)?(row.stages as Record<string,unknown>[]):[];
      if(after.length>before.length)await record(AUDIT.MECHANISM_VERSION_CREATED,"توثيق إصدار جديد لآلية إدارة الابتكار الرقمي",{count:after.length-before.length});
      else if(JSON.stringify(before.map(v=>({name:v.name,description:v.description,owner:v.owner,approvingAuthority:v.approvingAuthority})))!==JSON.stringify(after.map(v=>({name:v.name,description:v.description,owner:v.owner,approvingAuthority:v.approvingAuthority}))))await record(AUDIT.MECHANISM_VERSION_UPDATED,"تحديث بيانات إصدار آلية إدارة الابتكار الرقمي");
      if(after.some((v,i)=>v.approvalStatus==="معتمد"&&before[i]?.approvalStatus!=="معتمد"))await record(AUDIT.MECHANISM_VERSION_APPROVED,"اعتماد إصدار آلية إدارة الابتكار الرقمي كإصدار حالي");
      if(after.some((v,i)=>v.approvalStatus==="تم الاستبدال"&&before[i]?.approvalStatus!=="تم الاستبدال"))await record(AUDIT.MECHANISM_VERSION_SUPERSEDED,"استبدال إصدار سابق بعد اعتماد إصدار أحدث");
      if(JSON.stringify(before.map(v=>stagesOf(v).map(s=>({name:s.name,archived:s.archived,order:s.order}))))!==JSON.stringify(after.map(v=>stagesOf(v).map(s=>({name:s.name,archived:s.archived,order:s.order})))))await record(AUDIT.MECHANISM_STAGE_UPDATED,"تحديث أو إعادة ترتيب مراحل خارطة الرحلة");
      if(JSON.stringify(before.map(v=>stagesOf(v).map(s=>s.gate)))!==JSON.stringify(after.map(v=>stagesOf(v).map(s=>s.gate))))await record(AUDIT.MECHANISM_GATE_UPDATED,"تحديث بوابة قرار بين مراحل الآلية");
    }
    if(requirementId==="5-23-1-r2"){
      const previous=loaded.assignment.workspaceData as WorkspaceData;
      const beforeInitiatives=Array.isArray(previous.initiatives)?previous.initiatives:[];
      const afterInitiatives=Array.isArray(data.initiatives)?data.initiatives:[];
      if(afterInitiatives.length>beforeInitiatives.length)await writeAudit({actorUserId:actor.userId,action:AUDIT.INITIATIVE_RECORD_CREATED,entityType:"COMPLIANCE_REQUIREMENT",entityId:loaded.assignment.complianceRequirementId,departmentId:loaded.assignment.departmentId,summary:"إنشاء سجل مبادرة ضمن المتطلب 5.23.1.2",metadata:{count:afterInitiatives.length-beforeInitiatives.length}},tx);
      else if(JSON.stringify(beforeInitiatives)!==JSON.stringify(afterInitiatives))await writeAudit({actorUserId:actor.userId,action:AUDIT.INITIATIVE_RECORD_UPDATED,entityType:"COMPLIANCE_REQUIREMENT",entityId:loaded.assignment.complianceRequirementId,departmentId:loaded.assignment.departmentId,summary:"تحديث سجل مبادرة ضمن المتطلب 5.23.1.2"},tx);
      if(JSON.stringify(previous.strategicAlignment)!==JSON.stringify(data.strategicAlignment))await writeAudit({actorUserId:actor.userId,action:AUDIT.INITIATIVE_OBJECTIVE_LINKED,entityType:"COMPLIANCE_REQUIREMENT",entityId:loaded.assignment.complianceRequirementId,departmentId:loaded.assignment.departmentId,summary:"ربط مبادرة بهدف استراتيجي معتمد في المتطلب 01"},tx);
      if(JSON.stringify(previous.initiativeKpis)!==JSON.stringify(data.initiativeKpis))await writeAudit({actorUserId:actor.userId,action:AUDIT.INITIATIVE_KPI_LINKED,entityType:"COMPLIANCE_REQUIREMENT",entityId:loaded.assignment.complianceRequirementId,departmentId:loaded.assignment.departmentId,summary:"ربط مبادرة بمؤشر أداء معتمد في المتطلب 01"},tx);
    }
    if(requirementId==="5-23-1-r3"){
      const previous=loaded.assignment.workspaceData as WorkspaceData;const before=Array.isArray(previous.cooperations)?previous.cooperations:[];const after=Array.isArray(data.cooperations)?data.cooperations:[];
      if(after.length>before.length)await writeAudit({actorUserId:actor.userId,action:AUDIT.COOPERATION_RECORD_CREATED,entityType:"COMPLIANCE_REQUIREMENT",entityId:loaded.assignment.complianceRequirementId,departmentId:loaded.assignment.departmentId,summary:"إنشاء سجل تعاون مؤسسي",metadata:{count:after.length-before.length}},tx);
      else if(JSON.stringify(before)!==JSON.stringify(after))await writeAudit({actorUserId:actor.userId,action:AUDIT.COOPERATION_RECORD_UPDATED,entityType:"COMPLIANCE_REQUIREMENT",entityId:loaded.assignment.complianceRequirementId,departmentId:loaded.assignment.departmentId,summary:"تحديث سجل تعاون مؤسسي"},tx);
      const beforeContacts=Array.isArray(previous.partnerContacts)?previous.partnerContacts:[];const afterContacts=Array.isArray(data.partnerContacts)?data.partnerContacts:[];
      if(afterContacts.length>beforeContacts.length)await writeAudit({actorUserId:actor.userId,action:AUDIT.COOPERATION_CONTACT_ADDED,entityType:"COMPLIANCE_REQUIREMENT",entityId:loaded.assignment.complianceRequirementId,departmentId:loaded.assignment.departmentId,summary:"إضافة جهة اتصال للشريك"},tx);
      else if(JSON.stringify(beforeContacts)!==JSON.stringify(afterContacts))await writeAudit({actorUserId:actor.userId,action:AUDIT.COOPERATION_CONTACT_UPDATED,entityType:"COMPLIANCE_REQUIREMENT",entityId:loaded.assignment.complianceRequirementId,departmentId:loaded.assignment.departmentId,summary:"تحديث جهة اتصال للشريك"},tx);
      if(beforeContacts.some((item,index)=>String(item.isPrimary)!==String(afterContacts[index]?.isPrimary)))await writeAudit({actorUserId:actor.userId,action:AUDIT.COOPERATION_PRIMARY_CONTACT_CHANGED,entityType:"COMPLIANCE_REQUIREMENT",entityId:loaded.assignment.complianceRequirementId,departmentId:loaded.assignment.departmentId,summary:"تغيير جهة الاتصال الرئيسية"},tx);
      if(afterContacts.some((item,index)=>item.status==="مؤرشف"&&beforeContacts[index]?.status!=="مؤرشف"))await writeAudit({actorUserId:actor.userId,action:AUDIT.COOPERATION_CONTACT_ARCHIVED,entityType:"COMPLIANCE_REQUIREMENT",entityId:loaded.assignment.complianceRequirementId,departmentId:loaded.assignment.departmentId,summary:"أرشفة جهة اتصال مع حفظ سجلها التاريخي"},tx);
      if(JSON.stringify(previous.agreements)!==JSON.stringify(data.agreements))await writeAudit({actorUserId:actor.userId,action:AUDIT.COOPERATION_AGREEMENT_LINKED,entityType:"COMPLIANCE_REQUIREMENT",entityId:loaded.assignment.complianceRequirementId,departmentId:loaded.assignment.departmentId,summary:"ربط اتفاقية بسجل التعاون"},tx);
    }
  });
  return {status};
}

export async function uploadRequirementEvidence(actor:AccessContext,requirementId:string,evidenceType:string,file:EvidenceFileInput,relatedRecord?:string) {
  const loaded=await loadRequirementWorkspace(actor,requirementId); const config=getWorkspaceConfig(requirementId)!;
  if(!loaded.canEdit || !config.evidence.some((rule)=>rule.key===evidenceType)) throw new WorkspaceError("FORBIDDEN");
  const validated=validateFile(file); const storage=await getStorage(); const key=buildEntityEvidenceKey({namespace:"requirement-workspaces",entityId:loaded.assignment.id,fileName:validated.fileName});
  try { await storage.put(key,validated.bytes,{contentType:validated.mimeType,checksum:validated.checksum,fileName:validated.fileName}); } catch(error){ throw new WorkspaceError("STORAGE_FAILED",error instanceof Error?error.message:undefined); }
  try { return await prisma.$transaction(async(tx)=>{ const previous=await tx.evidence.findFirst({where:{links:{some:{entityType:"REQUIREMENT_ASSIGNMENT",entityId:loaded.assignment.id}},classification:evidenceType,archivedAt:null},orderBy:{version:"desc"},select:{version:true}}); const created=await tx.evidence.create({data:{title:config.evidence.find((r)=>r.key===evidenceType)!.title,classification:evidenceType,fileName:validated.fileName,mimeType:validated.mimeType,sizeBytes:validated.sizeBytes,checksum:validated.checksum,storagePath:key,version:(previous?.version??0)+1,ownerUserId:loaded.assignment.ownerUserId,uploadedById:actor.userId,reviewStatus:"DRAFT",fileProcessingStatus:"UPLOADED",notes:relatedRecord?.trim()?`مرتبط بالسجل: ${relatedRecord.trim()}`:null}}); await tx.evidenceLink.create({data:{evidenceId:created.id,entityType:"REQUIREMENT_ASSIGNMENT",entityId:loaded.assignment.id,requirementId:loaded.assignment.complianceRequirementId}});if(requirementId==="5-23-1-r3"&&relatedRecord?.trim()){const workspace=loaded.assignment.workspaceData as WorkspaceData;const agreement=(Array.isArray(workspace.agreements)?workspace.agreements:[]).find(row=>String(row.cooperationName??"")===relatedRecord.trim());if(agreement?.agreementId)await tx.evidenceLink.create({data:{evidenceId:created.id,entityType:"COOPERATION_AGREEMENT",entityId:String(agreement.agreementId),requirementId:loaded.assignment.complianceRequirementId}});} const status=deriveOperationalStatus(config,loaded.assignment.workspaceData as WorkspaceData,loaded.approvedCounts); await tx.complianceRequirementAssignment.update({where:{id:loaded.assignment.id},data:{operationalStatus:status,lastSavedById:actor.userId}}); await writeAudit({actorUserId:actor.userId,action:AUDIT.EVIDENCE_UPLOADED,entityType:"EVIDENCE",entityId:created.id,departmentId:loaded.assignment.departmentId,summary:"رفع إثبات لمتطلب تشغيلي",metadata:{requirementCode:config.code,evidenceType,assignmentId:loaded.assignment.id,version:created.version,relatedRecord:relatedRecord?.trim()||null}},tx); return {id:created.id,status}; }); } catch(error){ try{await storage.delete(key);}catch{} throw error; }
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
