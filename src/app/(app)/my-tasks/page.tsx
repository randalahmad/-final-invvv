import Link from "next/link";
import { ArrowLeft, CalendarDays, CheckCircle2, CheckSquare, Clock3, TriangleAlert } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { listMyTasks } from "@/modules/governance-workflow/service";
import { requireUser } from "@/server/authz";
import { requirementHref } from "@/modules/governance-workflow/links";

const typeLabels = { PREPARE: "مطلوب مني إعداد", REVIEW: "مطلوب مني مراجعة", APPROVE: "مطلوب مني اعتماد", AMEND: "مطلوب مني تعديل", RESPOND: "مطلوب مني الرد", FOLLOW_UP: "متابعة" } as const;
const priorityLabels = { LOW: "منخفضة", MEDIUM: "متوسطة", HIGH: "عالية", URGENT: "عاجلة" } as const;
const statusLabels: Record<string, string> = { OPEN: "مفتوحة", IN_PROGRESS: "قيد التنفيذ", WAITING: "بانتظار طرف آخر", COMPLETED: "مكتملة", CANCELLED: "ملغاة" };

function taskHref(task: Awaited<ReturnType<typeof listMyTasks>>[number]) {
  const base = task.sectionContribution ? `/my-contributions/${task.sectionContribution.id}` : requirementHref(task.assignment.requirement.code);
  const key = task.sourceKey?.split(":") ?? [];
  if (task.sourceKey?.startsWith("cooperation-activation:")) return `/activities/requirements/5-23-2-r4/activations/${key[1]}#activation-${key[2]}`;
  if (task.sourceKey?.startsWith("open-innovation:")) return `/activities/requirements/5-23-2-r3/events/${key[1]}#event-${key[2]}`;
  if (task.sourceKey?.startsWith("governance-corrective:")) return `${base}#corrective-${key[2]}`;
  if (task.sourceKey?.startsWith("governance-task:")) return `${base}#task-${key[2]}`;
  if (task.sourceKey?.startsWith("culture-activity:")) return `/governance/requirements/5-23-3-r3/activities/${key[1]}#task-${key[2]}`;
  if (task.sourceKey?.startsWith("mechanism-stage:")) return `/governance/requirements/5-23-3-r4/mechanism/${key[1]}#task-${key[3]}`;
  if (task.sourceKey?.startsWith("intake-response:")) return `/governance/requirements/5-23-3-r5/links/${key[1]}#response-${key[2]}`;
  if (task.methodologyApplicationId) return `${base}?methodologyCaseId=${task.methodologyApplicationId}#methodology-task-context`;
  if (task.activityId) return `${base}?activityId=${task.activityId}#activity-tasks`;
  if (task.committeeId) return `/governance/committees/${task.committeeId}#task-${task.id}`;
  return base;
}

