"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, BrainCircuit, CheckCircle2, LoaderCircle, Scale, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { IDEA_JUDGING_CRITERIA, ideaEvaluationFixtures } from "./idea-ranking-data";
import type { IdeaEvaluationResult } from "./idea-ranking-schema";

export function IdeaRankingCenter() {
  const [selectedId, setSelectedId] = useState<string>(ideaEvaluationFixtures[0].id);
  const [result, setResult] = useState<IdeaEvaluationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const selectedIdea = useMemo(() => ideaEvaluationFixtures.find((idea) => idea.id === selectedId)!, [selectedId]);
  const resultByKey = useMemo(() => new Map(result?.criteria.map((criterion) => [criterion.key, criterion]) ?? []), [result]);

  async function evaluateIdea() {
    setLoading(true); setError(""); setResult(null);
    try {
      const response = await fetch("/api/ux-preview/idea-ranking", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ideaId: selectedId }) });
      const contentType = response.headers.get("content-type") ?? "";
      const payload = contentType.includes("application/json") ? await response.json() as { result?: IdeaEvaluationResult; error?: string } : { error: "تعذر قراءة استجابة خدمة التقييم." };
      if (!response.ok || !payload.result) throw new Error(payload.error || "تعذر تشغيل التقييم الذكي.");
      setResult(payload.result);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر تشغيل التقييم الذكي."); }
    finally { setLoading(false); }
  }

  function selectIdea(id: string) { setSelectedId(id); setResult(null); setError(""); }

  return <div className="space-y-5" dir="rtl">
    <PageHeader title="تقييم الأفكار بالذكاء الاصطناعي" description="يختار الموظف فكرة، ثم يحصل على تقييم استشاري منظم وفق معايير تحكيم موزونة قبل المراجعة البشرية."/>
    <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
      <aside className="space-y-3"><p className="text-sm font-bold">الأفكار بانتظار التقييم</p>{ideaEvaluationFixtures.map((idea) => <button key={idea.id} type="button" onClick={() => selectIdea(idea.id)} className={`w-full rounded-xl border p-4 text-right transition ${selectedId === idea.id ? "border-primary bg-primary-50 ring-1 ring-primary/10" : "border-border bg-white hover:border-primary/40"}`}><span className="block text-sm font-bold">{idea.title}</span><span className="mt-1 block text-xs text-muted">{idea.department}</span><Badge className="mt-2" variant={idea.status === "جاهزة للمراجعة" ? "success" : "warning"}>{idea.status}</Badge></button>)}</aside>
      <div className="space-y-5">
        <Card><CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle>{selectedIdea.title}</CardTitle><p className="mt-1 text-xs text-muted">{selectedIdea.department}</p></div><Button onClick={evaluateIdea} disabled={loading}>{loading ? <><LoaderCircle className="h-4 w-4 animate-spin"/>جارٍ تقييم الفكرة…</> : <><Sparkles className="h-4 w-4"/>تقييم الفكرة بالذكاء الاصطناعي</>}</Button></div></CardHeader><CardContent className="grid gap-3 text-sm sm:grid-cols-2"><Info label="وصف الفكرة" value={selectedIdea.description}/><Info label="المستفيدون" value={selectedIdea.beneficiaries}/><Info label="الأثر المتوقع" value={selectedIdea.expectedImpact}/><Info label="الجاهزية الحالية" value={selectedIdea.readiness}/></CardContent></Card>
        <Card><CardHeader><CardTitle>معايير التحكيم المستخدمة</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2">{IDEA_JUDGING_CRITERIA.map((criterion) => { const score = resultByKey.get(criterion.key); return <div key={criterion.key} className="rounded-xl border border-border p-4"><div className="flex items-center justify-between gap-2"><b className="text-sm">{criterion.label}</b><Badge variant="primary">الوزن {criterion.weight}%</Badge></div><p className="mt-2 text-xs leading-6 text-muted">{criterion.description}</p>{score ? <><div className="mt-3 flex items-end justify-between"><span className="text-xs text-muted">درجة المعيار</span><b className="text-xl text-primary">{score.score}/100</b></div><Progress className="mt-2" value={score.score}/><p className="mt-2 text-xs leading-6">{score.rationale}</p></> : null}</div>; })}</CardContent></Card>
        {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-danger">{error}</div> : null}
        {result ? <><Card className="border-primary/20"><CardContent className="grid gap-5 p-5 md:grid-cols-[180px_1fr]"><div className="rounded-2xl bg-primary-50 p-5 text-center"><p className="text-xs text-muted">النتيجة الموزونة</p><p className="mt-2 text-5xl font-black text-primary">{result.totalScore}</p><Badge className="mt-3" variant={result.totalScore >= 75 ? "success" : "warning"}>{result.recommendation}</Badge></div><div><h3 className="font-bold">ملخص التقييم</h3><p className="mt-2 text-sm leading-7">{result.executiveSummary}</p><p className="mt-4 flex items-center gap-2 text-sm font-bold text-primary"><CheckCircle2 className="h-5 w-5"/>الإجراء التالي: {result.nextAction}</p></div></CardContent></Card><div className="grid gap-4 md:grid-cols-3"><ListCard title="نقاط القوة" items={result.strengths} icon={<CheckCircle2 className="h-5 w-5 text-success"/>}/><ListCard title="المخاطر" items={result.risks} icon={<AlertTriangle className="h-5 w-5 text-warning"/>}/><ListCard title="معلومات ناقصة" items={result.missingInformation} icon={<BrainCircuit className="h-5 w-5 text-primary"/>}/></div><p className="text-center text-xs text-muted">التقييم توصية مساندة للموظف ولا يمثل قرار قبول أو رفض. القرار النهائي للمراجعين واللجنة المخولة.</p></> : <Card className="border-dashed"><CardContent className="flex flex-col items-center py-10 text-center"><Scale className="h-9 w-9 text-primary"/><p className="mt-3 font-bold">اختر فكرة وشغّل التقييم</p><p className="mt-1 text-sm text-muted">ستظهر درجة كل معيار والمبررات والنواقص والتوصية للموظف.</p></CardContent></Card>}
      </div>
    </div>
  </div>;
}

function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold text-muted">{label}</p><p className="mt-1.5 leading-7">{value}</p></div>; }
function ListCard({ title, items, icon }: { title: string; items: string[]; icon: React.ReactNode }) { return <Card><CardHeader><CardTitle className="flex items-center gap-2 text-sm">{icon}{title}</CardTitle></CardHeader><CardContent className="space-y-2">{items.length ? items.map((item) => <p key={item} className="rounded-lg bg-slate-50 p-2.5 text-xs leading-5">{item}</p>) : <p className="text-xs text-muted">لا توجد عناصر.</p>}</CardContent></Card>; }
