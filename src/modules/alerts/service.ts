import { prisma } from "@/server/db";
import type { AccessContext } from "@/server/access-context";
import { requirePermission, effectiveScopes, solutionScopeWhere } from "@/server/authorization";
import type { AlertItemData } from "./types";
import { getRequirementByCode } from "@/modules/dga/workspace-config";

const VIEW = "alert.view" as const;

const ALERT_TYPE_LABELS: Record<string, string> = {
  MEETING_OVERDUE: "اجتماع متأخر",
  MEETING_UPCOMING: "اجتماع قادم",
  AGREEMENT_EXPIRY: "انتهاء اتفاقية",
  AGREEMENT_RENEWAL: "تجديد اتفاقية",
  MISSING_EVIDENCE: "شواهد ناقصة",
  INCOMPLETE_SOLUTION: "بيانات حل ناقصة",
  IMPACT_WINDOW: "نافذة قياس أثر",
  EVALUATION_DEADLINE: "موعد تقييم",
  APPROVAL_TASK: "مهمة اعتماد",
};

/**
 * Alerts visible to the caller: platform-scope actors (SYSTEM_ADMIN) see all
 * open/acknowledged alerts; everyone else sees only alerts assigned to them.
 * `Alert` has no direct department/organization column (it targets an
 * arbitrary entity via entityType/entityId), so per-department scoping
 * would require resolving each entity's owner — not needed for this: no
 * alert-generation logic exists yet anywhere in the codebase, so this is a
 * correct, honest scoping rule for whatever alerts do get created.
 */
const TASK_TAGS: Record<string, string> = { PREPARE: "مهمة إعداد", REVIEW: "طلب مراجعة", APPROVE: "طلب اعتماد", AMEND: "طلب تعديل", RESPOND: "طلب رد", FOLLOW_UP: "متابعة" };

export async function listAlertsInScope(actor: AccessContext): Promise<AlertItemData[]> {
  requirePermission(actor, VIEW);
  const es = effectiveScopes(actor);
  const solutionScope = await solutionScopeWhere(actor);
  const now = new Date();

  const [rows, assignments, measurements, tasks, staleEvidence] = await Promise.all([prisma.alert.findMany({
    where: {
      status: { in: ["OPEN", "ACKNOWLEDGED"] },
      ...(es.platform ? {} : { assignedToUserId: actor.userId }),
    },
    orderBy: [{ severity: "desc" }, { openedAt: "desc" }],
    select: { id: true, type: true, severity: true, title: true, message: true, source: true, dueDate: true },
  }), prisma.complianceRequirementAssignment.findMany({
    where:{archivedAt:null,operationalStatus:{not:"COMPLETED"},dueDate:{not:null},...(es.platform?{}:{responsibleUserId:actor.userId})},
    select:{id:true,dueDate:true,responsibleUserId:true,requirement:{select:{code:true,titleAr:true}}},take:20,
  }), prisma.impactMeasurement.findMany({
    where:{supersededBy:{none:{}},verificationStatus:"UNVERIFIED",periodEnd:{lt:new Date()},indicator:{solution:{is:{AND:[solutionScope,{archivedAt:null}]}}}},
    select:{id:true,periodEnd:true,indicator:{select:{solutionId:true,nameAr:true,solution:{select:{nameAr:true}}}}},take:20,
  }),
  // Real per-task alerts: assignment/due-date/overdue/review/approval/rejection
  // requests, all already modeled by RequirementTask.type — no synthetic events.
  prisma.requirementTask.findMany({
    where: { assignedToUserId: actor.userId, status: { in: ["OPEN", "IN_PROGRESS", "WAITING"] } },
    select: { id: true, type: true, title: true, dueDate: true, assignmentId: true, assignment: { select: { requirement: { select: { code: true } } } } },
    orderBy: { dueDate: "asc" }, take: 30,
  }),
  // Evidence needing update — real Evidence.reviewStatus/validUntil, scoped to what the caller owns/uploaded (platform sees all).
  prisma.evidence.findMany({
    where: { archivedAt: null, OR: [{ reviewStatus: "NEEDS_UPDATE" }, { validUntil: { lt: now } }], ...(es.platform ? {} : { OR: [{ ownerUserId: actor.userId }, { uploadedById: actor.userId }] }) },
    select: { id: true, title: true, validUntil: true, reviewStatus: true, links: { take: 1, select: { entityType: true, entityId: true } } },
    take: 20,
  })]);

  const stored: AlertItemData[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    detail: r.message ?? "—",
    tag: ALERT_TYPE_LABELS[r.type] ?? r.type,
    severity: r.severity === "CRITICAL" ? "urgent" : "reminder",
    dueDate: r.dueDate?.toISOString(),
  }));
  const requirementAlerts: AlertItemData[] = assignments.map((row)=>({id:`requirement-${row.id}`,title:row.requirement.titleAr,detail:`المتطلب ${row.requirement.code} لم يكتمل قبل الموعد المحدد.`,tag:"متطلب متأخر",severity:row.dueDate! < new Date()?"urgent":"reminder",href:`/${row.requirement.code.startsWith("5.23.1")?"strategy":row.requirement.code.startsWith("5.23.2")?"activities":"governance"}/requirements/${getRequirementByCode(row.requirement.code)?.requirementId ?? ""}`,dueDate:row.dueDate?.toISOString()}));
  const impactAlerts: AlertItemData[] = measurements.map((row)=>({id:`impact-${row.id}`,title:`قياس أثر متأخر: ${row.indicator.solution.nameAr}`,detail:`انتهت فترة مؤشر «${row.indicator.nameAr}» ولم يتم التحقق من القياس.`,tag:"نافذة قياس أثر",severity:"urgent",href:`/impact/${row.indicator.solutionId}`,dueDate:row.periodEnd?.toISOString()}));
  const taskAlerts: AlertItemData[] = tasks.map((t)=>({id:`task-${t.id}`,title:t.title,detail:`مهمة ${TASK_TAGS[t.type]??t.type} مرتبطة بالمتطلب ${t.assignment.requirement?.code??""}.`,tag:TASK_TAGS[t.type]??t.type,severity:t.dueDate&&t.dueDate<now?"urgent":"reminder",href:"/my-tasks",dueDate:t.dueDate?.toISOString()}));
  const evidenceAlerts: AlertItemData[] = staleEvidence.map((e)=>({id:`evidence-${e.id}`,title:e.title,detail:e.reviewStatus==="NEEDS_UPDATE"?"هذا الدليل يحتاج تحديثًا حسب قرار المراجع.":`انتهت صلاحية هذا الدليل في ${e.validUntil?new Date(e.validUntil).toLocaleDateString("ar-SA"):"—"}.`,tag:"دليل يحتاج تحديثًا",severity:"reminder",href:e.links[0]?.entityType==="INNOVATION_SOLUTION"?`/solutions/${e.links[0].entityId}`:"/evidence-repository"}));
  return [...requirementAlerts,...taskAlerts,...evidenceAlerts,...impactAlerts,...stored];
}
