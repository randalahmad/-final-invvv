import Link from "next/link";
import { Download, FileSpreadsheet, Link2, Plus, Route, Search, TriangleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/shared/page-header";
import {
  IMPLEMENTATION_LABELS,
  IMPLEMENTATION_STATUSES,
  MATURITY_LABELS,
  MATURITY_STAGES,
  RECORD_STATUS_LABELS,
  SOLUTION_SOURCES,
  SOURCE_LABELS,
  PORTFOLIO_STATUS_LABELS,
} from "@/modules/solutions/schema";
import { listSolutionFilters, listSolutionsInScope } from "@/modules/solutions/service";
import { can, getAccessContext, requirePermission } from "@/server/authz";

export const metadata = { title: "سجل الحلول الابتكارية" };
const control = "rounded-lg border border-border bg-surface px-3 py-2 text-xs dark:border-border-dark dark:bg-surface-dark";

export default async function SolutionsPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  await requirePermission("solution.view");
  const actor = (await getAccessContext())!;
  const filters = {
    q: searchParams.q,
    maturityStage: searchParams.maturityStage,
    implementationStatus: searchParams.implementationStatus,
    owningDepartmentId: searchParams.owningDepartmentId,
    source: searchParams.source,
    includeArchived: searchParams.archived === "1",
  };
  const [solutions, options] = await Promise.all([listSolutionsInScope(actor, filters), listSolutionFilters(actor)]);

  const operational=solutions.filter(x=>x.portfolioStatus==="OPERATIONAL").length;
  const developing=solutions.filter(x=>["IN_PROGRESS","UNDER_REVIEW"].includes(x.portfolioStatus)).length;
  const incomplete=solutions.filter(x=>x.completionPct<70).length;
  const duplicates=solutions.filter(x=>x.duplicateOfId).length;
  return <div className="flex flex-col gap-5">
    <PageHeader title="محفظة الحلول الابتكارية — 5.24.1" description="حصر مؤسسي تشغيلي يجمع الحلول من مصادرها، يحدد الملكية ويتابع اكتمالها ويمنع إنشاء سجلات مؤسسية مكررة." action={can(actor, "solution.create") ? <Button asChild><Link href="/solutions/new"><Plus className="h-4 w-4" />إضافة حل ابتكاري</Link></Button> : undefined} />
    {can(actor,"solution.create")?<details className="group"><summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold text-muted hover:text-primary">خيارات الإضافة والاستيراد</summary><div className="mt-2 flex flex-wrap gap-2"><Button asChild size="sm" variant="outline"><Link href="/solutions/intake-links"><Link2 className="h-4 w-4"/>إنشاء رابط استقبال</Link></Button><Button asChild size="sm" variant="outline"><Link href="/solutions/import"><FileSpreadsheet className="h-4 w-4"/>استيراد Excel / CSV</Link></Button><Button asChild size="sm" variant="outline"><Link href="/solutions/from-existing"><Route className="h-4 w-4"/>إضافة من مخرجات سابقة</Link></Button><Button asChild size="sm" variant="outline"><Link href="/solutions/export"><Download className="h-4 w-4"/>تصدير السجل</Link></Button></div></details>:null}
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-border bg-surface px-4 py-3 text-sm"><span><b className="text-lg">{solutions.length}</b><span className="mr-1 text-muted">إجمالي الحلول</span></span><span><b>{operational}</b><span className="mr-1 text-muted">تشغيلي</span></span><span><b>{developing}</b><span className="mr-1 text-muted">قيد التطوير أو المراجعة</span></span>{incomplete?<span className="text-warning"><b>{incomplete}</b><span className="mr-1">يحتاج استكمال</span></span>:null}{duplicates?<span className="text-warning"><b>{duplicates}</b><span className="mr-1">تكرار محتمل</span></span>:null}</div>
    <form method="GET" className="flex flex-wrap items-end gap-2 rounded-2xl border border-border bg-surface p-3 dark:border-border-dark dark:bg-surface-dark">
      <div className="relative min-w-52 flex-1"><Search className="absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"/><input className={`${control} w-full pe-9`} name="q" defaultValue={searchParams.q} placeholder="ابحث عن حل…" /></div>
      <select className={control} name="maturityStage" defaultValue={searchParams.maturityStage}><option value="">كل مراحل النضج</option>{MATURITY_STAGES.map((x)=><option key={x} value={x}>{MATURITY_LABELS[x]}</option>)}</select>
      <select className={control} name="implementationStatus" defaultValue={searchParams.implementationStatus}><option value="">كل حالات التنفيذ</option>{IMPLEMENTATION_STATUSES.map((x)=><option key={x} value={x}>{IMPLEMENTATION_LABELS[x]}</option>)}</select>
      <select className={control} name="owningDepartmentId" defaultValue={searchParams.owningDepartmentId}><option value="">كل الإدارات</option>{options.departments.map((x)=><option key={x.id} value={x.id}>{x.nameAr}</option>)}</select>
      <select className={control} name="source" defaultValue={searchParams.source}><option value="">كل المصادر</option>{SOLUTION_SOURCES.map((x)=><option key={x} value={x}>{SOURCE_LABELS[x]}</option>)}</select>
      <Button size="sm" variant="outline">تطبيق</Button>
    </form>
    <Card><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full min-w-[1150px] text-start text-xs"><thead><tr className="border-b text-muted"><th className="p-3 text-start">الحل</th><th className="p-3 text-start">المالك</th><th className="p-3 text-start">النضج والتنفيذ</th><th className="p-3 text-start">الجاهزية</th><th className="p-3 text-start">آخر تحديث</th><th className="p-3 text-start">الإجراء التالي</th></tr></thead><tbody>
      {solutions.map((solution)=><tr key={solution.id} className="border-b last:border-0 hover:bg-slate-50/60"><td className="p-3"><Link className="font-semibold text-primary hover:underline" href={`/solutions/${solution.id}`}>{solution.nameAr}</Link><p className="mt-1 text-muted">{SOURCE_LABELS[solution.source]}</p>{solution.duplicateOfId?<p className="mt-1 flex items-center gap-1 text-amber-700"><TriangleAlert className="h-3 w-3"/>قد يكون مسجلًا مسبقًا</p>:null}</td><td className="p-3 text-muted">{solution.owningDepartment?.nameAr??"—"}<p>{solution.owner?.name??"بدون مالك"}</p></td><td className="p-3"><p>{MATURITY_LABELS[solution.maturityStage]}</p><Badge className="mt-1" variant="neutral">{PORTFOLIO_STATUS_LABELS[solution.portfolioStatus]} · {IMPLEMENTATION_LABELS[solution.implementationStatus]}</Badge></td><td className="p-3"><div className="min-w-28"><Progress value={solution.completionPct}/><span className="mt-1 block text-muted">{solution.completionPct}%</span></div></td><td className="p-3 text-muted">{solution.updatedAt ? new Date(solution.updatedAt).toLocaleDateString("ar-SA") : "—"}</td><td className="p-3"><Link className="font-semibold text-primary hover:underline" href={`/solutions/${solution.id}#next-action`}>{solution.nextAction??"استكمال بيانات الحل"}</Link></td></tr>)}
      {!solutions.length && <tr><td colSpan={8} className="p-10 text-center text-muted">لا توجد حلول ضمن نطاقك.</td></tr>}
    </tbody></table></div></CardContent></Card>
  </div>;
}
