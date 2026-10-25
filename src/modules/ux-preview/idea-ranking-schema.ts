import { z } from "zod";

export const ideaRankingItemSchema = z.object({
  ideaId: z.string(), strategicAlignment: z.number().int().min(0).max(25), problemValue: z.number().int().min(0).max(20),
  feasibility: z.number().int().min(0).max(20), innovation: z.number().int().min(0).max(15), impact: z.number().int().min(0).max(15),
  readiness: z.number().int().min(0).max(5), total: z.number().int().min(0).max(100),
  recommendation: z.enum(["مرشحة للأولوية", "تستحق الدراسة", "تحتاج استكمال"]), rationale: z.string().min(1), nextAction: z.string().min(1),
});
export const ideaRankingResponseSchema = z.object({ executiveSummary: z.string().min(1), evaluatedAt: z.string().min(1), results: z.array(ideaRankingItemSchema).min(1) });
export type IdeaRankingResult = z.infer<typeof ideaRankingResponseSchema>;
