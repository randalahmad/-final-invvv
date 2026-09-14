"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { ArrowLeft, CheckCircle2, FileText, Lightbulb, Plus, Sparkles, Upload } from "lucide-react";

import { PreviewLink as Link } from "@/components/layout/preview-link";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AiAnalysisCard, AiCheckLoading, JourneyMap, LevelGauge, ProgressSummaryCard } from "@/modules/idea-analysis/components";
import { analyzeIdeaSubmission, type IdeaAnalysisResult } from "@/modules/idea-analysis/mock-engine";
import { DEMO_IDEAS, DEMO_IDEA_EVALUATIONS } from "@/server/demo-data";

function scoreForIdea(idea: (typeof DEMO_IDEAS)[number]): number {
  const evaluation = DEMO_IDEA_EVALUATIONS.find((item) => item.ideaId === idea.id);
  if (evaluation) return evaluation.score;
  return analyzeIdeaSubmission({ title: idea.titleAr, description: idea.description, category: idea.category, fileName: idea.attachments[0] ?? null }).totalScore;
}

const fieldClass = "mt-1.5 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm";

function statusLabel(status: string) {
  return status === "INITIAL_REVIEW" ? "قيد المراجعة الأولية" : status === "MORE_INFO_REQUESTED" ? "يحتاج استكمال" : status === "CONVERTED_TO_SOLUTION" ? "مقبولة ومدرجة في المحفظة" : "قيد المتابعة";
}

function statusVariant(status: string) {
  return status === "CONVERTED_TO_SOLUTION" ? "success" : status === "MORE_INFO_REQUESTED" ? "warning" : "primary";
}

export function InnovatorIdeasPreview() {
  return <div className="space-y-5">
    <PageHeader title="أفكاري" description="تابع أفكارك المقدمة، والملاحظات، والإجراء المطلوب منك في كل مرحلة." action={<Button asChild><Link href="/solutions/new-idea"><Plus className="h-4 w-4" />تقديم فكرة جديدة</Link></Button>} />
    <div className="grid gap-4 lg:grid-cols-3">{DEMO_IDEAS.map((idea) => <Card key={idea.id} className="flex flex-col"><CardHeader><div className="flex items-start justify-between gap-3"><CardTitle className="text-base">{idea.titleAr}</CardTitle><Badge variant={statusVariant(idea.status)}>{statusLabel(idea.status)}</Badge></div></CardHeader><CardContent className="flex flex-1 flex-col gap-4 text-sm"><p className="text-muted">{idea.description}</p><div className="grid grid-cols-2 gap-2 text-xs"><div className="rounded-lg bg-slate-50 p-2"><p className="text-muted">التصنيف</p><p className="mt-1 font-semibold">{idea.category}</p></div><div className="rounded-lg bg-slate-50 p-2"><p className="text-muted">المرحلة الحالية</p><p className="mt-1 font-semibold">Stage {idea.gate} من 7</p></div></div><p className="text-xs text-muted">{idea.attachments.length} مرفقات تجريبية</p><Button asChild className="mt-auto" size="sm" variant="outline"><Link href={`/solutions/my-ideas/${idea.id}`}>تتبع الفكرة <ArrowLeft className="h-4 w-4" /></Link></Button></CardContent></Card>)}</div>
  </div>;
}

