/**
 * Preview-only mock "AI initial verification" engine for the Innovator journey.
 *
 * IMPORTANT — this is NOT a real AI integration:
 *  - No network call, no LLM, no external API. Everything below is a pure,
 *    deterministic function of its input (same input -> same output), built
 *    from a simple string hash plus a few readable heuristics, so demo/preview
 *    runs stay stable and explainable.
 *  - The result is always an ADVISORY suggestion for a human evaluator. It
 *    never sets any approval/decision status by itself (see the governance
 *    invariant in docs/handoffs/codex-takeover.md, §C4).
 *
 * Swapping in a real model later should only mean replacing the body of
 * `analyzeIdeaSubmission` — the input/output contract (IdeaAnalysisInput /
 * IdeaAnalysisResult) is intentionally the seam. Nothing outside this file
 * should need to change.
 */

export interface IdeaAnalysisInput {
  title: string;
  description: string;
  category?: string;
  fileName?: string | null;
  fileSize?: number | null;
}

export type CriterionKey = "innovation" | "feasibility" | "impact" | "alignment" | "clarity";

export interface CriterionResult {
  key: CriterionKey;
  label: string;
  weight: number; // percent, sums to 100 across all criteria
  score: number; // 0-100
  comment: string;
}

export type RecommendationBand = "STRONG" | "RECOMMENDED" | "NEEDS_WORK" | "NOT_RECOMMENDED";

export interface IdeaAnalysisResult {
  totalScore: number; // 0-100, weighted
  breakdown: CriterionResult[];
  summary: string;
  recommendation: { band: RecommendationBand; label: string };
  disclaimer: string;
}

const CRITERIA: { key: CriterionKey; label: string; weight: number }[] = [
  { key: "innovation", label: "الابتكار والتميز", weight: 25 },
  { key: "feasibility", label: "الجدوى التقنية والتنفيذية", weight: 20 },
  { key: "impact", label: "الأثر والقيمة المتوقعة", weight: 25 },
  { key: "alignment", label: "التوافق مع الأهداف الاستراتيجية", weight: 15 },
  { key: "clarity", label: "اكتمال ووضوح التوثيق", weight: 15 },
];

const INNOVATION_KEYWORDS = ["ذكاء اصطناعي", "أتمتة", "آلي", "تلقائي", "جديد", "ابتكار", "تجربة"];
const IMPACT_KEYWORDS = ["أثر", "تكلفة", "كفاءة", "توفير", "وقت", "مستفيد", "رضا"];
const ALIGNMENT_KEYWORDS = ["استراتيجي", "تحول رقمي", "جودة", "استدامة", "كفاءة تشغيلية", "تجربة المستفيد"];

function hashString(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = (Math.imul(h, 31) + input.charCodeAt(i)) >>> 0;
  }
  return h;
}

/** Deterministic pseudo-score in [min, max] derived from a seed string. */
function seededScore(seed: string, min: number, max: number): number {
  const h = hashString(seed);
  return min + (h % (max - min + 1));
}

