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
ACTION_LABELS.COOPERATION_ACTIVATION_LINKED="ربط علاقة تعاون بخطة التفعيل";
ACTION_LABELS.COOPERATION_ACTIVATION_PLAN_UPDATED="تحديث خطة تفعيل التعاون";
ACTION_LABELS.COOPERATION_ACTIVATION_MEETING_UPDATED="تحديث اجتماع متابعة ومحضره";
ACTION_LABELS.COOPERATION_ACTIVATION_COMMITMENT_UPDATED="تحديث التزامات ومهام التعاون";
ACTION_LABELS.COOPERATION_ACTIVATION_OUTPUT_UPDATED="توثيق مخرج فعلي للتعاون";
ACTION_LABELS.COOPERATION_ACTIVATION_REPORT_UPDATED="تحديث تقرير دوري للتعاون";
ACTION_LABELS.COOPERATION_ACTIVATION_DECISION_UPDATED="تسجيل قرار متابعة";
ACTION_LABELS.COOPERATION_ACTIVATION_CORRECTIVE_UPDATED="تحديث إجراء تصحيحي";
// 5.23.3 Requirement 01 — تشكيل وحدة أو لجنة للابتكار.
ACTION_LABELS.COMMITTEE_CREATED="تشكيل وحدة/لجنة ابتكار";
ACTION_LABELS.COMMITTEE_UPDATED="تحديث بيانات وحدة/لجنة";
ACTION_LABELS.COMMITTEE_ARCHIVED="أرشفة وحدة/لجنة";
ACTION_LABELS.COMMITTEE_DECISION_RECORDED="توثيق قرار التشكيل";
ACTION_LABELS.COMMITTEE_MEMBER_ADDED="إضافة عضو للوحدة/اللجنة";
ACTION_LABELS.COMMITTEE_MEMBER_UPDATED="تحديث بيانات عضو";
ACTION_LABELS.COMMITTEE_MEMBER_ROLE_UPDATED="تغيير دور عضو داخل اللجنة";
ACTION_LABELS.COMMITTEE_MEMBER_REMOVED="إنهاء/أرشفة عضوية عضو";
ACTION_LABELS.COMMITTEE_MEETING_CREATED="توثيق اجتماع للجنة";
ACTION_LABELS.COMMITTEE_MEETING_UPDATED="تحديث بيانات اجتماع";
ACTION_LABELS.COMMITTEE_MEETING_ARCHIVED="أرشفة اجتماع";
ACTION_LABELS.COMMITTEE_TASK_ASSIGNED="إسناد مهمة وحدة/لجنة";
ACTION_LABELS.COMMITTEE_TASK_COMPLETED="إكمال مهمة وحدة/لجنة";
ACTION_LABELS.GOVERNANCE_PROCESS_CREATED="اعتماد عملية/إجراء حوكمة جديد";
ACTION_LABELS.GOVERNANCE_PROCESS_UPDATED="تحديث عملية/إجراء حوكمة";
ACTION_LABELS.GOVERNANCE_POLICY_UPDATED="إضافة أو تحديث سياسة/وثيقة حوكمة";
ACTION_LABELS.GOVERNANCE_REVIEW_RECORDED="توثيق مراجعة حوكمة";
ACTION_LABELS.GOVERNANCE_DECISION_RECORDED="تسجيل قرار حوكمة";
ACTION_LABELS.GOVERNANCE_CORRECTIVE_ACTION_ASSIGNED="فتح/إسناد إجراء تصحيحي";
ACTION_LABELS.GOVERNANCE_CORRECTIVE_ACTION_COMPLETED="إغلاق إجراء تصحيحي";
ACTION_LABELS.GOVERNANCE_PERFORMANCE_REPORT_RECORDED="إعداد أو تحديث تقرير أداء حوكمة";
ACTION_LABELS.GOVERNANCE_TASK_ASSIGNED="إسناد مهمة تفعيل حوكمة";
ACTION_LABELS.GOVERNANCE_TASK_COMPLETED="إكمال مهمة تفعيل حوكمة";
ACTION_LABELS.CULTURE_ACTIVITY_CREATED="إنشاء أو ربط نشاط لنشر ثقافة الابتكار";
ACTION_LABELS.CULTURE_ACTIVITY_UPDATED="تحديث بيانات نشاط نشر ثقافة الابتكار";
ACTION_LABELS.CULTURE_ACTIVITY_LINKED="ربط نشاط نشر ثقافة الابتكار بالخطة السنوية";
ACTION_LABELS.CULTURE_ACTIVITY_PARTICIPATION_UPDATED="تحديث سجل المشاركين في نشاط نشر ثقافة الابتكار";
ACTION_LABELS.CULTURE_ACTIVITY_MATERIAL_UPDATED="إضافة أو تحديث مادة معرفية/توعوية";
ACTION_LABELS.CULTURE_ACTIVITY_TASK_ASSIGNED="إسناد مهمة تنظيم نشاط ثقافة الابتكار";
ACTION_LABELS.CULTURE_ACTIVITY_TASK_COMPLETED="إكمال مهمة تنظيم نشاط ثقافة الابتكار";
ACTION_LABELS.CULTURE_ACTIVITY_CLOSED="إغلاق نشاط نشر ثقافة الابتكار";
ACTION_LABELS.MECHANISM_VERSION_CREATED="توثيق إصدار جديد لآلية إدارة الابتكار الرقمي";
ACTION_LABELS.MECHANISM_VERSION_UPDATED="تحديث بيانات إصدار آلية إدارة الابتكار الرقمي";
ACTION_LABELS.MECHANISM_VERSION_APPROVED="اعتماد إصدار آلية إدارة الابتكار الرقمي";
ACTION_LABELS.MECHANISM_VERSION_SUPERSEDED="استبدال إصدار سابق لآلية إدارة الابتكار الرقمي";
ACTION_LABELS.MECHANISM_STAGE_UPDATED="تحديث/إعادة ترتيب مراحل خارطة الرحلة";
ACTION_LABELS.MECHANISM_GATE_UPDATED="تحديث بوابة قرار بين مراحل الآلية";
ACTION_LABELS.MECHANISM_TASK_ASSIGNED="إسناد مهمة توثيق آلية الابتكار";
ACTION_LABELS.MECHANISM_TASK_COMPLETED="إكمال مهمة توثيق آلية الابتكار";
ACTION_LABELS.INTAKE_LINK_CREATED="إنشاء رابط استقبال مقترحات/تغذية راجعة";
ACTION_LABELS.INTAKE_LINK_UPDATED="تحديث بيانات رابط الاستقبال";
ACTION_LABELS.INTAKE_LINK_STATUS_CHANGED="تغيير حالة رابط الاستقبال";
ACTION_LABELS.INTAKE_FORM_CONFIG_UPDATED="تحديث إعداد حقول نموذج الاستقبال";
ACTION_LABELS.INTAKE_RESPONSE_RECEIVED="استلام رد عبر رابط الاستقبال";
ACTION_LABELS.INTAKE_RESPONSE_STATUS_CHANGED="تحديث حالة الرد";
ACTION_LABELS.INTAKE_RESPONSE_OWNER_ASSIGNED="إسناد مالك للرد";
ACTION_LABELS.INTAKE_RESPONSE_TASK_ASSIGNED="إسناد مهمة متابعة رد";
ACTION_LABELS.INTAKE_RESPONSE_TASK_COMPLETED="إكمال مهمة متابعة رد";
ACTION_LABELS.INTAKE_RESPONSE_CLOSED="إغلاق رد";
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
