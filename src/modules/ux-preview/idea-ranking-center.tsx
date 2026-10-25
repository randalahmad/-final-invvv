"use client";

import { useMemo, useState } from "react";
import { BrainCircuit, CheckCircle2, LoaderCircle, RefreshCw, Scale, Sparkles, Trophy } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { IDEA_JUDGING_CRITERIA, ideaRankingFixtures } from "./idea-ranking-data";
import type { IdeaRankingResult } from "./idea-ranking-schema";

type Limit = 5 | 10 | 20;

export function IdeaRankingCenter() {
  const [limit, setLimit] = useState<Limit>(10);
  const [result, setResult] = useState<IdeaRankingResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const ideasById = useMemo(() => new Map<string, (typeof ideaRankingFixtures)[number]>(ideaRankingFixtures.map((idea) => [idea.id, idea])), []);

  async function runRanking() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/ux-preview/idea-ranking", { method: "POST" });
      const contentType = response.headers.get("content-type") ?? "";
      const payload = contentType.includes("application/json") ? await response.json() as { result?: IdeaRankingResult; error?: string } : { error: "تعذر قراءة استجابة خدمة التقييم." };
      if (!response.ok || !payload.result) throw new Error(payload.error || "تعذر تشغيل التقييم الذكي.");
      setResult(payload.result);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر تشغيل التقييم الذكي."); }
    finally { setLoading(false); }
  }

  const visible = result?.results.slice(0, limit) ?? [];
  return <div className="space-y-5" dir="rtl">
    <PageHeader title="تقييم وترتيب الأفكار بالذكاء الاصطناعي" description="مساحة مساندة للموظف لفرز الأفكار وفق معايير موحدة، ثم مراجعة أفضل 20 أو 10 أو 5 أفكار قبل قرار اللجنة." action={<Button onClick={runRanking} disabled={loading}>{loading ? <><LoaderCircle className="h-4 w-4 animate-spin"/>جارٍ تقييم 20 فكرة…</> : result ? <><RefreshCw className="h-4 w-4"/>إعادة التقييم</> : <><Sparkles className="h-4 w-4"/>تشغيل التقييم الذكي</>}</Button>}/>
    <div className="grid gap-4 md:grid-cols-3"><Metric icon={<BrainCircuit className="h-8 w-8 text-primary"/>} label="أفكار جاهزة للفرز" value="20"/><Metric icon={<Scale className="h-8 w-8 text-secondary"/>} label="معايير موزونة" value="6"/><Metric icon={<Trophy className="h-8 w-8 text-amber-500"/>} label="القائمة المعروضة" value={`Top ${limit}`}/></div>
    <Card><CardHeader><CardTitle>معايير التحكيم</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{IDEA_JUDGING_CRITERIA.map((criterion) => <div key={criterion.key} className="rounded-xl border border-border bg-slate-50/70 p-4"><div className="flex items-center justify-between gap-2"><b className="text-sm">{criterion.label}</b><Badge variant="primary">{criterion.weight}%</Badge></div><p className="mt-2 text-xs leading-6 text-muted">{criterion.description}</p></div>)}</CardContent></Card>
    {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-danger">{error}</div> : null}
    {!result ? <Card className="border-dashed"><CardContent className="flex flex-col items-center py-14 text-center"><BrainCircuit className="h-10 w-10 text-primary"/><h2 className="mt-3 text-lg font-bold">القائمة جاهزة للتقييم</h2><p className="mt-2 max-w-xl text-sm leading-7 text-muted">اضغط «تشغيل التقييم الذكي». سيحلل الذكاء الاصطناعي الأفكار العشرين ويعرض الترتيب والدرجات والمبررات والإجراء المقترح للموظف.</p></CardContent></Card> : <>
      <Card><CardContent className="p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-bold">نتائج الفرز الذكي</p><p className="mt-1 text-xs text-muted">{result.executiveSummary}</p></div><div className="flex rounded-xl bg-slate-100 p-1">{([20,10,5] as Limit[]).map((value) => <button key={value} type="button" onClick={() => setLimit(value)} className={`rounded-lg px-4 py-2 text-xs font-bold transition ${limit === value ? "bg-white text-primary shadow-sm" : "text-muted"}`}>Top {value}</button>)}</div></div></CardContent></Card>
      <div className="space-y-3">{visible.map((item, index) => { const idea = ideasById.get(item.ideaId); if (!idea) return null; return <Card key={item.ideaId} className={index < 5 ? "border-primary/20" : ""}><CardContent className="p-5"><div className="grid gap-4 lg:grid-cols-[auto_1fr_160px]"><div className={`grid h-11 w-11 place-items-center rounded-xl text-lg font-black ${index < 5 ? "bg-primary text-white" : "bg-slate-100 text-slate-600"}`}>{index + 1}</div><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold">{idea.title}</h3><Badge variant={item.total >= 80 ? "success" : item.total >= 65 ? "primary" : "warning"}>{item.recommendation}</Badge></div><p className="mt-1 text-xs text-muted">{idea.department} · {idea.status}</p><p className="mt-3 text-sm leading-7">{item.rationale}</p><p className="mt-2 flex items-center gap-2 text-xs font-semibold text-primary"><CheckCircle2 className="h-4 w-4"/>الإجراء المقترح: {item.nextAction}</p></div><div><div className="flex items-end justify-between"><span className="text-xs text-muted">النتيجة</span><b className="text-3xl text-primary">{item.total}</b></div><Progress className="mt-2" value={item.total}/><div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-muted"><span>استراتيجي {item.strategicAlignment}/25</span><span>القيمة {item.problemValue}/20</span><span>التنفيذ {item.feasibility}/20</span><span>الابتكار {item.innovation}/15</span><span>الأثر {item.impact}/15</span><span>الجاهزية {item.readiness}/5</span></div></div></div></CardContent></Card>; })}</div>
      <p className="text-center text-xs leading-6 text-muted">الترتيب توصية مساندة للموظف ولا يمثل قرار اعتماد. يعتمد القرار النهائي على مراجعة اللجنة والمعلومات الموثقة.</p>
    </>}
  </div>;
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <Card><CardContent className="flex items-center gap-3 p-5">{icon}<div><p className="text-xs text-muted">{label}</p><p className="mt-1 text-2xl font-black">{value}</p></div></CardContent></Card>; }