export function NewIdeaPreview() {
  const [submitted, setSubmitted] = useState(false);
  const [title, setTitle] = useState("مساعد رقمي لتوجيه المستفيد");
  const [category, setCategory] = useState("تحسين تجربة المستفيد");
  const [description, setDescription] = useState("اقتراح لمسار موحد يساعد المستفيد على الوصول للخدمة المناسبة.");
  const [file, setFile] = useState<{ name: string; size: number } | null>(null);
  const [aiState, setAiState] = useState<"idle" | "loading" | "done">("idle");
  const [aiResult, setAiResult] = useState<IdeaAnalysisResult | null>(null);

  const submit = (event: FormEvent) => { event.preventDefault(); setSubmitted(true); };

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0];
    setFile(picked ? { name: picked.name, size: picked.size } : null);
  };

  const runAiCheck = () => {
    setAiState("loading");
    setAiResult(null);
    // Simulated latency only — no network call, no external API.
    window.setTimeout(() => {
      setAiResult(analyzeIdeaSubmission({ title, description, category, fileName: file?.name ?? null, fileSize: file?.size ?? null }));
      setAiState("done");
    }, 1400);
  };

  if (submitted) return <div className="mx-auto max-w-2xl space-y-5"><Card className="border-emerald-200"><CardContent className="space-y-4 p-8 text-center"><CheckCircle2 className="mx-auto h-11 w-11 text-emerald-600"/><h1 className="text-xl font-bold">تم إرسال الفكرة للمعاينة</h1><p className="text-sm text-muted">هذه عملية واجهة فقط؛ لا يتم إنشاء سجل أو رفع ملف على الخادم.</p><Button asChild><Link href="/solutions/my-ideas">العودة إلى أفكاري</Link></Button></CardContent></Card></div>;

  return <div className="mx-auto max-w-3xl space-y-5"><PageHeader title="تقديم فكرة جديدة" description="قدّم وصفًا مختصرًا وواضحًا للفكرة. الحفظ والإرفاق في هذه النسخة تجريبيان فقط." />
    <form onSubmit={submit} className="space-y-5">
      <Card><CardContent className="grid gap-5 p-6 md:grid-cols-2">
        <Field label="عنوان الفكرة"><Input required value={title} onChange={(event) => setTitle(event.target.value)} /></Field>
        <Field label="التصنيف"><select className={fieldClass} value={category} onChange={(event) => setCategory(event.target.value)}><option>تحسين تجربة المستفيد</option><option>خدمات رقمية</option><option>كفاءة تشغيلية</option><option>استدامة</option></select></Field>
        <Field label="وصف الفكرة" wide><textarea required className={fieldClass} rows={5} value={description} onChange={(event) => setDescription(event.target.value)} /></Field>
        <Field label="المشكلة التي تعالجها" wide><textarea className={fieldClass} rows={4} defaultValue="تعدد القنوات وصعوبة معرفة مسار الطلب المناسب." /></Field>
        <Field label="المرفق (ملف المشروع)" wide>
          <div className="mt-1.5 rounded-xl border border-dashed p-4 text-center">
            <Upload className="mx-auto h-5 w-5 text-primary" />
            <p className="mt-1 text-xs text-muted">{file ? `${file.name} · ${(file.size / 1024).toFixed(0)} كيلوبايت` : "اختر ملفًا (PDF, DOCX, PPTX) — لا يُرفع لأي خادم، للمعاينة فقط."}</p>
            <input aria-label="إرفاق ملف المشروع" className="mt-2 text-xs" type="file" accept=".pdf,.doc,.docx,.ppt,.pptx" onChange={onFileChange} />
          </div>
        </Field>
        <div className="flex items-end md:col-span-2">
          <Button type="button" variant="outline" onClick={runAiCheck} disabled={aiState === "loading"}>
            <Sparkles className="h-4 w-4" />
            {aiState === "loading" ? "جارٍ التحقق..." : "تحقق أولي بالذكاء الاصطناعي"}
          </Button>
        </div>
      </CardContent></Card>

      {aiState === "loading" ? <AiCheckLoading /> : null}
      {aiState === "done" && aiResult ? <AiAnalysisCard result={aiResult} /> : null}

      <div className="flex gap-2"><Button type="submit"><Lightbulb className="h-4 w-4"/>إرسال الفكرة للمراجعة</Button><Button asChild variant="outline"><Link href="/solutions/my-ideas">إلغاء</Link></Button></div>
    </form>
  </div>;
}

export function IdeaStageGatePreview({ id }: { id: string }) {
  const idea = DEMO_IDEAS.find((item) => item.id === id) ?? DEMO_IDEAS[0];
  const score = scoreForIdea(idea);
  return <div className="mx-auto max-w-4xl space-y-5"><Link href="/solutions/my-ideas" className="text-xs text-muted">العودة إلى أفكاري</Link><PageHeader title={idea.titleAr} description="تتبع رحلة الفكرة عبر بوابات المراجعة. هذه البيانات للمعاينة فقط." action={<Badge variant={statusVariant(idea.status)}>{statusLabel(idea.status)}</Badge>} />
    <div className="rounded-3xl bg-[#0B1120] p-6 text-slate-200">
      <h2 className="mb-5 text-lg font-bold text-white">رحلة الفكرة — Stage‑Gate 0‑7</h2>
      <div className="overflow-x-auto pb-2"><JourneyMap currentGate={idea.gate} /></div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="mb-3 text-sm font-semibold text-slate-300">مستوى الفكرة (بناءً على آخر تحقق AI)</p>
          <LevelGauge score={score} />
        </div>
        <ProgressSummaryCard percent={score} completed={idea.gate} total={7} />
      </div>
    </div>
    <div className="grid gap-5 lg:grid-cols-2"><Card><CardHeader><CardTitle>ما المطلوب منك الآن؟</CardTitle></CardHeader><CardContent className="space-y-3 text-sm">{idea.status === "MORE_INFO_REQUESTED" ? <><p>أرفق تقدير عدد المستفيدين ووصفًا مختصرًا للأثر المتوقع.</p><Button>استكمال وإعادة إرسال</Button></> : idea.status === "CONVERTED_TO_SOLUTION" ? <p>قُبلت الفكرة وربطت بسجل الحل التشغيلي؛ يمكنك الاطلاع على مرحلة المتابعة.</p> : <p>لا يوجد إجراء مطلوب منك حاليًا. فريق الابتكار يجري المراجعة الأولية.</p>}<p className="rounded-xl bg-slate-50 p-3 text-xs text-muted">التحديثات هنا ثابتة في وضع العرض ولا تحفظ أي تغيير.</p></CardContent></Card><Card><CardHeader><CardTitle>المرفقات والملاحظات</CardTitle></CardHeader><CardContent className="space-y-3">{idea.attachments.map((attachment) => <div key={attachment} className="flex items-center gap-2 rounded-xl border p-3 text-sm"><FileText className="h-4 w-4 text-primary"/>{attachment}<Badge className="ms-auto" variant="neutral">تجريبي</Badge></div>)}<div className="rounded-xl bg-slate-50 p-3 text-sm"><b>آخر ملاحظة:</b> {idea.status === "MORE_INFO_REQUESTED" ? "نحتاج تفاصيل أثر الفكرة قبل استكمال التقييم." : "تم استلام الفكرة وسيظهر أي طلب استكمال هنا."}</div></CardContent></Card></div>
  </div>;
}

function Field({ label, wide = false, children }: { label: string; wide?: boolean; children: React.ReactNode }) { return <label className={wide ? "md:col-span-2" : ""}><Label>{label}</Label>{children}</label>; }
