import Link from "next/link";
import { ArrowLeft, CheckCircle2, CircleDashed, Clock3, FileWarning, ListTodo, TriangleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { LiveReadiness } from "../live-readiness";

type Work = { mine: number; review: number; approve: number; returned: number; pendingEvidence: number; overdue: number; upcoming: number };
type Unit = LiveReadiness["units"][number];

function stageState(unit: Unit, current: Unit) {
  if (unit.total > 0 && unit.completed === unit.total) return { key: "complete", label: "مكتمل", icon: CheckCircle2, tone: "text-success border-success/30 bg-success-bg/50" };
  if (unit.overdue > 0) return { key: "overdue", label: "متأخر", icon: TriangleAlert, tone: "text-danger border-danger/30 bg-danger-bg/50" };
  if (unit.missingEvidence > 0) return { key: "blocked", label: "يتطلب استكمالاً", icon: FileWarning, tone: "text-warning border-warning/30 bg-warning-bg/50" };
  if (unit.code === current.code) return { key: "current", label: "الحالي", icon: CircleDashed, tone: "text-primary border-primary bg-primary-50" };
  return { key: "upcoming", label: "قادم", icon: Clock3, tone: "text-foreground-secondary border-border bg-surface" };
}

export function LiveReadinessDashboard({ data, work, selectedStage }: { data: LiveReadiness; work?: Work; selectedStage?: string }) {
  const attentionOrder = data.units.slice().sort((a, b) => (b.overdue * 100 + b.missingEvidence) - (a.overdue * 100 + a.missingEvidence));
  const current = attentionOrder[0] ?? data.units[0]!;
  const selected = data.units.find((unit) => unit.code === selectedStage) ?? current;
  const selectedState = stageState(selected, current);
  const selectedAction = selected.overdue > 0
    ? { href: "/my-tasks", label: "معالجة المهام المتأخرة" }
    : selected.missingEvidence > 0
      ? { href: `/evidence-matrix?unit=${encodeURIComponent(selected.code)}`, label: "استكمال الأدلة المطلوبة" }
      : { href: selected.href, label: selectedState.key === "complete" ? "عرض تفاصيل الوحدة" : "متابعة متطلبات الوحدة" };
  const actionable = work ? [
    { label: "مواعيد متأخرة", count: work.overdue, href: "/my-tasks", icon: TriangleAlert, tone: "danger" },
    { label: "بانتظار مراجعتي", count: work.review, href: "/reviews", icon: ListTodo, tone: "warning" },
    { label: "بانتظار اعتمادي", count: work.approve, href: "/reviews", icon: CheckCircle2, tone: "primary" },
    { label: "مهام مسندة إليّ", count: work.mine, href: "/my-tasks", icon: ListTodo, tone: "primary" },
    { label: "أدلة بانتظار الاعتماد", count: work.pendingEvidence, href: "/evidence-matrix", icon: FileWarning, tone: "warning" },
  ].filter((item) => item.count > 0) : [];

  return <div className="mx-auto flex max-w-[1500px] flex-col gap-6 pb-6">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">لوحة العمل</p><h1 className="mt-1 text-xl font-bold text-foreground sm:text-2xl">ملخص اليوم</h1></div></header>

    <section aria-labelledby="action-now"><div className="mb-4 flex items-end justify-between gap-4"><div><p className="eyebrow">الأولوية التشغيلية</p><h2 id="action-now" className="mt-1 text-2xl font-bold text-foreground">ماذا تحتاج أن تفعل الآن؟</h2></div><Link href="/my-tasks" className="inline-flex items-center gap-1 text-sm font-semibold text-primary">فتح كل المهام <ArrowLeft className="h-4 w-4" /></Link></div>{actionable.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{actionable.map((item) => { const Icon = item.icon; const visual = item.tone === "danger" ? "border-danger/30 bg-danger-bg/55 text-danger" : item.tone === "warning" ? "border-warning/30 bg-warning-bg/55 text-warning" : "border-primary/20 bg-primary-50/55 text-primary"; return <Link href={item.href} key={item.label} className={`group flex min-h-28 flex-col justify-between rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:shadow-card ${visual}`}><div className="flex items-start justify-between gap-3"><Icon className="h-5 w-5" /><b className="text-2xl">{item.count}</b></div><div><p className="text-sm font-bold text-foreground">{item.label}</p><span className="mt-1 flex items-center gap-1 text-xs font-semibold">عرض الإجراء <ArrowLeft className="h-3.5 w-3.5 transition group-hover:-translate-x-0.5" /></span></div></Link>; })}</div> : <div className="rounded-2xl border border-success/25 bg-success-bg/45 px-5 py-4 text-sm text-success"><CheckCircle2 className="ml-2 inline h-4 w-4" />لا توجد مهام عاجلة أو عناصر بانتظار إجراءك الآن.</div>}</section>

    <section aria-labelledby="journey-title" className="rounded-2xl border border-border bg-surface p-5 sm:p-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow">أين نحن الآن؟</p><h2 id="journey-title" className="mt-1 text-xl font-bold text-foreground">رحلة الجاهزية المؤسسية</h2></div><div className="flex items-center gap-2 text-[11px] text-muted"><span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-success" /> مكتمل</span><span className="inline-flex items-center gap-1"><TriangleAlert className="h-3.5 w-3.5 text-danger" /> متأخر</span><span className="inline-flex items-center gap-1"><FileWarning className="h-3.5 w-3.5 text-warning" /> متعثر</span></div></div><ol className="relative mt-5 grid grid-cols-5 gap-1 before:absolute before:left-[10%] before:right-[10%] before:top-5 before:h-px before:bg-border">{data.units.map((unit, index) => { const state = stageState(unit, current); const Icon = state.icon; const isSelected = unit.code === selected.code; return <li key={unit.code} className="relative z-10 min-w-0"><Link href={`/dashboard?stage=${encodeURIComponent(unit.code)}`} aria-current={isSelected ? "step" : undefined} className={`group flex flex-col items-center text-center outline-none ${isSelected ? "scale-[1.02]" : ""}`}><span className={`grid h-10 w-10 place-items-center rounded-full border-2 transition group-hover:scale-105 ${state.tone}`}><Icon className="h-4 w-4" /></span><b className="mt-2 line-clamp-2 text-[10px] font-semibold text-foreground sm:text-xs">{unit.name}</b><span className="mt-0.5 text-[10px] text-muted">{unit.readiness}%</span></Link></li>; })}</ol><div className={`mt-4 flex flex-wrap items-center justify-between gap-4 rounded-xl border px-4 py-3 ${selectedState.tone}`}><div><div className="flex items-center gap-2"><Badge variant={selectedState.key === "overdue" ? "danger" : selectedState.key === "blocked" ? "warning" : selectedState.key === "complete" ? "success" : "primary"}>{selectedState.label}</Badge><b className="text-sm text-foreground">{selected.name}</b></div><p className="mt-1 text-xs text-foreground-secondary">{selected.completed}/{selected.total} مكتمل · {selected.missingEvidence} دليل ناقص · {selected.overdue} موعد متأخر</p></div><Link href={selectedAction.href} className="inline-flex items-center gap-2 rounded-lg bg-surface px-3 py-2 text-xs font-bold text-primary ring-1 ring-current/10">{selectedAction.label} <ArrowLeft className="h-4 w-4" /></Link></div></section>

    <section aria-labelledby="progress-summary" className="grid gap-5 border-y border-border py-5 lg:grid-cols-[1.4fr_1fr]"><div><p className="eyebrow">التقدم والمؤشرات</p><h2 id="progress-summary" className="mt-1 text-xl font-bold text-foreground">جاهزية المنصة</h2><div className="mt-4 flex items-center gap-4"><b className="text-4xl tracking-tight text-primary">{data.overall}%</b><div className="min-w-0 flex-1"><Progress value={data.overall} height={8} /><p className="mt-2 text-xs text-muted">{data.completed} سجل مكتمل عبر الوحدات الخمس</p></div></div></div><dl className="grid grid-cols-3 self-end divide-x divide-x-reverse divide-border text-center"><div><dt className="text-[11px] text-muted">مكتمل</dt><dd className="mt-1 text-xl font-bold text-foreground">{data.completed}</dd></div><div><dt className="text-[11px] text-muted">دليل ناقص</dt><dd className="mt-1 text-xl font-bold text-foreground">{data.missingEvidence}</dd></div><div><dt className="text-[11px] text-muted">متأخر</dt><dd className="mt-1 text-xl font-bold text-foreground">{data.overdue}</dd></div></dl></section>

    <details className="group rounded-2xl border border-border bg-surface"><summary className="flex cursor-pointer list-none items-center justify-between p-5 text-sm font-bold text-foreground">تفاصيل الجاهزية حسب الوحدة <ArrowLeft className="h-4 w-4 text-primary transition group-open:-rotate-90" /></summary><div className="grid gap-3 border-t border-border p-5 sm:grid-cols-2 xl:grid-cols-5">{data.units.map((unit) => <Link key={unit.code} href={unit.href} className="rounded-xl border border-border p-3 text-xs transition hover:border-primary/30"><span className="font-bold text-primary">{unit.code}</span><p className="mt-2 font-semibold text-foreground">{unit.name}</p><Progress className="mt-3" value={unit.readiness} height={5} /></Link>)}</div></details>
  </div>;
}
