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

/** Optional non-negative number from a form input. */
const optionalNumber = z
  .union([z.string(), z.number(), z.undefined(), z.null()])
  .transform((v) => {
    if (v === undefined || v === null || v === "") return null;
    const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
    return Number.isFinite(n) ? n : NaN;
  })
  .refine((v) => v === null || (!Number.isNaN(v) && v >= 0), { message: "قيمة رقمية غير صالحة" });

export const MATURITY_STAGES = ["CONCEPT", "PROTOTYPE", "POC", "PILOT", "OPERATIONAL"] as const;
export const IMPLEMENTATION_STATUSES = ["PLANNING", "IN_PROGRESS", "OPERATING", "ON_HOLD", "COMPLETED", "CANCELLED"] as const;
export const SOLUTION_SOURCES = ["ACTIVITY", "INTERNAL_PROPOSAL", "EXTERNAL_PARTNERSHIP"] as const;
export const PORTFOLIO_STATUSES = ["RECEIVED", "NEEDS_COMPLETION", "UNDER_REVIEW", "ACCEPTED", "IN_PROGRESS", "OPERATIONAL", "ON_HOLD", "ARCHIVED"] as const;

/**
 * Editable solution fields. Deliberately excludes ideaId, status, publishedAt,
 * completionPct, evidenceReadinessPct and archive metadata — those are never
 * mass-assignable from a form (the Idea link in particular must be preserved).
 */
export const solutionSchema = z
  .object({
    nameAr: z.string().trim().min(3, "اسم الحل مطلوب (3 أحرف على الأقل)").max(200, "الاسم طويل جدًا"),
    description: optionalText(4000),
    problemStatement: optionalText(4000),
    owningDepartmentId: z.string().trim().min(1, "الإدارة المالكة مطلوبة"),
    source: z.enum(SOLUTION_SOURCES).default("INTERNAL_PROPOSAL"),
    activityId: optionalText(60),
    ownerUserId: optionalText(60),
    strategicObjectiveId: optionalText(60),
    maturityStage: z.enum(MATURITY_STAGES).default("CONCEPT"),
    implementationStatus: z.enum(IMPLEMENTATION_STATUSES).default("PLANNING"),
    startDate: optionalDate,
    targetEndDate: optionalDate,
    actualEndDate: optionalDate,
    durationMonths: optionalNumber,
    cost: optionalNumber,
    targetBeneficiaries: optionalText(500),
    technologies: optionalText(500),
    risks: optionalText(2000),
    notes: optionalText(2000),
    launchDate: optionalDate,
    beneficiaryCount: optionalNumber,
    achievedOrExpectedImpact: optionalText(2000),
    beneficiarySatisfactionPct: optionalNumber,
    previouslySubmittedForMeasurement: z.union([z.boolean(), z.string(), z.undefined()]).transform((v) => v === true || v === "on" || v === "true"),
    significantChangeNote: optionalText(2000),
    innovationMethodologySource: optionalText(500),
    digitalTransformationPlanLink: optionalText(500),
    isSustained: z.union([z.boolean(), z.string(), z.undefined()]).transform((v) => v === true || v === "on" || v === "true"),
    sustainabilityOwner: optionalText(200),
    sustainabilityPlan: optionalText(2000),
    portfolioStatus: z.enum(PORTFOLIO_STATUSES).default("NEEDS_COMPLETION"),
    externalReferenceId: optionalText(120),
    solutionType: optionalText(120),
    domain: optionalText(120),
    executingEntity: optionalText(200),
    operationalOwner: optionalText(200),
    nextAction: optionalText(500),
    nextActionDueDate: optionalDate,
    expectedImpact: optionalText(2000),
    achievedImpact: optionalText(2000),
    satisfactionMeasurementSource: optionalText(500),
    satisfactionMeasurementDate: optionalDate,
    usageStartDate: optionalDate,
    stillInUse: z.union([z.boolean(), z.string(), z.undefined()]).transform((v) => v === true || v === "on" || v === "true"),
    usingDepartmentName: optionalText(200),
    operationNotes: optionalText(2000),
    digitalTransformationObjective: optionalText(500),
    innovationObjective: optionalText(500),
    linkedInitiative: optionalText(500),
    technologyTagsText: optionalText(1000),
    duplicateContinuationReason: optionalText(1000),
  })
  .refine((d) => !d.startDate || !d.targetEndDate || d.targetEndDate >= d.startDate, {
    path: ["targetEndDate"],
    message: "تاريخ الانتهاء المستهدف يجب أن يكون بعد تاريخ البدء",
  });

export type SolutionInput = z.infer<typeof solutionSchema>;

export const MATURITY_LABELS: Record<string, string> = {
  CONCEPT: "مفهوم",
  PROTOTYPE: "نموذج أولي",
  POC: "إثبات مفهوم",
  PILOT: "نسخة تجريبية",
  OPERATIONAL: "تشغيل فعلي",
};
export const IMPLEMENTATION_LABELS: Record<string, string> = {
  PLANNING: "تخطيط",
  IN_PROGRESS: "قيد التنفيذ",
  OPERATING: "تشغيل",
  ON_HOLD: "متوقف مؤقتًا",
  COMPLETED: "مكتمل",
  CANCELLED: "ملغى",
};
export const SOURCE_LABELS: Record<string, string> = {
  ACTIVITY: "فعالية ابتكارية",
  INTERNAL_PROPOSAL: "مقترح داخلي",
  EXTERNAL_PARTNERSHIP: "شراكة خارجية",
};
export const RECORD_STATUS_LABELS: Record<string, string> = {
  DRAFT: "مسودة",
  ACTIVE: "نشط",
  ARCHIVED: "مؤرشف",
};
export const PORTFOLIO_STATUS_LABELS: Record<string, string> = {
  RECEIVED: "جديد / مستلم", NEEDS_COMPLETION: "يحتاج استكمال", UNDER_REVIEW: "قيد المراجعة", ACCEPTED: "مقبول في السجل", IN_PROGRESS: "قيد التنفيذ", OPERATIONAL: "تشغيلي", ON_HOLD: "متوقف", ARCHIVED: "مؤرشف",
};
