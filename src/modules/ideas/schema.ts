import { z } from "zod";

/**
 * Idea intake. The current Idea schema has no separate `problemStatement`
 * column (that lives on InnovationSolution), so the problem context is captured
 * in `description`. No new fields are introduced in Phase 3A.
 */
export const createIdeaSchema = z.object({
  titleAr: z.string().trim().min(3, "العنوان مطلوب (3 أحرف على الأقل)").max(200, "العنوان طويل جدًا"),
  description: z.string().trim().max(4000, "الوصف طويل جدًا").optional().or(z.literal("")),
  departmentId: z.string().trim().min(1, "الإدارة المالكة مطلوبة"),
  activityId: z.string().trim().optional().or(z.literal("")),
});
export type CreateIdeaInput = z.infer<typeof createIdeaSchema>;

// Editable fields for a DRAFT are the same intake fields.
export const updateIdeaSchema = createIdeaSchema;
export type UpdateIdeaInput = CreateIdeaInput;

export const IDEA_STATUS_LABELS: Record<string, string> = {
  DRAFT: "مسودة",
  SUBMITTED: "مُقدّمة",
  INITIAL_REVIEW: "مراجعة أولية",
  TECHNICAL_REVIEW: "مراجعة فنية",
  MORE_INFO_REQUESTED: "بانتظار معلومات",
  APPROVED_FOR_PILOT: "معتمدة للتجريب",
  REJECTED: "مرفوضة",
  CONVERTED_TO_SOLUTION: "محوّلة إلى حل",
  WITHDRAWN: "مسحوبة",
  ARCHIVED: "مؤرشفة",
};
