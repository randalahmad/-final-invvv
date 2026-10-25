import { generateText, Output } from "ai";
import { isUxPreviewMode } from "@/lib/ux-preview";
import { IDEA_JUDGING_CRITERIA, ideaEvaluationFixtures } from "@/modules/ux-preview/idea-ranking-data";
import { ideaEvaluationResponseSchema } from "@/modules/ux-preview/idea-ranking-schema";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!isUxPreviewMode()) return Response.json({ error: "Not found" }, { status: 404 });
  try {
    const { ideaId } = await request.json() as { ideaId?: string };
    const idea = ideaEvaluationFixtures.find((item) => item.id === ideaId);
    if (!idea) return Response.json({ error: "الفكرة المحددة غير موجودة." }, { status: 400 });
    const model = process.env.IDEA_RANKING_MODEL || process.env.AI_READINESS_MODEL || "openai/gpt-6-luna";
    const { output } = await generateText({
      model,
      output: Output.object({ name: "InstitutionalIdeaEvaluation", description: "تقييم استشاري لفكرة ابتكارية وفق معايير تحكيم موزونة", schema: ideaEvaluationResponseSchema }),
      system: "أنت مساعد محكّم للابتكار المؤسسي. قيّم الفكرة المحددة فقط وفق المعايير المقدمة. كل درجة معيار من 100، والنتيجة الكلية هي المتوسط الموزون بحسب weight. استند إلى المعلومات المتاحة فقط، واعتبر المعلومة غير المذكورة نقصًا لا افتراضًا. التقييم مساند للموظف ولا يمثل قرار قبول أو رفض نهائيًا. اكتب بالعربية وباختصار.",
      prompt: `معايير التحكيم وأوزانها:\n${JSON.stringify(IDEA_JUDGING_CRITERIA)}\n\nالفكرة المطلوب تقييمها:\n${JSON.stringify(idea)}\n\nأعد تقييمًا لكل معيار بالمفتاح نفسه، ثم نقاط القوة والمخاطر والمعلومات الناقصة والإجراء التالي.`,
    });
    const validKeys = new Set<string>(IDEA_JUDGING_CRITERIA.map((criterion) => criterion.key));
    const byKey = new Map(output.criteria.filter((criterion) => validKeys.has(criterion.key)).map((criterion) => [criterion.key, criterion]));
    if (byKey.size !== IDEA_JUDGING_CRITERIA.length) throw new Error("INCOMPLETE_CRITERIA");
    const criteria = IDEA_JUDGING_CRITERIA.map((criterion) => byKey.get(criterion.key)!);
    const totalScore = Math.round(IDEA_JUDGING_CRITERIA.reduce((sum, criterion) => sum + byKey.get(criterion.key)!.score * criterion.weight, 0) / 100);
    return Response.json({ result: { ...output, ideaId: idea.id, criteria, totalScore }, model });
  } catch (error) {
    console.error("Preview idea evaluation failed", error);
    return Response.json({ error: "تعذر إكمال تقييم الفكرة الآن. يرجى إعادة المحاولة." }, { status: 502 });
  }
}
