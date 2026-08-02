import { z } from "zod";

/** Optional rationale attached to a final decision. */
export const decisionSchema = z.object({
  notes: z.string().trim().max(2000, "الملاحظات طويلة جدًا").optional().or(z.literal("")),
});
export type DecisionInput = z.infer<typeof decisionSchema>;

/** Reopening a finalized decision REQUIRES a documented reason. */
export const reasonSchema = z.object({
  reason: z.string().trim().min(5, "سبب إعادة الفتح مطلوب (5 أحرف على الأقل)").max(2000, "السبب طويل جدًا"),
});
export type ReasonInput = z.infer<typeof reasonSchema>;

/** Superseding a finalized decision REQUIRES a new decision + a reason. */
export const supersedeSchema = z.object({
  decision: z.enum(["APPROVE_FOR_PILOT", "REJECT"], {
    errorMap: () => ({ message: "يجب اختيار قرار صالح" }),
  }),
  reason: z.string().trim().min(5, "سبب التصحيح مطلوب (5 أحرف على الأقل)").max(2000, "السبب طويل جدًا"),
});
export type SupersedeInput = z.infer<typeof supersedeSchema>;

export const DECISION_LABELS: Record<string, string> = {
  APPROVE_FOR_PILOT: "اعتماد للتجريب",
  REJECT: "رفض",
  REQUEST_MORE_INFO: "طلب معلومات",
  CONVERT_TO_SOLUTION: "تحويل إلى حل",
  DEFER: "تأجيل",
};
