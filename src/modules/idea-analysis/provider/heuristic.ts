import type { IdeaAnalysisInput, IdeaAnalysisOutput, IdeaAnalysisProvider } from "./types";

/** Offline, deterministic pre-screening. It never calls a third party. */
export class HeuristicIdeaAnalysisProvider implements IdeaAnalysisProvider {
  readonly name = "heuristic";
  readonly model = "idea-rules-1.0.0";

  async analyze(input: IdeaAnalysisInput): Promise<IdeaAnalysisOutput> {
    const flags: string[] = [];
    let score = 100;
    const description = input.idea.description?.trim() ?? "";

    if (description.length < 30) {
      score -= 30;
      flags.push("وصف المشكلة يحتاج إلى توضيح أكبر قبل التقييم.");
    }
    if (!input.idea.activityId) {
      score -= 15;
      flags.push("لم تُربط الفكرة بتحدٍ أو نشاط ابتكاري.");
    }
    if (!input.idea.departmentId) {
      score -= 15;
      flags.push("الإدارة المالكة غير محددة.");
    }
    if (input.evidenceCount === 0) {
      score -= 10;
      flags.push("لا يوجد دليل أو مرفق داعم مرتبط بالفكرة حتى الآن.");
    }

    const duplicate = input.comparableIdeas.find((other) => similarity(input.idea.titleAr, other.titleAr) >= 0.72 || similarity(description, other.description ?? "") >= 0.8);
    if (duplicate) {
      score -= 25;
      flags.push(`احتمال تشابه مع الفكرة: «${duplicate.titleAr}». راجع السجل قبل المتابعة.`);
    }
    if (flags.length === 0) flags.push("البيانات الأساسية مكتملة مبدئيًا؛ يبقى التقييم والقرار من مسؤولية المراجع.");

    return { score: Math.max(0, Math.min(100, score)), flags };
  }
}

function words(value: string): Set<string> {
  return new Set(value.toLowerCase().replace(/[^\\p{L}\\p{N}\\s]/gu, " ").split(/\\s+/).filter((word) => word.length >= 3));
}

function similarity(a: string, b: string): number {
  if (!a.trim() || !b.trim()) return 0;
  const left = words(a);
  const right = words(b);
  const union = new Set([...left, ...right]);
  const shared = [...left].filter((word) => right.has(word)).length;
  return union.size ? shared / union.size : 0;
}
