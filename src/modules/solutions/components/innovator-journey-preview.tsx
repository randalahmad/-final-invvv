"use client";

import { useState, type FormEvent } from "react";
import { ArrowLeft, Bot, CheckCircle2, FileText, Lightbulb, Plus, Sparkles, Upload } from "lucide-react";

import { PreviewLink as Link } from "@/components/layout/preview-link";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEMO_IDEAS } from "@/server/demo-data";

const fieldClass = "mt-1.5 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm";
const gates = [
  ["0", "استلام الفكرة"], ["1", "التحقق الأولي"], ["2", "مراجعة فريق الابتكار"], ["3", "استكمال المعلومات"],
  ["4", "تقييم الجهة المختصة"], ["5", "القرار"], ["6", "التجربة والمتابعة"], ["7", "الإدراج في المحفظة"],
] as const;

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
  const [aiCheck, setAiCheck] = useState(false);
  const submit = (event: FormEvent) => { event.preventDefault(); setSubmitted(true); };
  if (submitted) return <div className="mx-auto max-w-2xl space-y-5"><Card className="border-emerald-200"><CardContent className="space-y-4 p-8 text-center"><CheckCircle2 className="mx-auto h-11 w-11 text-emerald-600"/><h1 className="text-xl font-bold">تم إرسال الفكرة للمعاينة</h1><p className="text-sm text-muted">هذه عملية واجهة فقط؛ لا يتم إنشاء سجل أو رفع ملف على الخادم.</p><Button asChild><Link href="/solutions/my-ideas">العودة إلى أفكاري</Link></Button></CardContent></Card></div>;
  return <div className="mx-auto max-w-3xl space-y-5"><PageHeader title="تقديم فكرة جديدة" description="قدّم وصفًا مختصرًا وواضحًا للفكرة. الحفظ والإرفاق في هذه النسخة تجريبيان فقط." />
    <form onSubmit={submit} className="space-y-5"><Card><CardContent className="grid gap-5 p-6 md:grid-cols-2"><Field label="عنوان الفكرة"><Input required defaultValue="مساعد رقمي لتوجيه المستفيد" /></Field><Field label="التصنيف"><select className={fieldClass} defaultValue="تحسين تجربة المستفيد"><option>تحسين تجربة المستفيد</option><option>خدمات رقمية</option><option>كفاءة تشغيلية</option><option>استدامة</option></select></Field><Field label="وصف الفكرة" wide><textarea required className={fieldClass} rows={5} defaultValue="اقتراح لمسار موحد يساعد المستفيد على الوصول للخدمة المناسبة." /></Field><Field label="المشكلة التي تعالجها" wide><textarea className={fieldClass} rows={4} defaultValue="تعدد القنوات وصعوبة معرفة مسار الطلب المناسب." /></Field><Field label="المرفقات"><div className="mt-1.5 rounded-xl border border-dashed p-4 text-center"><Upload className="mx-auto h-5 w-5 text-primary"/><p className="mt-1 text-xs text-muted">وصف الفكرة.pdf · مخطط أولي.png</p><input aria-label="إرفاق ملفات" className="mt-2 text-xs" type="file" multiple /></div></Field><div className="flex items-end"><Button type="button" variant="outline" onClick={() => setAiCheck(true)}><Sparkles className="h-4 w-4"/>تحقق أولي بالذكاء الاصطناعي</Button></div></CardContent></Card>
      {aiCheck ? <Card className="border-violet-200 bg-violet-50/30"><CardHeader><div className="flex items-center gap-2"><Bot className="h-5 w-5 text-violet-700"/><CardTitle>اقتراح AI — تحقق أولي تجريبي</CardTitle></div></CardHeader><CardContent className="grid gap-3 text-sm md:grid-cols-3"><div><p className="text-xs text-muted">التقييم المبدئي</p><p className="mt-1 text-2xl font-bold text-violet-800">78/100</p></div><div className="md:col-span-2"><p className="text-xs text-muted">التوصية</p><p className="mt-1">الفكرة مرتبطة بتحسين تجربة المستفيد. يُستحسن توضيح عدد المستفيدين ومؤشر النجاح قبل الإحالة للمراجعة.</p></div><p className="text-xs text-violet-800 md:col-span-3">هذا اقتراح مولّد للمعاينة فقط، وليس قرار قبول أو تقييمًا رسميًا، ولا ينفذ أي استدعاء API.</p></CardContent></Card> : null}
      <div className="flex gap-2"><Button type="submit"><Lightbulb className="h-4 w-4"/>إرسال الفكرة للمراجعة</Button><Button asChild variant="outline"><Link href="/solutions/my-ideas">إلغاء</Link></Button></div>
    </form>
  </div>;
}