export default async function MyTasksPage({ searchParams }: { searchParams: { filter?: string } }) {
  const actor = await requireUser();
  const tasks = await listMyTasks(actor);
  const now = new Date();
  const soon = new Date(now.getTime() + 7 * 86400000);
  const open = (task: (typeof tasks)[number]) => !["COMPLETED", "CANCELLED"].includes(task.status);
  const overdue = (task: (typeof tasks)[number]) => open(task) && !!task.dueDate && task.dueDate < now;
  const review = (task: (typeof tasks)[number]) => open(task) && ["REVIEW", "APPROVE"].includes(task.type);
  const action = (task: (typeof tasks)[number]) => open(task) && !review(task);
  const dueSoon = (task: (typeof tasks)[number]) => open(task) && !!task.dueDate && task.dueDate >= now && task.dueDate <= soon;
  const groups = { all: tasks, action: tasks.filter(action), review: tasks.filter(review), overdue: tasks.filter(overdue), completed: tasks.filter((task) => task.status === "COMPLETED") };
  const filter = searchParams.filter && searchParams.filter in groups ? searchParams.filter as keyof typeof groups : "all";
  const visible = groups[filter];
  const labels: Record<keyof typeof groups, string> = { all: "الكل", action: "تحتاج إجراء", review: "للمراجعة", overdue: "متأخرة", completed: "مكتملة" };
  const empty = filter === "overdue" ? "لا توجد مهام متأخرة." : filter === "review" ? "لا توجد مهام بانتظار المراجعة." : filter === "completed" ? "لا توجد مهام مكتملة بعد." : "لا توجد مهام ضمن هذه القائمة.";

  return <div className="flex flex-col gap-5"><PageHeader title="مهامي" description="مركز عمل شخصي للمهام المسندة إليك وإجراءاتها المرتبطة." />
    <section className="flex flex-wrap items-center gap-x-7 gap-y-3 rounded-2xl border border-border bg-surface px-4 py-3 text-sm">{groups.action.length ? <span><b className="text-lg">{groups.action.length}</b><span className="mr-1 text-muted">تحتاج إجراء</span></span> : null}{groups.review.length ? <span><b>{groups.review.length}</b><span className="mr-1 text-muted">للمراجعة</span></span> : null}{groups.overdue.length ? <span className="text-danger"><b>{groups.overdue.length}</b><span className="mr-1">متأخرة</span></span> : null}{tasks.filter(dueSoon).length ? <span className="text-warning"><b>{tasks.filter(dueSoon).length}</b><span className="mr-1">مستحقة قريبًا</span></span> : null}{groups.completed.length ? <span className="text-muted"><b>{groups.completed.length}</b><span className="mr-1">مكتملة</span></span> : null}{!tasks.length ? <span className="text-muted">لا توجد مهام مسندة إليك.</span> : null}</section>
    <nav className="flex gap-2 overflow-x-auto border-b pb-3" aria-label="تصفية المهام">{(Object.keys(groups) as (keyof typeof groups)[]).map((key) => <Link key={key} href={key === "all" ? "/my-tasks" : `/my-tasks?filter=${key}`} className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold ${filter === key ? "bg-primary-50 text-primary" : "text-muted hover:bg-slate-50"}`}>{labels[key]} <span className="mr-1">{groups[key].length}</span></Link>)}</nav>
    <section className="space-y-2">{visible.map((task) => { const isOverdue = overdue(task); const isSoon = dueSoon(task); const isReview = review(task); const complete = task.status === "COMPLETED"; const context = task.activity ? `النشاط: ${task.activity.nameAr}` : task.methodologyApplication ? `حالة المنهجية: ${task.methodologyApplication.nameAr}` : task.committee ? `الوحدة/اللجنة: ${task.committee.nameAr}` : task.assignment.department.nameAr; return <Card key={task.id} className={complete ? "opacity-65" : isOverdue ? "border-danger/35" : isReview ? "border-primary/30" : isSoon ? "border-warning/35" : ""}><CardContent className="p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><Badge variant={complete ? "neutral" : isOverdue ? "danger" : isReview ? "primary" : "warning"}>{statusLabels[task.status] ?? task.status}</Badge><span className="text-xs text-muted">{task.assignment.requirement.code} · {task.assignment.requirement.titleAr}</span></div><h2 className="mt-2 font-bold">{task.title}</h2><p className="mt-1 text-sm font-semibold text-primary">ماذا يجب أن أفعل؟ {task.nextAction ?? typeLabels[task.type]}</p><p className="mt-1 text-xs text-muted">{context} · {typeLabels[task.type]}</p></div><div className="flex flex-col items-start gap-2 text-xs sm:items-end"><Badge variant={task.priority === "URGENT" ? "danger" : task.priority === "HIGH" ? "warning" : "neutral"}>{priorityLabels[task.priority]}</Badge>{task.dueDate ? <span className={isOverdue ? "font-semibold text-danger" : isSoon ? "text-warning" : "text-muted"}><CalendarDays className="ml-1 inline h-3.5 w-3.5"/>{task.dueDate.toLocaleDateString("ar-SA")}{isOverdue ? " · متأخرة" : ""}</span> : <span className="text-muted">بدون موعد</span>}</div></div><div className="mt-3 flex items-center justify-between gap-3 border-t pt-3"><span className="text-xs text-muted">الإدارة: {task.assignment.department.nameAr}</span><Link href={taskHref(task)} className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white">{task.nextAction ?? "فتح المهمة"}<ArrowLeft className="h-3.5 w-3.5"/></Link></div></CardContent></Card> })}{!visible.length ? <Card><CardContent className="p-10 text-center text-sm text-muted"><CheckSquare className="mx-auto mb-2 h-7 w-7"/>{empty}</CardContent></Card> : null}</section>
  </div>;
}
