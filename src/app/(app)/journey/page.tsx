import Link from "next/link";
import { notFound } from "next/navigation";
import type { IdeaStatus } from "@prisma/client";
import { ArrowLeft, CalendarClock, Check, CheckCircle2, CircleDashed, Clock3, FileText, Flag, Lightbulb, LockKeyhole, Map, Sparkles, Target, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { listMyTasks } from "@/modules/governance-workflow/service";
import { listIdeasInScope } from "@/modules/ideas/service";
import { listSolutionsInScope } from "@/modules/solutions/service";
import { requireUser, isInnovatorOnlyAccount } from "@/server/authz";

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

function daysRemaining(date: Date | null) {
  if (!date) return null;
  return Math.ceil((date.getTime() - Date.now()) / 86400000);
}

/**
 * Maps a real idea's status to where it honestly sits on the 8-station
 * journey map. Only stations 0-2 are ever reachable from idea data alone --
 * everything past "cycle" belongs to the solution lifecycle, which a real
 * INNOVATOR account has no visibility into (it never holds solution.view),
 * so this never fabricates progress beyond what the account can actually see.
 */
function journeyStateForIdea(status: IdeaStatus | undefined) {
  if (!status) {
    return { currentIndex: -1, closed: null as "REJECTED" | "WITHDRAWN" | null, statusLabel: "لم تبدأ بعد", statusHint: "قدّمي أول فكرة لك لتبدأ رحلتك." };
  }
  switch (status) {
    case "DRAFT":
      return { currentIndex: 0, closed: null, statusLabel: "مسودة", statusHint: "أكملي الحقول ثم قدّمي الفكرة لبدء المراجعة." };
    case "SUBMITTED":
    case "INITIAL_REVIEW":
      return { currentIndex: 1, closed: null, statusLabel: "قيد المراجعة الأولية", statusHint: "فكرتك بانتظار تقييم الموظف المختص." };
    case "TECHNICAL_REVIEW":
      return { currentIndex: 1, closed: null, statusLabel: "قيد المراجعة الفنية", statusHint: "اجتازت فكرتك المراجعة الأولية وهي الآن في التقييم الفني." };
    case "MORE_INFO_REQUESTED":
      return { currentIndex: 1, closed: null, statusLabel: "مطلوب معلومات إضافية", statusHint: "المُقيّم طلب توضيحات منك -- راجعي تفاصيل الفكرة للرد عليها." };
    case "APPROVED_FOR_PILOT":
    case "CONVERTED_TO_SOLUTION":
      return { currentIndex: 2, closed: null, statusLabel: "معتمدة", statusHint: "اعتُمدت فكرتك وبدأت رحلتها ضمن دورة الابتكار." };
    case "REJECTED":
      return { currentIndex: 1, closed: "REJECTED" as const, statusLabel: "مرفوضة", statusHint: "لم تُعتمد هذه الفكرة. يمكنك تقديم فكرة جديدة في أي وقت." };
    case "WITHDRAWN":
      return { currentIndex: 1, closed: "WITHDRAWN" as const, statusLabel: "مسحوبة", statusHint: "تم سحب هذه الفكرة. يمكنك تقديم فكرة جديدة في أي وقت." };
    default:
      return { currentIndex: 0, closed: null, statusLabel: "مسودة", statusHint: "" };
  }
}

export default async function InnovatorJourneyPage({ searchParams }: { searchParams: { stage?: string } }) {
  const actor = await requireUser();
  if (!isInnovatorOnlyAccount(actor)) notFound();

  // A real INNOVATOR account holds only idea.view -- it has no solutions
  // and no compliance tasks by design, and calling listSolutionsInScope /
  // listMyTasks without the permission they require would throw. Skip them
  // (empty result) rather than gating this whole page on permissions it
  // will never hold.
  const [ideas, solutions, tasks] = await Promise.all([
    listIdeasInScope(actor),
    actor.permissions.has("solution.view") ? listSolutionsInScope(actor) : Promise.resolve([]),
    actor.permissions.has("compliance.view") ? listMyTasks(actor) : Promise.resolve([]),
  ]);
  // The real Prisma query is already scoped in listMyTasks. Keep this explicit
  // ownership filter as a defence for the lightweight local demo adapter too.
  const ownedTasks = tasks.filter((task) => task.assignedToUserId === actor.userId);
  const activeTasks = ownedTasks.filter((task) => !["COMPLETED", "CANCELLED"].includes(task.status));
  const currentTask = activeTasks[0] ?? null;
  const nearest = activeTasks.filter((task) => task.dueDate).sort((a, b) => a.dueDate!.getTime() - b.dueDate!.getTime())[0]?.dueDate ?? null;
  const remaining = daysRemaining(nearest);

  // listIdeasInScope orders by updatedAt desc, so ideas[0] is the idea the
  // account most recently touched -- that real status (not a hardcoded
  // constant) is what drives this whole page.
  const primaryIdea = ideas[0] ?? null;
  const hasStarted = ideas.length > 0;
  const subject = primaryIdea?.titleAr ?? solutions[0]?.nameAr ?? null;
  const journey = journeyStateForIdea(primaryIdea?.status);
  const currentIndex = Math.max(journey.currentIndex, 0);
  const progress = hasStarted ? Math.round(((currentIndex + 0.45) / stages.length) * 100) : 0;
  const selectedStage = stages.some((stage) => stage.key === searchParams.stage) ? searchParams.stage! : (stages[currentIndex]?.key ?? "submission");

  return <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 pb-10">
    <header className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-primary-700 via-primary to-secondary-600 p-6 text-white shadow-xl shadow-primary/10 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div><div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold ring-1 ring-white/20"><Map className="h-4 w-4" /> رحلتي الابتكارية</div><h1 className="text-2xl font-black sm:text-3xl">{subject ?? "لم تُقدّم أي فكرة بعد"}</h1><p className="mt-2 max-w-2xl text-sm text-white/80">{hasStarted ? journey.statusHint : "كل رحلة ابتكارية تبدأ بفكرة. قدّمي فكرتك الأولى وتابعي تقدّمها هنا خطوة بخطوة."}</p></div>
        <div className="flex flex-col items-stretch gap-3 sm:items-end">
          <Link href="/governance/ideas/new" className="flex h-10 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-primary shadow-sm transition hover:bg-white/90"><Lightbulb className="h-4 w-4" />تقديم فكرة جديدة</Link>
          <div className="min-w-[12rem] rounded-2xl bg-white/10 p-4 backdrop-blur-sm ring-1 ring-white/20"><div className="flex items-end justify-between"><span className="text-xs text-white/75">نسبة الرحلة</span><b className="text-2xl">{progress}%</b></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-black/15"><div className="h-full rounded-full bg-white" style={{ width: `${progress}%` }} /></div></div>
        </div>
      </div>
    </header>

    <section aria-label="ملخص الرحلة" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Summary icon={Sparkles} label="حالة الفكرة" value={hasStarted ? journey.statusLabel : "لم تبدأ بعد"} tone={journey.closed ? "danger" : "primary"} />
      <Summary icon={Target} label="عدد أفكارك" value={String(ideas.length)} tone="secondary" />
      <Summary icon={CalendarClock} label="أقرب موعد" value={nearest ? nearest.toLocaleDateString("ar-SA") : "لا يوجد موعد"} tone="warning" />
      <Summary icon={Clock3} label="الوقت المتبقي" value={remaining === null ? "—" : remaining < 0 ? `متأخرة ${Math.abs(remaining)} يوم` : `${remaining} أيام`} tone={remaining !== null && remaining < 0 ? "danger" : "success"} />
    </section>

    <section className="rounded-[2rem] border border-border bg-surface p-5 shadow-sm sm:p-7">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold text-primary">المسار الرئيسي</p><h2 className="mt-1 text-xl font-black text-foreground">محطات رحلتك</h2></div><div className="flex flex-wrap gap-2 text-[11px]"><Badge variant="success">مكتمل</Badge><Badge variant="primary">المرحلة الحالية</Badge><Badge variant="warning">بانتظار المراجعة</Badge><Badge variant="danger">يحتاج تعديل</Badge><Badge variant="neutral">مقفل</Badge></div></div>
      <div className="relative overflow-x-auto pb-3">
        <div className="absolute right-10 left-10 top-9 h-1 rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-l from-success to-primary" style={{ width: `${hasStarted ? progress : 0}%` }} /></div>
        <ol className="relative z-[1] grid min-w-[900px] grid-cols-8 gap-3">
          {stages.map((stage, index) => { const completed = hasStarted && index < currentIndex; const current = hasStarted && index === currentIndex; const locked = !hasStarted || index > currentIndex; const Icon = stage.icon; const inner = <><span className={`grid h-[4.5rem] w-[4.5rem] place-items-center rounded-2xl border-2 shadow-sm transition ${completed ? "border-success bg-success text-white" : current ? (journey.closed ? "border-danger bg-danger text-white" : "border-primary bg-primary text-white shadow-lg shadow-primary/25 ring-4 ring-primary-50") : "border-slate-200 bg-slate-50 text-slate-400"}`}>{completed ? <Check className="h-7 w-7" /> : current && journey.closed ? <XCircle className="h-7 w-7" /> : locked ? <LockKeyhole className="h-5 w-5" /> : <Icon className="h-7 w-7" />}</span><b className={`mt-3 text-sm ${current ? "text-primary" : completed ? "text-foreground" : "text-muted"}`}>{stage.name}</b><span className="mt-1 text-[10px] text-muted">{completed ? "مكتمل" : current ? (journey.closed === "REJECTED" ? "مرفوضة" : journey.closed === "WITHDRAWN" ? "مسحوبة" : "المرحلة الحالية") : "مقفل"}</span></>; return <li key={stage.key} className="flex min-w-0 flex-col items-center text-center">{locked ? <div className="flex flex-col items-center opacity-70">{inner}</div> : <Link href={`/journey?stage=${stage.key}`} aria-current={current ? "step" : undefined} className={`flex flex-col items-center rounded-2xl p-2 outline-none hover:bg-primary-50/50 ${selectedStage === stage.key ? "bg-primary-50/60" : ""}`}>{inner}</Link>}</li>; })}
        </ol>
      </div>
    </section>

    <section className="grid items-start gap-5 lg:grid-cols-[1.55fr_.75fr]">
      <div className="rounded-[2rem] border border-primary/20 bg-gradient-to-b from-primary-50/70 to-surface p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><Badge variant={journey.closed ? "danger" : selectedStage === stages[currentIndex]?.key ? "primary" : "success"}>{journey.closed ? (journey.closed === "REJECTED" ? "مرفوضة" : "مسحوبة") : selectedStage === stages[currentIndex]?.key ? "المرحلة الحالية" : "مرحلة مكتملة"}</Badge><h2 className="mt-2 text-xl font-black">{stages.find((stage) => stage.key === selectedStage)?.name}</h2><p className="mt-1 text-sm text-muted">{!hasStarted ? "لم تُقدَّم أي فكرة بعد لهذا الحساب." : selectedStage === stages[currentIndex]?.key ? journey.statusHint : "هذه محطة سابقة في رحلتك."}</p></div></div>
        {!hasStarted ? (
          <div className="mt-7 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-primary/30 bg-primary-50/40 p-8 text-center">
            <Lightbulb className="h-8 w-8 text-primary" />
            <p className="text-sm font-semibold text-foreground">ابدئي من الصفر</p>
            <p className="max-w-sm text-xs text-muted">لا توجد لديك أي فكرة مُقدَّمة حتى الآن. قدّمي فكرتك الأولى وتابعي تقدّمها هنا خطوة بخطوة.</p>
            <Link href="/governance/ideas/new" className="mt-2 flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-white shadow-sm">تقديم فكرة جديدة</Link>
          </div>
        ) : primaryIdea ? (
          <div className="mt-7 rounded-2xl border border-border bg-surface p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><p className="text-sm font-bold text-foreground">{primaryIdea.titleAr}</p><p className="mt-1 text-xs text-muted">آخر تحديث: {primaryIdea.updatedAt.toLocaleDateString("ar-SA")}</p></div>
              <Link href={`/governance/ideas/${primaryIdea.id}`} className="flex h-9 items-center justify-center gap-2 rounded-lg border border-border px-3 text-xs font-bold text-foreground hover:bg-slate-50">عرض التفاصيل<ArrowLeft className="h-3.5 w-3.5" /></Link>
            </div>
            <p className="mt-4 text-sm leading-6 text-muted">{journey.statusHint}</p>
          </div>
        ) : null}
      </div>

      <aside className="rounded-[2rem] border border-primary/25 bg-surface p-5 shadow-lg shadow-primary/5 sm:p-6">
        <Badge variant={journey.closed ? "danger" : "primary"}>{hasStarted ? "حالة فكرتك" : "ابدئي الآن"}</Badge>
        <h2 className="mt-4 text-lg font-black leading-7">{hasStarted ? journey.statusLabel : "لا توجد فكرة مُقدَّمة بعد"}</h2>
        <p className="mt-2 text-sm leading-6 text-muted">{hasStarted ? journey.statusHint : "اضغطي زر \"تقديم فكرة جديدة\" أعلاه لتبدئي رحلتك."}</p>
        <div className="mt-5 space-y-3 rounded-2xl bg-slate-50 p-4 text-sm">
          <p className="flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /><span>عدد أفكارك: <b>{ideas.length}</b></span></p>
          {nearest ? <p className="flex items-center gap-2"><CalendarClock className="h-4 w-4 text-warning" /><span>الموعد: <b>{nearest.toLocaleDateString("ar-SA")}</b></span></p> : null}
        </div>
        {primaryIdea ? (
          <Link href={`/governance/ideas/${primaryIdea.id}`} className="mt-5 flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-white shadow-sm">عرض تفاصيل الفكرة <ArrowLeft className="h-4 w-4" /></Link>
        ) : (
          <Link href="/governance/ideas/new" className="mt-5 flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-white shadow-sm">تقديم فكرة جديدة <ArrowLeft className="h-4 w-4" /></Link>
        )}
      </aside>
    </section>
  </div>;
}

function Summary({ icon: Icon, label, value, tone }: { icon: typeof Sparkles; label: string; value: string; tone: "primary" | "secondary" | "warning" | "success" | "danger" }) {
  const tones = { primary: "bg-primary-50 text-primary", secondary: "bg-cyan-50 text-secondary", warning: "bg-warning-bg text-warning", success: "bg-success-bg text-success", danger: "bg-danger-bg text-danger" };
  return <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-border bg-surface p-4"><span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${tones[tone]}`}><Icon className="h-5 w-5" /></span><div className="min-w-0"><p className="text-[11px] font-semibold text-muted">{label}</p><p className="mt-1 line-clamp-2 text-sm font-black text-foreground">{value}</p></div></div>;
}
