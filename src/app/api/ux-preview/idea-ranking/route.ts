import { generateText, Output } from "ai";
import { isUxPreviewMode } from "@/lib/ux-preview";
import { IDEA_JUDGING_CRITERIA, ideaRankingFixtures } from "@/modules/ux-preview/idea-ranking-data";
import { ideaRankingResponseSchema } from "@/modules/ux-preview/idea-ranking-schema";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST() {
  if (!isUxPreviewMode()) return Response.json({ error: "Not found" }, { status: 404 });
  try {
    const model = process.env.IDEA_RANKING_MODEL || process.env.AI_READINESS_MODEL || "openai/gpt-6-luna";
    const { output } = await generateText({
      model,
      output: Output.object({ name: "InstitutionalIdeaRanking", description: "ترتيب استشاري لأفكار الابتكار وفق معايير تحكيم موزونة", schema: ideaRankingResponseSchema }),
      system: "أنت مساعد لجنة فرز أفكار ابتكارية. قيّم كل فكرة باستقلال وفق المعايير والأوزان المقدمة، ثم رتّب النتائج تنازليًا. التقييم استشاري للموظف ولا يمثل قبولًا أو رفضًا نهائيًا. لا تضف أفكارًا أو معايير غير موجودة. اجعل total مساويًا تمامًا لمجموع درجات المعايير، واكتب المبررات والإجراء التالي بالعربية وباختصار.",
      prompt: `معايير التحكيم:\n${JSON.stringify(IDEA_JUDGING_CRITERIA)}\n\nالأفكار المطلوب تقييمها:\n${JSON.stringify(ideaRankingFixtures)}\n\nأعد نتيجة لكل فكرة من الأفكار العشرين، مرتبة من الأعلى إلى الأقل. استخدم تاريخ التقييم ${new Date().toISOString()}.`,
    });
    const byId = new Map<string, (typeof ideaRankingFixtures)[number]>(ideaRankingFixtures.map((idea) => [idea.id, idea]));
    const unique = new Map(output.results.filter((item) => byId.has(item.ideaId)).map((item) => [item.ideaId, item]));
    if (unique.size !== ideaRankingFixtures.length) throw new Error("INCOMPLETE_RANKING");
    const results = Array.from(unique.values()).map((item) => ({ ...item, total: item.strategicAlignment + item.problemValue + item.feasibility + item.innovation + item.impact + item.readiness })).sort((a, b) => b.total - a.total);
    return Response.json({ result: { ...output, results }, model });
  } catch (error) {
    console.error("Preview idea ranking failed", error);
    return Response.json({ error: "تعذر إكمال الترتيب الذكي الآن. يرجى إعادة المحاولة." }, { status: 502 });
  }
}