export function IdeaStageGatePreview({ id }: { id: string }) {
  const idea = DEMO_IDEAS.find((item) => item.id === id) ?? DEMO_IDEAS[0];
  return <div className="mx-auto max-w-4xl space-y-5"><Link href="/solutions/my-ideas" className="text-xs text-muted">العودة إلى أفكاري</Link><PageHeader title={idea.titleAr} description="تتبع رحلة الفكرة عبر بوابات المراجعة. هذه البيانات للمعاينة فقط." action={<Badge variant={statusVariant(idea.status)}>{statusLabel(idea.status)}</Badge>} />
    <Card><CardHeader><CardTitle>تقدم الفكرة — Stage‑Gate</CardTitle></CardHeader><CardContent className="space-y-3">{gates.map(([number, label]) => { const current = Number(number) === idea.gate; const complete = Number(number) < idea.gate; return <div key={number} className="grid grid-cols-[2.25rem_1fr_auto] items-center gap-3"><span className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${complete ? "bg-emerald-600 text-white" : current ? "bg-primary text-white ring-4 ring-primary/15" : "bg-slate-100 text-slate-500"}`}>{complete ? "✓" : number}</span><div><p className="text-sm font-semibold">{label}</p><p className="text-xs text-muted">{current ? "المرحلة الحالية — الإجراء المطلوب موضح أدناه" : complete ? "اكتملت في المعاينة" : "بانتظار المرحلة السابقة"}</p></div>{current ? <Badge variant="primary">الحالية</Badge> : complete ? <Badge variant="success">مكتملة</Badge> : <Badge variant="neutral">لاحقًا</Badge>}</div>; })}</CardContent></Card>
    <div className="grid gap-5 lg:grid-cols-2"><Card><CardHeader><CardTitle>ما المطلوب منك الآن؟</CardTitle></CardHeader><CardContent className="space-y-3 text-sm">{idea.status === "MORE_INFO_REQUESTED" ? <><p>أرفق تقدير عدد المستفيدين ووصفًا مختصرًا للأثر المتوقع.</p><Button>استكمال وإعادة إرسال</Button></> : idea.status === "CONVERTED_TO_SOLUTION" ? <p>قُبلت الفكرة وربطت بسجل الحل التشغيلي؛ يمكنك الاطلاع على مرحلة المتابعة.</p> : <p>لا يوجد إجراء مطلوب منك حاليًا. فريق الابتكار يجري المراجعة الأولية.</p>}<p className="rounded-xl bg-slate-50 p-3 text-xs text-muted">التحديثات هنا ثابتة في وضع العرض ولا تحفظ أي تغيير.</p></CardContent></Card><Card><CardHeader><CardTitle>المرفقات والملاحظات</CardTitle></CardHeader><CardContent className="space-y-3">{idea.attachments.map((attachment) => <div key={attachment} className="flex items-center gap-2 rounded-xl border p-3 text-sm"><FileText className="h-4 w-4 text-primary"/>{attachment}<Badge className="ms-auto" variant="neutral">تجريبي</Badge></div>)}<div className="rounded-xl bg-slate-50 p-3 text-sm"><b>آخر ملاحظة:</b> {idea.status === "MORE_INFO_REQUESTED" ? "نحتاج تفاصيل أثر الفكرة قبل استكمال التقييم." : "تم استلام الفكرة وسيظهر أي طلب استكمال هنا."}</div></CardContent></Card></div>
  </div>;
}

function Field({ label, wide = false, children }: { label: string; wide?: boolean; children: React.ReactNode }) { return <label className={wide ? "md:col-span-2" : ""}><Label>{label}</Label>{children}</label>; }
