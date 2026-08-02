import { z } from "zod";

/** Reviewer's evaluation comment (+ optional 0–100 score). */
export const evaluationSchema = z.object({
  comments: z.string().trim().min(3, "التعليق مطلوب").max(4000, "التعليق طويل جدًا"),
  score: z
    .union([z.coerce.number().int().min(0, "0–100").max(100, "0–100"), z.literal("").transform(() => undefined)])
    .optional(),
});
export type EvaluationInput = z.infer<typeof evaluationSchema>;

/** Reviewer's request for more information. */
export const infoRequestSchema = z.object({
  requestedInfo: z.string().trim().min(3, "يرجى تحديد المعلومات المطلوبة").max(2000, "النص طويل جدًا"),
});
export type InfoRequestInput = z.infer<typeof infoRequestSchema>;

/** Author's response to a request for more information. */
export const infoResponseSchema = z.object({
  responseText: z.string().trim().min(3, "الرد مطلوب").max(4000, "الرد طويل جدًا"),
});
export type InfoResponseInput = z.infer<typeof infoResponseSchema>;

export const EVALUATION_STAGE_LABELS: Record<string, string> = {
  INITIAL: "مراجعة أولية",
  TECHNICAL: "مراجعة فنية",
  COMMITTEE: "لجنة",
};
