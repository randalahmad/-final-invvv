import { z } from "zod";

/** "" | undefined → null; otherwise a trimmed string. */
const optionalText = (max: number) =>
  z
    .union([z.string(), z.undefined(), z.null()])
    .transform((v) => (typeof v === "string" && v.trim() ? v.trim() : null))
    .refine((v) => v === null || v.length <= max, { message: "القيمة طويلة جدًا" });

/** Optional date coming from a form input (yyyy-mm-dd). */
const optionalDate = z
  .union([z.string(), z.undefined(), z.null()])
  .transform((v) => (typeof v === "string" && v.trim() ? new Date(v) : null))
  .refine((v) => v === null || !Number.isNaN(v.getTime()), { message: "تاريخ غير صالح" });

/**
 * Editable StrategicObjective fields. departmentId is required here (a
 * business-rule tightening on top of the nullable DB column) because
 * department-scoped authorization and the /strategy dashboard both depend
 * on every objective having a clear owning department.
 */
export const strategicObjectiveSchema = z
  .object({
    code: optionalText(40),
    titleAr: z.string().trim().min(3, "عنوان الهدف مطلوب (3 أحرف على الأقل)").max(200, "العنوان طويل جدًا"),
    description: optionalText(4000),
    departmentId: z.string().trim().min(1, "الجهة المسؤولة مطلوبة"),
    responsibleUserId: optionalText(60),
    kpi: optionalText(300),
    targetValue: optionalText(120),
    periodStart: optionalDate,
    periodEnd: optionalDate,
  })
  .refine((v) => !v.periodStart || !v.periodEnd || v.periodStart <= v.periodEnd, {
    message: "تاريخ بداية الفترة يجب أن يسبق تاريخ نهايتها",
    path: ["periodEnd"],
  });

export type StrategicObjectiveInput = z.infer<typeof strategicObjectiveSchema>;

export const RECORD_STATUS_LABELS: Record<string, string> = {
  DRAFT: "مسودة",
  ACTIVE: "نشط",
  ARCHIVED: "مؤرشف",
};

export const assignmentSchema = z.object({
  complianceRequirementId: z.string().trim().min(1, "المعيار مطلوب"),
  departmentId: z.string().trim().min(1, "الجهة مطلوبة"),
  strategicObjectiveId: optionalText(60),
  dueDate: optionalDate,
});
export type AssignmentInput = z.infer<typeof assignmentSchema>;

export const DOCUMENT_APPROVAL_STATUS_LABELS: Record<string, string> = {
  DRAFT: "مسودة",
  PENDING_APPROVAL: "بانتظار الاعتماد",
  APPROVED: "معتمدة",
  REJECTED: "مرفوضة",
};

export const strategyDocumentSchema = z.object({
  titleAr: z.string().trim().min(3, "اسم الوثيقة مطلوب (3 أحرف على الأقل)").max(200, "الاسم طويل جدًا"),
  documentType: z.string().trim().min(1, "نوع الوثيقة مطلوب").max(80, "قيمة طويلة جدًا"),
  description: optionalText(2000),
  documentDate: optionalDate,
  approvalStatus: z.enum(["DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED"]).default("DRAFT"),
  notes: optionalText(2000),
});
export type StrategyDocumentInput = z.infer<typeof strategyDocumentSchema>;

export const ASSIGNMENT_STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: "لم يبدأ",
  IN_PROGRESS: "قيد الاستكمال",
  FULFILLED: "مستوفى",
};
