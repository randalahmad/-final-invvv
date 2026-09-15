import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, Check, CheckCircle2, CircleDashed, Clock3, FileText, Flag, Lightbulb, LockKeyhole, Map, Sparkles, Target, UploadCloud } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { listMyTasks } from "@/modules/governance-workflow/service";
import { listIdeasInScope } from "@/modules/ideas/service";
import { isDevelopmentRolePreviewEnabled } from "@/modules/auth/development-role-preview";
import { listSolutionsInScope } from "@/modules/solutions/service";
import { requireUser } from "@/server/authz";

const stages = [
  { key: "submission", name: "تقديم الفكرة", hint: "صياغة الفكرة وتقديمها", icon: Lightbulb },
  { key: "initial", name: "التقييم الأولي", hint: "مراجعة أولية خفيفة", icon: FileText },
  { key: "cycle", name: "دورة الابتكار", hint: "فهم المشكلة وبناء الحل", icon: Sparkles },
  { key: "incubation", name: "الاحتضان", hint: "تطوير واختبار أعمق", icon: Target },
  { key: "accelerator", name: "مسرعة الأعمال", hint: "جاهزية متقدمة وتوسع", icon: Flag },
  { key: "support", name: "الدعم والتبني", hint: "تمكين التطبيق والتبني", icon: CheckCircle2 },
  { key: "impact", name: "قياس الأثر", hint: "متابعة النتائج والأثر", icon: CircleDashed },
  { key: "complete", name: "الاكتمال", hint: "توثيق إتمام الرحلة", icon: Check },
] as const;

const cycleTasks = ["تحديد المشكلة", "فهم المستفيد", "التحقق من المشكلة", "تطوير الحل", "النموذج الأولي", "الاختبار", "النتائج", "المراجعة"];

function daysRemaining(date: Date | null) {
  if (!date) return null;
  return Math.ceil((date.getTime() - Date.now()) / 86400000);
}