function keywordBonus(text: string, keywords: string[], perHit = 4, cap = 12): number {
  const hits = keywords.filter((word) => text.includes(word)).length;
  return Math.min(cap, hits * perHit);
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function commentFor(key: CriterionKey, score: number): string {
  const band = score >= 85 ? "high" : score >= 65 ? "mid" : "low";
  const comments: Record<CriterionKey, Record<"high" | "mid" | "low", string>> = {
    innovation: {
      high: "فكرة متميزة تقدم زاوية جديدة واضحة مقارنة بالحلول الحالية.",
      mid: "عنصر التجديد موجود لكنه يحتاج إبراز ما يميزها عن حلول مشابهة.",
      low: "الفكرة قريبة من ممارسات معروفة؛ يُنصح بتوضيح الجانب الابتكاري فيها.",
    },
    feasibility: {
      high: "المتطلبات التقنية والتشغيلية واضحة ويبدو التنفيذ واقعيًا في مدى معقول.",
      mid: "التنفيذ ممكن لكن يحتاج تفاصيل أكثر عن الموارد والمدة الزمنية.",
      low: "الجدوى التقنية غير واضحة بعد؛ يُنصح بإرفاق خطة تنفيذ أو تقدير موارد.",
    },
    impact: {
      high: "الأثر المتوقع محدد وقابل للقياس (تكلفة/وقت/رضا مستفيد).",
      mid: "هناك إشارة للأثر لكنها تحتاج أرقامًا أو مؤشرات تقدير أوضح.",
      low: "الأثر المتوقع غير محدد؛ يُنصح بإضافة تقدير كمي أو نوعي للفائدة.",
    },
    alignment: {
      high: "متوافقة بوضوح مع أولويات التحول الرقمي وتحسين تجربة المستفيد.",
      mid: "التوافق مع التوجه الاستراتيجي محتمل لكنه غير مذكور صراحة.",
      low: "يُنصح بربط الفكرة صراحة بأحد المحاور الاستراتيجية المعتمدة.",
    },
    clarity: {
      high: "الوصف مكتمل وواضح، والمرفقات تدعم فهم الفكرة بسهولة.",
      mid: "الوصف مقبول لكنه مختصر؛ تفاصيل إضافية ومرفقات ستحسّن التقييم.",
      low: "الوصف قصير جدًا أو بلا مرفقات؛ يُنصح بالتوسع قبل الإحالة للمراجعة.",
    },
  };
  return comments[key][band];
}

/**
 * Deterministic, explainable "initial AI check". Manual trigger only — the
 * caller (a button in the UI) decides when this runs; it never runs on
 * submit or on a timer.
 */
export function analyzeIdeaSubmission(input: IdeaAnalysisInput): IdeaAnalysisResult {
  const title = input.title?.trim() ?? "";
  const description = input.description?.trim() ?? "";
  const category = input.category?.trim() ?? "";
  const hasFile = Boolean(input.fileName);
  const text = `${title} ${description} ${category}`;
  const seedBase = `${title}|${description}|${category}|${input.fileName ?? ""}`;

  const clarityLengthBonus = Math.min(20, Math.floor(description.length / 20));
  const fileBonus = hasFile ? 8 : 0;

  const raw: Record<CriterionKey, number> = {
    innovation: seededScore(`innovation:${seedBase}`, 55, 90) + keywordBonus(text, INNOVATION_KEYWORDS),
    feasibility: seededScore(`feasibility:${seedBase}`, 55, 88) + (hasFile ? 5 : 0),
    impact: seededScore(`impact:${seedBase}`, 55, 90) + keywordBonus(text, IMPACT_KEYWORDS),
    alignment: seededScore(`alignment:${seedBase}`, 55, 88) + keywordBonus(text, ALIGNMENT_KEYWORDS),
    clarity: seededScore(`clarity:${seedBase}`, 50, 80) + clarityLengthBonus + fileBonus,
  };

  const breakdown: CriterionResult[] = CRITERIA.map(({ key, label, weight }) => {
    const score = clamp(Math.round(raw[key]));
    return { key, label, weight, score, comment: commentFor(key, score) };
  });

  const totalScore = clamp(
    Math.round(breakdown.reduce((sum, item) => sum + (item.score * item.weight) / 100, 0)),
  );

  const strongest = [...breakdown].sort((a, b) => b.score - a.score)[0];
  const weakest = [...breakdown].sort((a, b) => a.score - b.score)[0];
  const summary =
    `أقوى عنصر في الفكرة حاليًا هو "${strongest.label}" (${strongest.score}/100). ` +
    `أما "${weakest.label}" (${weakest.score}/100) فهو الجانب الذي يحتاج أكبر تحسين قبل الإحالة للمراجعة الفنية. ` +
    (hasFile
      ? "المرفق المرسل يدعم فهم الفكرة، ويُفضّل أن يتضمن أرقامًا أو مؤشرات أثر محددة."
      : "لا يوجد مرفق حتى الآن؛ إرفاق وثيقة أو مخطط أولي سيحسّن دقة أي تقييم لاحق.");

  const recommendation: { band: RecommendationBand; label: string } =
    totalScore >= 85
      ? { band: "STRONG", label: "موصى به بشدة" }
      : totalScore >= 70
        ? { band: "RECOMMENDED", label: "موصى به" }
        : totalScore >= 50
          ? { band: "NEEDS_WORK", label: "يحتاج تحسين" }
          : { band: "NOT_RECOMMENDED", label: "غير موصى به حاليًا" };

  return {
    totalScore,
    breakdown,
    summary,
    recommendation,
    disclaimer:
      "اقتراح أولي من الذكاء الاصطناعي للمعاينة فقط — لا يغني عن التقييم البشري، والقرار النهائي بيد المُقيّم دائمًا.",
  };
}

export function levelFromScore(score: number): "NOVICE" | "AMATEUR" | "MASTER" {
  if (score >= 80) return "MASTER";
  if (score >= 50) return "AMATEUR";
  return "NOVICE";
}
