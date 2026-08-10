import Link from "next/link";
import { Plus, Search } from "lucide-react";

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

  return <div className="flex flex-col gap-5">
    <PageHeader title="سجل الحلول الابتكارية (5.24.1)" description="سجل تشغيلي موحّد للحلول ومصادرها وملكيتها ونضجها وتنفيذها وفق متطلبات تطبيق معيار 5.24.1 (حصر الحلول وتصميمها وتنفيذها)." action={can(actor, "solution.create") ? <Button asChild><Link href="/solutions/new"><Plus className="h-4 w-4" />تسجيل حل</Link></Button> : undefined} />
    <form method="GET" className="flex flex-wrap items-end gap-2 rounded-2xl border border-border bg-surface p-3 dark:border-border-dark dark:bg-surface-dark">
      <div className="relative min-w-52 flex-1"><Search className="absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"/><input className={`${control} w-full pe-9`} name="q" defaultValue={searchParams.q} placeholder="ابحث عن حل…" /></div>
      <select className={control} name="maturityStage" defaultValue={searchParams.maturityStage}><option value="">كل مراحل النضج</option>{MATURITY_STAGES.map((x)=><option key={x} value={x}>{MATURITY_LABELS[x]}</option>)}</select>
      <select className={control} name="implementationStatus" defaultValue={searchParams.implementationStatus}><option value="">كل حالات التنفيذ</option>{IMPLEMENTATION_STATUSES.map((x)=><option key={x} value={x}>{IMPLEMENTATION_LABELS[x]}</option>)}</select>
      <select className={control} name="owningDepartmentId" defaultValue={searchParams.owningDepartmentId}><option value="">كل الإدارات</option>{options.departments.map((x)=><option key={x.id} value={x.id}>{x.nameAr}</option>)}</select>
      <select className={control} name="source" defaultValue={searchParams.source}><option value="">كل المصادر</option>{SOLUTION_SOURCES.map((x)=><option key={x} value={x}>{SOURCE_LABELS[x]}</option>)}</select>
      <Button size="sm" variant="outline">تطبيق</Button>
    </form>
    <Card><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-start text-xs"><thead><tr className="border-b text-muted"><th className="p-3 text-start">الحل</th><th className="p-3 text-start">الجهة / الإدارة المالكة</th><th className="p-3 text-start">المصدر</th><th className="p-3 text-start">النضج</th><th className="p-3 text-start">التنفيذ</th><th className="p-3 text-start">الحالة</th><th className="p-3 text-start">البيانات</th><th className="p-3 text-start">الأدلة</th></tr></thead><tbody>
      {solutions.map((solution)=><tr key={solution.id} className="border-b last:border-0"><td className="p-3"><Link className="font-semibold text-primary hover:underline" href={`/solutions/${solution.id}`}>{solution.nameAr}</Link></td><td className="p-3 text-muted">{solution.owningDepartment ? `${solution.owningDepartment.organization.nameAr} / ${solution.owningDepartment.nameAr}` : "—"}</td><td className="p-3">{SOURCE_LABELS[solution.source]}</td><td className="p-3">{MATURITY_LABELS[solution.maturityStage]}</td><td className="p-3">{IMPLEMENTATION_LABELS[solution.implementationStatus]}</td><td className="p-3"><Badge variant={solution.status === "ACTIVE" ? "success" : "neutral"}>{RECORD_STATUS_LABELS[solution.status]}</Badge></td><td className="p-3"><Progress value={solution.completionPct}/><span>{solution.completionPct}%</span></td><td className="p-3"><Progress value={solution.evidenceReadinessPct}/><span>{solution.evidenceReadinessPct}%</span></td></tr>)}
      {!solutions.length && <tr><td colSpan={8} className="p-10 text-center text-muted">لا توجد حلول ضمن نطاقك.</td></tr>}
    </tbody></table></div></CardContent></Card>
  </div>;
}
