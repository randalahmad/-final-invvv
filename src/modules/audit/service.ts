import { prisma } from "@/server/db";
import type { LinkedEntityType } from "@prisma/client";
import type { AccessContext } from "@/server/access-context";
import { requirePermission } from "@/server/authorization";

const VIEW = "audit.view" as const;

const ACTION_LABELS:Record<string,string>={ACTIVITY_TASK_ASSIGNED:"إسناد مهمة نشاط",ACTIVITY_TASK_COMPLETED:"إكمال مهمة نشاط",ACTIVITY_MILESTONE_UPDATED:"تحديث محطة نشاط",ACTIVITY_MEETING_RECORDED:"توثيق لقاء نشاط",ACTIVITY_DELIVERABLE_REVIEWED:"مراجعة تسليم نشاط",ACTIVITY_OUTPUT_ADDED:"إضافة مخرج نشاط",ACTIVITY_CLOSED:"إغلاق نشاط",SECTION_CONTRIBUTION_ASSIGNED:"إسناد مساهمة قسم",SECTION_CONTRIBUTION_OPENED:"فتح دعوة مساهمة",SECTION_CONTRIBUTION_SUBMITTED:"تسليم مساهمة",SECTION_CONTRIBUTION_RETURNED:"إعادة مساهمة للتعديل",SECTION_CONTRIBUTION_ACCEPTED:"قبول مساهمة",SECTION_CONTRIBUTION_CANCELLED:"إلغاء إسناد مساهمة",INITIATIVE_RECORD_CREATED:"إنشاء سجل مبادرة",INITIATIVE_RECORD_UPDATED:"تحديث سجل مبادرة",INITIATIVE_OBJECTIVE_LINKED:"ربط مبادرة بهدف استراتيجي",INITIATIVE_KPI_LINKED:"ربط مبادرة بمؤشر أداء",COOPERATION_RECORD_CREATED:"إنشاء سجل تعاون",COOPERATION_RECORD_UPDATED:"تحديث سجل تعاون",COOPERATION_CONTACT_ADDED:"إضافة جهة اتصال للشريك",COOPERATION_CONTACT_UPDATED:"تحديث جهة اتصال للشريك",COOPERATION_PRIMARY_CONTACT_CHANGED:"تغيير جهة الاتصال الرئيسية",COOPERATION_CONTACT_ARCHIVED:"أرشفة جهة اتصال للشريك",COOPERATION_AGREEMENT_LINKED:"ربط اتفاقية بسجل التعاون",COOPERATION_STATUS_CHANGED:"تغيير حالة التعاون"};
ACTION_LABELS.METHODOLOGY_CASE_UPDATED="تحديث حالة تطبيق منهجية";
ACTION_LABELS.METHODOLOGY_SESSION_RECORDED="توثيق جلسة منهجية";
ACTION_LABELS.METHODOLOGY_PARTICIPANT_ADDED="إضافة مشارك في تطبيق منهجية";
ACTION_LABELS.METHODOLOGY_SOLUTION_ADDED="توثيق حل مقترح من جلسة";
ACTION_LABELS.METHODOLOGY_PROTOTYPE_UPDATED="تحديث نموذج أولي أو مرحلة تطوير";
ACTION_LABELS.METHODOLOGY_PROJECT_LINKED="ربط مشروع ناتج";
ACTION_LABELS.METHODOLOGY_KPI_LINKED="ربط مؤشر وأثر";
ACTION_LABELS.METHODOLOGY_CASE_CLOSED="إغلاق حالة تطبيق منهجية";
ACTION_LABELS.OPEN_INNOVATION_EVENT_CREATED="إنشاء فعالية ابتكار مفتوح";
ACTION_LABELS.OPEN_INNOVATION_EVENT_UPDATED="تحديث بيانات فعالية ابتكار مفتوح";
ACTION_LABELS.OPEN_INNOVATION_ACTIVITY_LINKED="ربط فعالية بالخطة السنوية";
ACTION_LABELS.OPEN_INNOVATION_CHALLENGE_UPDATED="تحديث تحديات الفعالية";
ACTION_LABELS.OPEN_INNOVATION_PARTICIPATION_UPDATED="تحديث المشاركين والفرق";
ACTION_LABELS.OPEN_INNOVATION_SOLUTION_UPDATED="تحديث الحلول والمشاركات";
ACTION_LABELS.OPEN_INNOVATION_JUDGING_UPDATED="تحديث التحكيم والفائزين";
ACTION_LABELS.OPEN_INNOVATION_PROTOTYPE_UPDATED="تحديث النماذج الأولية";
ACTION_LABELS.OPEN_INNOVATION_PROJECT_LINKED="ربط مشروع ناتج";
ACTION_LABELS.OPEN_INNOVATION_TASK_UPDATED="تحديث مهام الفعالية";
ACTION_LABELS.OPEN_INNOVATION_EVENT_CLOSED="إغلاق فعالية ابتكار مفتوح تشغيليًا";
export const auditActionLabel=(action:string)=>ACTION_LABELS[action]??action;

export interface AuditLogRow {
  id: string;
  actorName: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  summary: string | null;
  createdAt: Date;
}

/** Most recent audit entries, platform-wide — SYSTEM_ADMIN only (audit.view). No department scoping: the audit trail is a platform-level governance record.
 * entityTypes/entityIds (optional) scope the log to specific records — used by the per-requirement Audit Trail card so it reuses this exact service instead of a parallel query. */
export async function listAuditLog(actor: AccessContext, opts?: { q?: string; action?: string; entityTypes?: LinkedEntityType[]; entityIds?: string[] }): Promise<AuditLogRow[]> {
  requirePermission(actor, VIEW);
  const rows = await prisma.auditLog.findMany({
    where: {
      ...(opts?.action ? { action: opts.action } : {}),
      ...(opts?.q?.trim() ? { summary: { contains: opts.q.trim(), mode: "insensitive" } } : {}),
      ...(opts?.entityTypes?.length ? { entityType: { in: opts.entityTypes } } : {}),
      ...(opts?.entityIds?.length ? { entityId: { in: opts.entityIds } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      action: true,
      entityType: true,
      entityId: true,
      summary: true,
      createdAt: true,
      actor: { select: { name: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    actorName: r.actor?.name ?? null,
    action: r.action,
    entityType: r.entityType,
    entityId: r.entityId,
    summary: r.summary,
    createdAt: r.createdAt,
  }));
}

/** Distinct action values currently in the log — used to populate the filter dropdown from real data (no hardcoded list). */
export async function listDistinctAuditActions(actor: AccessContext): Promise<string[]> {
  requirePermission(actor, VIEW);
  const rows = await prisma.auditLog.findMany({ distinct: ["action"], select: { action: true }, orderBy: { action: "asc" } });
  return rows.map((r) => r.action);
}
