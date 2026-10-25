import { z } from "zod";

export const ideaCriterionScoreSchema = z.object({ key: z.string(), score: z.number().int().min(0).max(100), rationale: z.string().min(1) });
export const ideaEvaluationResponseSchema = z.object({
  ideaId: z.string(), totalScore: z.number().int().min(0).max(100),
  recommendation: z.enum(["موصى بالانتقال للمراجعة", "يحتاج استكمال قبل المراجعة", "يحتاج إعادة صياغة"]),
  executiveSummary: z.string().min(1), criteria: z.array(ideaCriterionScoreSchema).min(1),
  strengths: z.array(z.string()).max(4), risks: z.array(z.string()).max(4), missingInformation: z.array(z.string()).max(5), nextAction: z.string().min(1),
});
export type IdeaEvaluationResult = z.infer<typeof ideaEvaluationResponseSchema>;
