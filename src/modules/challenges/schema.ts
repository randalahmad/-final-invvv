import { z } from "zod";

const optionalText = (max: number) =>
  z
    .union([z.string(), z.undefined(), z.null()])
    .transform((v) => (typeof v === "string" && v.trim() ? v.trim() : null))
    .refine((v) => v === null || v.length <= max, { message: "القيمة طويلة جدًا" });

export const CHALLENGE_STATUSES = ["NEW", "UNDER_REVIEW", "SOLUTION_PROPOSED", "IN_PROGRESS", "RESOLVED", "CLOSED_WITHOUT_SOLUTION"] as const;

export const CHALLENGE_STATUS_LABELS: Record<string, string> = {
  NEW: "جديد",
  UNDER_REVIEW: "قيد الدراسة",
  SOLUTION_PROPOSED: "حل مقترَح",
  IN_PROGRESS: "قيد التنفيذ",
  RESOLVED: "مُعالَج",
  CLOSED_WITHOUT_SOLUTION: "مُغلَق بلا حل",
};

export const challengeSchema = z.object({
  titleAr: z.string().trim().min(3, "عنوان التحدي مطلوب (3 أحرف على الأقل)").max(200, "العنوان طويل جدًا"),
  description: optionalText(4000),
  departmentId: z.string().trim().min(1, "الجهة المالكة مطلوبة"),
  category: optionalText(120),
});
export type ChallengeInput = z.infer<typeof challengeSchema>;

export const challengeStatusSchema = z.object({
  status: z.enum(CHALLENGE_STATUSES),
});
