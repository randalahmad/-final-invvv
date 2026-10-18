"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CalendarClock, Check, ChevronDown, Clock3, FileCheck2, Lightbulb, LockKeyhole, Map, Sparkles, Target, UploadCloud } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { DEFAULT_PREVIEW_INNOVATOR, PREVIEW_INNOVATOR_STORAGE_KEY, readPreviewInnovators, type PreviewInnovatorAccount } from "./innovator-accounts";
import { IdeaReadinessIntake } from "./idea-readiness-intake";
import type { IdeaReadinessResult } from "./idea-readiness-schema";

const stages = [
  "رفع ملف الفكرة", "تقديم الفكرة", "التقييم الأولي", "دورة الابتكار", "التجارب التشغيلية", "الاحتضان",
  "مسرعة الأعمال", "الملكية الفكرية", "الدعم والتبني والتوسع", "قياس الأثر", "الاكتمال",
];
const tasks = ["تحديد المشكلة", "فهم المستفيد", "التحقق من المشكلة", "تطوير الحل", "النموذج الأولي", "الاختبار", "النتائج", "المراجعة"];
const stageRequirements: Record<string, string[]> = {
  "رفع ملف الفكرة": ["إدخال المعلومات الأساسية", "رفع ملف الفكرة أو المشروع", "مراجعة نتيجة فحص الجاهزية"],
  "تقديم الفكرة": ["تحديد المشكلة والفرصة", "توضيح الفئة المستفيدة", "توثيق الارتباط بالأهداف"],
  "التقييم الأولي": ["استكمال بطاقة التقييم", "معالجة ملاحظات المراجع", "تأكيد قرار الانتقال"],
  "دورة الابتكار": ["التحقق من المشكلة مع المستفيدين", "تطوير الحل المقترح", "بناء النموذج الأولي واختباره"],
  "التجارب التشغيلية": ["تحديد نطاق التجربة", "تنفيذ الاختبار التشغيلي", "توثيق النتائج والتحسينات"],
  "الاحتضان": ["إعداد خطة الاحتضان", "متابعة الإرشاد والتطوير", "استكمال متطلبات الخروج"],
  "مسرعة الأعمال": ["تحديد أهداف المسرعة", "متابعة مؤشرات النمو", "عرض نتائج البرنامج"],
  "الملكية الفكرية": ["تحديد الأصول القابلة للحماية", "استكمال مراجعة الملكية الفكرية", "توثيق إجراء الحماية"],
  "الدعم والتبني": ["إعداد خطة التبني", "تحديد جهة التشغيل", "متابعة التوسع والاستدامة"],
  "الدعم والتبني والتوسع": ["إعداد خطة التبني", "تحديد جهة التشغيل", "متابعة التوسع والاستدامة"],
  "قياس الأثر": ["تحديد خط الأساس", "قياس النتائج والمؤشرات", "توثيق الأثر المحقق"],
  "الاكتمال": ["إغلاق المهام المفتوحة", "تجميع الأدلة النهائية", "اعتماد سجل الرحلة"],
};

function stageIndex(stage: string) {
  if (stage === "الدعم والتبني") return stages.indexOf("الدعم والتبني والتوسع");
  return Math.max(1, stages.indexOf(stage));
}

