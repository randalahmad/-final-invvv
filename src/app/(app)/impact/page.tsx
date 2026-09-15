import Link from "next/link";
import { ArrowLeft, BarChart3, CheckCircle2, Clock3 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { listImpactSolutions } from "@/modules/impact/service";
import { getAccessContext, requirePermission } from "@/server/authz";

export const metadata = { title: "قياس أثر الحلول" };

export default async function ImpactPage() {
  await requirePermission("impact.view");
  const actor = (await getAccessContext())!;
  const solutions = await listImpactSolutions(actor);
  const rows = solutions.map((solution) => {
    const measurements = solution.impactIndicators.flatMap((indicator) => indicator.measurements);
    const latest = measurements.sort((a, b) => (b.periodEnd?.getTime() ?? 0) - (a.periodEnd?.getTime() ?? 0))[0];
    return { solution, measurements, latest };
  });
  const measured = rows.filter((row) => row.measurements.length > 0).length;
  const awaiting = rows.filter((row) => row.measurements.length === 0).length;
  const verified = rows.filter((row) => row.measurements.some((measurement) => measurement.verificationStatus === "VERIFIED")).length;
  const indicators = rows.reduce((sum, row) => sum + row.solution.impactIndicators.length, 0);

  return <div className="flex flex-col gap-5">
    <PageHeader title="قياس أثر الحلول (5.24.2)" description="مركز تشغيلي لمتابعة مؤشرات الأثر والقياسات المسجلة للحلول ضمن نطاقك." />
    <section className="flex flex-wrap items-center gap-x-7 gap-y-3 rounded-2xl border border-border bg-surface px-4 py-3 text-sm">
      <span><b className="text-lg">{measured}</b><span className="mr-1 text-muted">حلول لها قياسات</span></span>
      <span><b className="text-lg">{awaiting}</b><span className="mr-1 text-muted">لم يبدأ قياس أثرها</span></span>
      <span><b>{indicators}</b><span className="mr-1 text-muted">مؤشرات أثر مسجلة</span></span>
      {verified ? <span className="text-success"><b>{verified}</b><span className="mr-1">حلول بقياسات متحقق منها</span></span> : null}
    </section>
    <Card><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full min-w-[1080px] text-xs"><thead><tr className="border-b text-muted"><th className="p-3 text-start">الحل</th><th className="p-3 text-start">المالك</th><th className="p-3 text-start">حالة القياس</th><th className="p-3 text-start">المؤشرات</th><th className="p-3 text-start">آخر قياس</th><th className="p-3 text-start">حالة التحقق</th><th className="p-3 text-start">الإجراء التالي</th></tr></thead><tbody>
      {rows.map(({solution, measurements, latest}) => { const started = measurements.length > 0; const hasVerified = measurements.some((measurement) => measurement.verificationStatus === "VERIFIED"); return <tr key={solution.id} className="border-b last:border-0 hover:bg-slate-50/60"><td className="p-3"><Link className="font-semibold text-primary hover:underline" href={`/impact/${solution.id}`}>{solution.nameAr}</Link><p className="mt-1 text-muted">{solution.owningDepartment?.organization.nameAr ?? "—"} / {solution.owningDepartment?.nameAr ?? "—"}</p></td><td className="p-3">{solution.owner?.name ?? "غير محدد"}</td><td className="p-3"><Badge variant={started ? "success" : "warning"}>{started ? "قياس مسجل" : "لم يبدأ قياس الأثر"}</Badge></td><td className="p-3">{solution.impactIndicators.length}</td><td className="p-3">{latest?.periodEnd?.toLocaleDateString("ar-SA") ?? "—"}<p className="mt-1 text-muted">{latest?.actualValue?.toString() ?? "لا توجد قيمة فعلية"}</p></td><td className="p-3"><span className="inline-flex items-center gap-1"><CheckCircle2 className={`h-3.5 w-3.5 ${hasVerified ? "text-success" : "text-muted"}`} />{hasVerified ? "تم التحقق" : started ? "بانتظار التحقق" : "—"}</span></td><td className="p-3"><Link className="inline-flex items-center gap-1 font-semibold text-primary hover:underline" href={`/impact/${solution.id}`}>{started ? "فتح ملف الأثر" : "بدء القياس"}<ArrowLeft className="h-3.5 w-3.5"/></Link></td></tr> })}
      {!rows.length && <tr><td colSpan={7} className="p-12 text-center text-muted"><BarChart3 className="mx-auto mb-2 h-8 w-8"/>لا توجد حلول متاحة ضمن نطاقك.</td></tr>}
    </tbody></table></div></CardContent></Card>
    {rows.some((row) => row.measurements.length) ? <section className="rounded-2xl border border-border bg-surface p-4"><div className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-primary"/><h2 className="font-bold">قياسات حديثة</h2></div><div className="mt-3 grid gap-2 md:grid-cols-2">{rows.filter((row) => row.latest).slice(0, 6).map(({solution, latest}) => <Link key={solution.id} href={`/impact/${solution.id}`} className="flex items-center justify-between rounded-xl border px-3 py-2 text-xs hover:border-primary/50"><span><b>{solution.nameAr}</b><span className="mr-2 text-muted">{latest?.periodEnd?.toLocaleDateString("ar-SA")}</span></span><span>{latest?.actualValue?.toString() ?? "—"}</span></Link>)}</div></section> : null}
  </div>;
}