export default async function InnovatorJourneyPage({ searchParams }: { searchParams: { stage?: string } }) {
  const actor = await requireUser();
  if (!isDevelopmentRolePreviewEnabled() || actor.email !== "innovator@innovation.local") notFound();

  const [ideas, solutions, tasks] = await Promise.all([listIdeasInScope(actor), listSolutionsInScope(actor), listMyTasks(actor)]);
  // The real Prisma query is already scoped in listMyTasks. Keep this explicit
  // ownership filter as a defence for the lightweight local demo adapter too.
  const ownedTasks = tasks.filter((task) => task.assignedToUserId === actor.userId);
  const activeTasks = ownedTasks.filter((task) => !["COMPLETED", "CANCELLED"].includes(task.status));
  const currentTask = activeTasks[0] ?? null;
  const nearest = activeTasks.filter((task) => task.dueDate).sort((a, b) => a.dueDate!.getTime() - b.dueDate!.getTime())[0]?.dueDate ?? null;
  const remaining = daysRemaining(nearest);
  const subject = ideas[0]?.titleAr ?? solutions[0]?.nameAr ?? "مساعد ذكي لطلبات المستفيدين";
  const selectedStage = stages.some((stage) => stage.key === searchParams.stage) ? searchParams.stage! : "cycle";
  const currentIndex = 2;
  const progress = Math.round(((currentIndex + 0.45) / stages.length) * 100);

  return <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 pb-10">
    <header className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-primary-700 via-primary to-secondary-600 p-6 text-white shadow-xl shadow-primary/10 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div><div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold ring-1 ring-white/20"><Map className="h-4 w-4" /> رحلتي الابتكارية</div><h1 className="text-2xl font-black sm:text-3xl">{subject}</h1><p className="mt-2 max-w-2xl text-sm text-white/80">خطوة واضحة في كل مرة. أكمل مهمتك الحالية، ثم تابع تقدم فكرتك عبر محطات الرحلة.</p></div>
        <div className="min-w-[12rem] rounded-2xl bg-white/10 p-4 backdrop-blur-sm ring-1 ring-white/20"><div className="flex items-end justify-between"><span className="text-xs text-white/75">نسبة الرحلة</span><b className="text-2xl">{progress}%</b></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-black/15"><div className="h-full rounded-full bg-white" style={{ width: `${progress}%` }} /></div></div>
      </div>
    </header>

    <section aria-label="ملخص الرحلة" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Summary icon={Sparkles} label="المرحلة الحالية" value="دورة الابتكار" tone="primary" />
      <Summary icon={Target} label="المهمة الحالية" value={currentTask?.title ?? "التحقق من المشكلة"} tone="secondary" />
      <Summary icon={CalendarClock} label="أقرب موعد" value={nearest ? nearest.toLocaleDateString("ar-SA") : "لا يوجد موعد"} tone="warning" />
      <Summary icon={Clock3} label="الوقت المتبقي" value={remaining === null ? "—" : remaining < 0 ? `متأخرة ${Math.abs(remaining)} يوم` : `${remaining} أيام`} tone={remaining !== null && remaining < 0 ? "danger" : "success"} />
    </section>

    <section className="rounded-[2rem] border border-border bg-surface p-5 shadow-sm sm:p-7">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold text-primary">المسار الرئيسي</p><h2 className="mt-1 text-xl font-black text-foreground">محطات رحلتك</h2></div><div className="flex flex-wrap gap-2 text-[11px]"><Badge variant="success">مكتمل</Badge><Badge variant="primary">المرحلة الحالية</Badge><Badge variant="warning">بانتظار المراجعة</Badge><Badge variant="danger">يحتاج تعديل</Badge><Badge variant="neutral">مقفل</Badge></div></div>
      <div className="relative overflow-x-auto pb-3">
        <div className="absolute right-10 left-10 top-9 h-1 rounded-full bg-slate-100"><div className="h-full w-[29%] rounded-full bg-gradient-to-l from-success to-primary" /></div>
        <ol className="relative z-[1] grid min-w-[900px] grid-cols-8 gap-3">
          {stages.map((stage, index) => { const completed = index < currentIndex; const current = index === currentIndex; const locked = index > currentIndex; const Icon = stage.icon; const inner = <><span className={`grid h-[4.5rem] w-[4.5rem] place-items-center rounded-2xl border-2 shadow-sm transition ${completed ? "border-success bg-success text-white" : current ? "border-primary bg-primary text-white shadow-lg shadow-primary/25 ring-4 ring-primary-50" : "border-slate-200 bg-slate-50 text-slate-400"}`}>{completed ? <Check className="h-7 w-7" /> : locked ? <LockKeyhole className="h-5 w-5" /> : <Icon className="h-7 w-7" />}</span><b className={`mt-3 text-sm ${current ? "text-primary" : completed ? "text-foreground" : "text-muted"}`}>{stage.name}</b><span className="mt-1 text-[10px] text-muted">{completed ? "مكتمل" : current ? "المرحلة الحالية" : "مقفل"}</span></>; return <li key={stage.key} className="flex min-w-0 flex-col items-center text-center">{locked ? <div className="flex flex-col items-center opacity-70">{inner}</div> : <Link href={`/journey?stage=${stage.key}`} aria-current={current ? "step" : undefined} className={`flex flex-col items-center rounded-2xl p-2 outline-none hover:bg-primary-50/50 ${selectedStage === stage.key ? "bg-primary-50/60" : ""}`}>{inner}</Link>}</li>; })}
        </ol>
      </div>
    </section>

    <section className="grid items-start gap-5 lg:grid-cols-[1.55fr_.75fr]">
      <div className="rounded-[2rem] border border-primary/20 bg-gradient-to-b from-primary-50/70 to-surface p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><Badge variant={selectedStage === "cycle" ? "primary" : "success"}>{selectedStage === "cycle" ? "المرحلة الحالية" : "مرحلة مكتملة"}</Badge><h2 className="mt-2 text-xl font-black">{stages.find((stage) => stage.key === selectedStage)?.name}</h2><p className="mt-1 text-sm text-muted">{selectedStage === "cycle" ? "أنجز المهام بالترتيب؛ تُفتح كل خطوة عندما تصبح جاهزة لك." : "يمكنك مراجعة ما أنجزته والعودة إلى مخرجات هذه المرحلة."}</p></div><span className="rounded-xl bg-surface px-3 py-2 text-xs font-bold text-primary ring-1 ring-primary/10">3 من 8 خطوات</span></div>
        {selectedStage === "cycle" ? <div className="relative mt-7 overflow-x-auto pb-4"><div className="absolute right-7 left-7 top-6 h-0.5 bg-slate-200"/><ol className="relative z-[1] grid min-w-[760px] grid-cols-8 gap-2">{cycleTasks.map((title, index) => { const done=index<2; const current=index===2; return <li key={title} className="flex flex-col items-center text-center"><span className={`grid h-12 w-12 place-items-center rounded-full border-2 text-sm font-black ${done ? "border-success bg-success text-white" : current ? "border-primary bg-white text-primary ring-4 ring-primary-100" : "border-slate-200 bg-slate-50 text-slate-400"}`}>{done ? <Check className="h-5 w-5"/> : current ? "3" : <LockKeyhole className="h-4 w-4"/>}</span><b className={`mt-3 text-[11px] leading-5 ${current ? "text-primary" : done ? "text-foreground" : "text-muted"}`}>{title}</b>{current ? <span className="mt-1 text-[10px] font-semibold text-primary">مهمتك الآن</span> : null}</li>})}</ol></div> : <div className="mt-6 rounded-2xl border border-success/20 bg-success-bg p-5 text-sm text-success"><CheckCircle2 className="ml-2 inline h-5 w-5"/> اكتملت هذه المرحلة، ويمكنك مراجعة مخرجاتها وقرار الانتقال المسجل.</div>}
      </div>

      <aside id="current-task" className="rounded-[2rem] border border-primary/25 bg-surface p-5 shadow-lg shadow-primary/5 sm:p-6"><div className="flex items-center justify-between"><Badge variant="primary">مهمتك الآن</Badge>{remaining !== null ? <span className="text-xs font-bold text-warning">متبقي {Math.max(remaining,0)} أيام</span> : null}</div><h2 className="mt-4 text-lg font-black leading-7">{currentTask?.title ?? "التحقق من المشكلة"}</h2><p className="mt-2 text-sm leading-6 text-muted">{currentTask?.nextAction ?? "وثّق ما يؤكد وجود المشكلة من منظور المستفيد وأرفق الدليل المناسب."}</p><div className="mt-5 space-y-3 rounded-2xl bg-slate-50 p-4 text-sm"><p className="flex items-center gap-2"><CalendarClock className="h-4 w-4 text-warning"/><span>الموعد: <b>{nearest ? nearest.toLocaleDateString("ar-SA") : "غير محدد"}</b></span></p><p className="flex items-center gap-2"><UploadCloud className="h-4 w-4 text-primary"/><span>الدليل المطلوب: <b>مقابلات أو ملاحظات المستفيدين</b></span></p></div><a href="#current-task" className="mt-5 flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-white shadow-sm">متابعة المهمة <ArrowLeft className="h-4 w-4"/></a><p className="mt-3 text-center text-[11px] text-muted">مساحة تنفيذ المهمة ستُبنى في الخطوة التالية بعد اعتماد هذا المسار.</p></aside>
    </section>
  </div>;
}

function Summary({ icon: Icon, label, value, tone }: { icon: typeof Sparkles; label: string; value: string; tone: "primary" | "secondary" | "warning" | "success" | "danger" }) {
  const tones = { primary: "bg-primary-50 text-primary", secondary: "bg-cyan-50 text-secondary", warning: "bg-warning-bg text-warning", success: "bg-success-bg text-success", danger: "bg-danger-bg text-danger" };
  return <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-border bg-surface p-4"><span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${tones[tone]}`}><Icon className="h-5 w-5"/></span><div className="min-w-0"><p className="text-[11px] font-semibold text-muted">{label}</p><p className="mt-1 line-clamp-2 text-sm font-black text-foreground">{value}</p></div></div>;
}