export function InnovatorJourneyPreview() {
  const searchParams = useSearchParams();
  const [innovator, setInnovator] = useState<PreviewInnovatorAccount>(DEFAULT_PREVIEW_INNOVATOR);
  const [intakeComplete, setIntakeComplete] = useState(false);
  const [intakeOpen, setIntakeOpen] = useState(false);
  const accountKey = searchParams.get("previewAccount") ?? "default-innovator";

  useEffect(() => {
    const id = searchParams.get("previewAccount");
    if (id) {
      const selected = readPreviewInnovators(window.localStorage.getItem(PREVIEW_INNOVATOR_STORAGE_KEY)).find((item) => item.id === id);
      if (selected) setInnovator(selected);
    }
    const completed = Boolean(window.localStorage.getItem(`innovation-platform.idea-readiness.${id ?? "default-innovator"}`));
    setIntakeComplete(completed);
    setIntakeOpen(!completed);
  }, [searchParams]);

  function completeIntake(result: IdeaReadinessResult) {
    setInnovator((current) => ({ ...current, ideaTitle: result.title, department: result.department }));
    setIntakeComplete(true);
    setIntakeOpen(false);
  }

  const currentStage = intakeComplete ? stageIndex(innovator.stage) : 0;
  const currentTask = Math.max(0, tasks.indexOf(innovator.task));
  const requirements = stageRequirements[innovator.stage] ?? stageRequirements["تقديم الفكرة"];

  return <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 pb-10">
    <header className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-primary-700 via-primary to-secondary-600 p-6 text-white shadow-xl shadow-primary/10 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div><div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold ring-1 ring-white/20"><Map className="h-4 w-4"/> رحلة {innovator.name}</div><h1 className="text-2xl font-black sm:text-3xl">{innovator.ideaTitle}</h1><p className="mt-2 text-sm text-white/80">{innovator.department} · تابع مراحل الفكرة ومهامها ومواعيدها من مكان واحد.</p></div>
        <div className="min-w-48 rounded-2xl bg-white/10 p-4 ring-1 ring-white/20"><div className="flex items-end justify-between"><span className="text-xs text-white/75">نسبة الرحلة</span><b className="text-2xl">{innovator.progress}%</b></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-black/15"><div className="h-full rounded-full bg-white" style={{width:`${innovator.progress}%`}}/></div></div>
      </div>
    </header>

    <section className={`overflow-hidden rounded-[2rem] border ${intakeComplete ? "border-success/25 bg-emerald-50/30" : "border-primary/25 bg-surface"}`}>
      <button type="button" className="flex w-full items-center gap-4 p-5 text-right sm:p-6" onClick={() => setIntakeOpen((open) => !open)} aria-expanded={intakeOpen}>
        <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${intakeComplete ? "bg-success text-white" : "bg-primary text-white"}`}>{intakeComplete ? <FileCheck2 className="h-6 w-6"/> : <UploadCloud className="h-6 w-6"/>}</span>
        <span className="flex-1"><span className="block text-xs font-bold text-primary">الخطوة الأولى</span><span className="mt-1 block font-black">رفع ملف الفكرة وفحص الجاهزية</span><span className="mt-1 block text-xs text-muted">{intakeComplete ? "اكتمل الفحص ويمكن تحديث الملف عند الحاجة." : "ابدأ برفع الملف واستكمال المعلومات الأساسية، مع بقاء مسار الرحلة متاحًا أمامك."}</span></span>
        <Badge variant={intakeComplete ? "success" : "warning"}>{intakeComplete ? "مكتمل" : "مطلوب"}</Badge><ChevronDown className={`h-5 w-5 text-muted transition-transform ${intakeOpen ? "rotate-180" : ""}`}/>
      </button>
      {intakeOpen ? <div className="border-t border-border p-4 sm:p-6"><IdeaReadinessIntake embedded accountKey={accountKey} initialTitle={innovator.ideaTitle} department={innovator.department} onComplete={completeIntake}/></div> : null}
    </section>

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Summary icon={Sparkles} label="المرحلة الحالية" value={innovator.stage}/><Summary icon={Target} label="المهمة الحالية" value={innovator.task}/><Summary icon={CalendarClock} label="أقرب موعد" value={innovator.dueDate}/><Summary icon={Clock3} label="الحساب" value={innovator.email}/></section>

    <section className="rounded-[2rem] border border-border bg-surface p-5 shadow-sm sm:p-7"><div className="mb-7"><p className="text-xs font-bold text-primary">المسار الرئيسي</p><h2 className="mt-1 text-xl font-black">محطات رحلتك</h2></div><div className="relative overflow-x-auto pb-3"><div className="absolute right-10 left-10 top-9 h-1 bg-slate-100"><div className="h-full bg-gradient-to-l from-success to-primary" style={{width:`${Math.round((currentStage / (stages.length - 1)) * 100)}%`}}/></div><ol className="relative z-[1] grid min-w-[1240px] grid-cols-11 gap-3">{stages.map((stage,index)=><li key={stage} className="flex flex-col items-center text-center"><span className={`grid h-[4.5rem] w-[4.5rem] place-items-center rounded-2xl border-2 ${index<currentStage?"border-success bg-success text-white":index===currentStage?"border-primary bg-primary text-white ring-4 ring-primary-50":"border-slate-200 bg-slate-50 text-slate-400"}`}>{index<currentStage?<Check className="h-7 w-7"/>:index===currentStage?<Sparkles className="h-7 w-7"/>:<LockKeyhole className="h-5 w-5"/>}</span><b className={`mt-3 text-xs ${index===currentStage?"text-primary":""}`}>{stage}</b><span className="mt-1 text-[10px] text-muted">{index<currentStage?"مكتمل":index===currentStage?"المرحلة الحالية":"قادم"}</span></li>)}</ol></div></section>

    <section className="grid items-start gap-5 lg:grid-cols-[1.55fr_.75fr]">
      <div className="space-y-5"><div className="rounded-[2rem] border border-primary/20 bg-primary-50/50 p-5 sm:p-7"><Badge variant="primary">المرحلة الحالية</Badge><h2 className="mt-2 text-xl font-black">{innovator.stage}</h2><p className="mt-1 text-sm text-muted">أنجز مهام المرحلة بالترتيب وتابع تقدم كل خطوة.</p><div className="relative mt-7 overflow-x-auto pb-4"><div className="absolute right-7 left-7 top-6 h-0.5 bg-slate-200"/><ol className="relative z-[1] grid min-w-[760px] grid-cols-8 gap-2">{tasks.map((task,index)=><li key={task} className="flex flex-col items-center text-center"><span className={`grid h-12 w-12 place-items-center rounded-full border-2 text-sm font-black ${index<currentTask?"border-success bg-success text-white":index===currentTask?"border-primary bg-white text-primary ring-4 ring-primary-100":"border-slate-200 bg-slate-50 text-slate-400"}`}>{index<currentTask?<Check className="h-5 w-5"/>:index===currentTask?index+1:<LockKeyhole className="h-4 w-4"/>}</span><b className={`mt-3 text-[11px] ${index===currentTask?"text-primary":""}`}>{task}</b></li>)}</ol></div></div>
        <div className="rounded-[2rem] border border-border bg-surface p-5 sm:p-7"><h2 className="text-lg font-black">متطلبات المرحلة</h2><div className="mt-4 grid gap-3 sm:grid-cols-3">{requirements.map((requirement, index) => <div key={requirement} className="flex gap-3 rounded-xl bg-slate-50 p-4 text-sm"><span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${index === 0 ? "bg-primary text-white" : "bg-white text-muted ring-1 ring-border"}`}>{index + 1}</span><span>{requirement}</span></div>)}</div></div>
      </div>
      <aside className="rounded-[2rem] border border-primary/25 bg-surface p-6 shadow-lg shadow-primary/5"><Badge variant="primary">مهمتك الآن</Badge><h2 className="mt-4 text-lg font-black">{innovator.task}</h2><p className="mt-2 text-sm leading-6 text-muted">أكمل تفاصيل المهمة الحالية وأرفق الدليل المناسب قبل الموعد المحدد.</p><div className="mt-5 space-y-3 rounded-2xl bg-slate-50 p-4 text-sm"><p className="flex gap-2"><CalendarClock className="h-4 w-4 text-warning"/> الموعد: {innovator.dueDate}</p><p className="flex gap-2"><UploadCloud className="h-4 w-4 text-primary"/> مستند أو دليل داعم للمهمة</p></div></aside>
    </section>
  </div>;
}

function Summary({icon:Icon,label,value}:{icon:typeof Lightbulb;label:string;value:string}) { return <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4"><span className="grid h-11 w-11 place-items-center rounded-xl bg-primary-50 text-primary"><Icon className="h-5 w-5"/></span><div><p className="text-[11px] text-muted">{label}</p><p className="mt-1 text-sm font-black">{value}</p></div></div>; }
