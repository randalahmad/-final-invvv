import Link from "next/link";
import { ArrowLeft, BellRing, CheckCircle2, FileWarning, ListChecks } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { buildPreviewHref, type PreviewPersonaKey } from "@/lib/ux-preview";
import { DGA_TOTALS, DGA_UNITS } from "../source-of-truth";

function href(path: string, persona?: PreviewPersonaKey) { return persona ? buildPreviewHref(path, persona) : path; }

export function DgaReadinessDashboard({ persona }: { persona?: PreviewPersonaKey }) {
  const visibleUnits = persona === "viewer" ? [] : persona === "partner" ? DGA_UNITS.filter((unit) => ["5.23.1", "5.23.2", "5.24.1"].includes(unit.code)) : DGA_UNITS;
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-primary/15 bg-gradient-to-l from-primary-50 to-white p-6 dark:from-primary/10 dark:to-surface-dark">
        <Badge variant="primary">جاهزية الابتكار المؤسسي</Badge>
        <h1 className="mt-3 max-w-4xl text-2xl font-bold leading-relaxed text-slate-950 dark:text-white">ما مدى جاهزية الجهة لتطبيق متطلبات الابتكار المؤسسي؟</h1>
        <p className="mt-2 text-sm text-muted">متابعة موحدة للمتطلبات والأدلة والمسؤوليات والإجراءات التالية ضمن الوحدات الخمس.</p>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["إجمالي الجاهزية", `${DGA_TOTALS.readiness}%`, ListChecks],
          ["المتطلبات المكتملة", `${DGA_TOTALS.completed} من ${DGA_TOTALS.requirements}`, CheckCircle2],
          ["الأدلة الناقصة", String(DGA_TOTALS.missingEvidence), FileWarning],
          ["الإجراءات المطلوبة", String(DGA_TOTALS.actionRequired), BellRing],
        ].map(([label, value, Icon]) => (
          <Card key={String(label)}><CardContent className="p-5"><Icon className="h-5 w-5 text-primary" /><p className="mt-4 text-xs text-muted">{String(label)}</p><p className="mt-1 text-2xl font-bold">{String(value)}</p></CardContent></Card>
        ))}
      </div>

      {visibleUnits.length ? <section>
        <div className="mb-3 flex items-end justify-between"><div><h2 className="text-lg font-bold">جاهزية الوحدات المعيارية</h2><p className="text-xs text-muted">اختر وحدة للانتقال إلى متطلبات التطبيق والأدلة.</p></div><Badge variant="neutral">تقدير تشغيلي داخلي</Badge></div>
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {visibleUnits.map((unit) => {
            const completed = unit.requirements.filter((item) => item.status === "COMPLETED").length;
            return <Link key={unit.code} href={href(unit.href, persona)} className="group"><Card className="h-full transition hover:border-primary/40 hover:shadow-md"><CardHeader className="pb-3"><div className="flex items-start justify-between gap-3"><div><Badge variant="primary">{unit.code}</Badge><CardTitle className="mt-2 text-base">{unit.name}</CardTitle></div><span className="text-2xl font-bold text-primary">{unit.readiness}%</span></div></CardHeader><CardContent className="space-y-4"><Progress value={unit.readiness} /><div className="grid grid-cols-3 gap-2 text-center text-xs"><div className="rounded-lg bg-slate-50 p-2 dark:bg-white/5"><strong className="block text-sm">{completed}/{unit.requirements.length || "—"}</strong>مكتملة</div><div className="rounded-lg bg-slate-50 p-2 dark:bg-white/5"><strong className="block text-sm text-warning">{unit.missingEvidence}</strong>أدلة ناقصة</div><div className="rounded-lg bg-slate-50 p-2 dark:bg-white/5"><strong className="block text-sm text-danger">{unit.actionRequired}</strong>تحتاج إجراء</div></div><div className="flex items-center justify-between border-t pt-3 text-xs text-muted"><span>آخر تحديث: {unit.lastUpdate}</span><ArrowLeft className="h-4 w-4 transition group-hover:-translate-x-1" /></div></CardContent></Card></Link>;
          })}
        </div>
      </section> : <Card><CardContent className="p-6"><h2 className="font-bold">لوحة الاطلاع المنشورة</h2><p className="mt-1 text-sm text-muted">يعرض دور المطّلع مؤشرات وتقارير الجاهزية المنشورة فقط دون الوصول إلى مساحات تنفيذ المتطلبات.</p></CardContent></Card>}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader><CardTitle>أحدث التنبيهات والمواعيد</CardTitle></CardHeader><CardContent className="space-y-3">{[["استكمال دليل المبادرات الرقمية","5.23.1 · خلال 3 أيام"],["محضر اجتماع التعاون الربع سنوي","5.23.2 · خلال 7 أيام"],["مراجعة تقرير نشاط نشر الثقافة","5.23.3 · توجد ملاحظات"]].map(([title, meta])=><div key={title} className="flex items-center justify-between rounded-lg border p-3"><div><p className="text-sm font-semibold">{title}</p><p className="text-xs text-muted">{meta}</p></div><Badge variant="warning">متابعة</Badge></div>)}</CardContent></Card>
        <Card><CardHeader><CardTitle>وصول سريع للمتطلبات غير المكتملة</CardTitle></CardHeader><CardContent className="space-y-2">{visibleUnits.length ? visibleUnits.slice(0,3).flatMap((unit)=>unit.requirements.filter((item)=>item.status!=="COMPLETED").slice(0,1).map((item)=><Link key={item.id} href={href(`${unit.href}/requirements/${item.id}`,persona)} className="flex items-center justify-between rounded-lg border p-3 text-sm font-semibold hover:border-primary/40"><span><small className="ml-2 text-primary">{unit.code}.{item.number}</small>{item.title}</span><ArrowLeft className="h-4 w-4" /></Link>)) : <p className="rounded-lg bg-slate-50 p-4 text-sm text-muted dark:bg-white/5">لا توجد إجراءات تنفيذية ضمن صلاحية المطّلع.</p>}</CardContent></Card>
      </div>
    </div>
  );
}
