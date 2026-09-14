"use client";

/**
 * Dark/pink "journey" showcase UI for the Innovator persona (Preview only).
 * Deliberately self-contained (no dependency on the light-theme Card/Badge
 * primitives) so it can reproduce a specific reference visual style without
 * touching the app's global light theme used everywhere else.
 */

import { Award, CheckCircle2, Loader2, Sparkles } from "lucide-react";

import type { CriterionResult, IdeaAnalysisResult, RecommendationBand } from "./mock-engine";
import { levelFromScore } from "./mock-engine";

const recommendationTone: Record<RecommendationBand, string> = {
  STRONG: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30",
  RECOMMENDED: "bg-accent/15 text-accent-400 ring-1 ring-accent/30",
  NEEDS_WORK: "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30",
  NOT_RECOMMENDED: "bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30",
};

/** Circular progress ring with a value label in the middle. */
export function ScoreRing({ value, size = 128, label }: { value: number; size?: number; label?: string }) {
  const stroke = Math.round(size * 0.09);
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.max(0, Math.min(100, value)) / 100);
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="#1F2A44" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#EC1F52"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-extrabold text-white">{value}</span>
        {label ? <span className="text-[10px] text-slate-400">{label}</span> : null}
      </div>
    </div>
  );
}

/** Level gauge: a ring with Master/Amateur/Novice bands and a marker dot. */
export function LevelGauge({ score }: { score: number }) {
  const level = levelFromScore(score);
  const positions: Record<typeof level, string> = {
    MASTER: "12%",
    AMATEUR: "48%",
    NOVICE: "84%",
  } as const;
  return (
    <div className="flex items-center gap-6">
      <div className="relative flex h-40 w-40 items-center justify-center rounded-full border-4 border-white/10">
        <div className="absolute inset-3 rounded-full border border-dashed border-white/10" />
        <span
          className="absolute right-1/2 h-3 w-3 translate-x-1/2 rounded-full bg-accent shadow-[0_0_0_4px_rgba(236,31,82,0.25)] transition-all"
          style={{ top: positions[level] }}
        />
        <Award className="h-8 w-8 text-accent" />
      </div>
      <div className="space-y-3 text-sm">
        {(["MASTER", "AMATEUR", "NOVICE"] as const).map((key) => (
          <div key={key} className={`font-semibold ${level === key ? "text-white" : "text-slate-500"}`}>
            {key === "MASTER" ? "Master" : key === "AMATEUR" ? "Amateur" : "Novice"}
          </div>
        ))}
      </div>
    </div>
  );
}

const STAGE_LABELS = [
  "استلام الفكرة",
  "التحقق الأولي",
  "مراجعة فريق الابتكار",
  "استكمال المعلومات",
  "تقييم الجهة المختصة",
  "القرار",
  "التجربة والمتابعة",
  "الإدراج في المحفظة",
];

/** Connected-node journey map (dark theme), mirrors a Stage-Gate 0-7 idea. */
export function JourneyMap({ currentGate }: { currentGate: number }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-6">
      {STAGE_LABELS.map((label, index) => {
        const complete = index < currentGate;
        const current = index === currentGate;
        return (
          <div key={label} className="flex items-center">
            <div className="flex flex-col items-center gap-2" style={{ width: 96 }}>
              <div
                className={`flex h-14 w-14 items-center justify-center rounded-full border-2 text-sm font-bold transition-colors ${
                  complete
                    ? "border-accent bg-accent text-white"
                    : current
                      ? "border-accent bg-transparent text-accent ring-4 ring-accent/20"
                      : "border-white/10 bg-white/5 text-slate-500"
                }`}
              >
                {complete ? <CheckCircle2 className="h-6 w-6" /> : index}
              </div>
              <span className={`text-center text-[11px] leading-tight ${current ? "text-white" : "text-slate-500"}`}>
                {label}
              </span>
            </div>
            {index < STAGE_LABELS.length - 1 ? (
              <div className={`h-0.5 w-6 shrink-0 sm:w-10 ${complete ? "bg-accent" : "bg-white/10"}`} />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/** Small "progress" card: percentage ring + a completed-count line, à la screenshot's "My score". */
export function ProgressSummaryCard({ percent, completed, total }: { percent: number; completed: number; total: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <ScoreRing value={percent} size={104} label="My score" />
      <p className="mt-4 text-sm text-slate-300">
        المعايير المكتملة <span className="font-bold text-white">{completed}</span>/{total}
      </p>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-accent" style={{ width: `${(completed / total) * 100}%` }} />
      </div>
    </div>
  );
}

export function AiCheckLoading() {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-slate-300">
      <Loader2 className="h-5 w-5 animate-spin text-accent" />
      يجري التحقق الأولي بالذكاء الاصطناعي... (معاينة، بدون أي استدعاء API حقيقي)
    </div>
  );
}

function CriterionRow({ item }: { item: CriterionResult }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-slate-200">
          {item.label} <span className="text-slate-500">(وزن {item.weight}%)</span>
        </span>
        <span className="font-bold text-white">{item.score}/100</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-accent" style={{ width: `${item.score}%` }} />
      </div>
      <p className="text-xs text-slate-400">{item.comment}</p>
    </div>
  );
}

export function AiAnalysisCard({ result }: { result: IdeaAnalysisResult }) {
  return (
    <div className="space-y-5 rounded-2xl border border-accent/30 bg-[#12141C] p-6 text-slate-200 shadow-[0_12px_32px_-12px_rgba(236,31,82,0.35)]">
      <div className="flex items-center gap-2 text-accent-400">
        <Sparkles className="h-5 w-5" />
        <h3 className="text-base font-bold text-white">نتيجة التحقق الأولي — اقتراح AI (معاينة)</h3>
      </div>

      <p className="rounded-xl bg-accent/10 p-3 text-xs font-semibold text-accent-100/90 ring-1 ring-accent/20">
        {result.disclaimer}
      </p>

      <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
        <ScoreRing value={result.totalScore} label="من 100" />
        <div className="space-y-2">
          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${recommendationTone[result.recommendation.band]}`}>
            {result.recommendation.label}
          </span>
          <p className="max-w-xl text-sm text-slate-300">{result.summary}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {result.breakdown.map((item) => (
          <CriterionRow key={item.key} item={item} />
        ))}
      </div>
    </div>
  );
}
