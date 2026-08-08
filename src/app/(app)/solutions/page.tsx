import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Search } from "lucide-react";

import { requirePermission, getAccessContext, can } from "@/server/authz";
import { listSolutionsInScope, listSolutionFilters } from "@/modules/solutions/service";
import {
  MATURITY_STAGES,
  IMPLEMENTATION_STATUSES,
  SOLUTION_SOURCES,
  MATURITY_LABELS,
  IMPLEMENTATION_LABELS,
  SOURCE_LABELS,
  RECORD_STATUS_LABELS,
} from "@/modules/solutions/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { readinessColor } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";

export const metadata: Metadata = { title: "الحلول الابتكارية" };

const selectClass =
  "rounded-lg border border-border bg-surface px-3 py-2 text-[12.5px] outline-none focus:border-primary dark:border-border-dark dark:bg-surface-dark";

export default async function SolutionsPage({
  searchParams,
}: {
  searchParams: { q?: string; maturityStage?: string; implementationStatus?: string; owningDepartmentId?: string; source?: string; archived?: string };
}) {
  await requirePermission("solution.view");
  const ctx = (await getAccessContext())!;

  const filters = {
    q: searchParams.q,
    maturityStage: searchParams.maturityStage,
    implementationStatus: searchParams.implementationStatus,
    owningDepartmentId: searchParams.owningDepartmentId,
    source: searchParams.source,
    includeArchived: searchParams.archived === "1",
  };
  const [solutions, filterOptions] = await Promise.all([
    listSolutionsInScope(ctx, filters),
    listSolutionFilters(ctx),
  ]);
  const canCreate = can(ctx, "solution.create");

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="الحلول الابتكارية"
        description="محفظة الحلول المسجلة ومراحل نضجها وتنفيذها ضمن نطاق صلاحياتك."
        action={canCreate ? (
          <Button asChild>
            <Link href="/solutions/new">
              <Plus className="h-4 w-4" />
              تسجيل حل
            </Link>
          </Button>
        ) : undefined}
      />

      {/* Server-rendered search + filters (GET) */}
      <form method="GET" className="flex flex-wrap items-end gap-2 rounded-2xl border border-border bg-surface p-3 dark:border-border-dark dark:bg-surface-dark">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input name="q" defaultValue={searchParams.q ?? ""} placeholder="بحث بالاسم أو الوصف…" className={`${selectClass} w-full pe-9`} />
        </div>
        <select name="maturityStage" defaultValue={searchParams.maturityStage ?? ""} className={selectClass} aria-label="مرحلة النضج">
          <option value="">كل مراحل النضج</option>
          {MATURITY_STAGES.map((m) => <option key={m} value={m}>{MATURITY_LABELS[m]}</option>)}
        </select>
        <select name="implementationStatus" defaultValue={searchParams.implementationStatus ?? ""} className={selectClass} aria-label="حالة التنفيذ">
          <option value="">كل حالات التنفيذ</option>
          {IMPLEMENTATION_STATUSES.map((s) => <option key={s} value={s}>{IMPLEMENTATION_LABELS[s]}</option>)}
        </select>
        <select name="owningDepartmentId" defaultValue={searchParams.owningDepartmentId ?? ""} className={selectClass} aria-label="الإدارة">
          <option value="">كل الإدارات</option>
          {filterOptions.departments.map((d) => <option key={d.id} value={d.id}>{d.nameAr}</option>)}
        </select>
        <select name="source" defaultValue={searchParams.source ?? ""} className={selectClass} aria-label="المصدر">
          <option value="">كل المصادر</option>
          {SOLUTION_SOURCES.map((s) => <option key={s} value={s}>{SOURCE_LABELS[s]}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-[12px] text-muted">
          <input type="checkbox" name="archived" value="1" defaultChecked={searchParams.archived === "1"} className="h-4 w-4 accent-primary" />
          إظهار المؤرشفة
        </label>
        <Button type="submit" size="sm" variant="outline">تطبيق</Button>
      </form>

      {solutions.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-2 px-6 py-16 text-center">
            <p className="text-sm text-muted">لا توجد حلول مطابقة ضمن نطاقك.</p>
            {canCreate && (
              <Button asChild size="sm" variant="outline">
                <Link href="/solutions/new">تسجيل أول حل</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-start">
                <thead>
                  <tr className="border-b border-border text-[11.5px] text-muted dark:border-border-dark">
                    <th className="px-4 py-2.5 text-start font-medium">الحل</th>
                    <th className="px-4 py-2.5 text-start font-medium">المسؤول</th>
                    <th className="px-4 py-2.5 text-start font-medium">المصدر</th>
                    <th className="px-4 py-2.5 text-start font-medium">مرحلة النضج</th>
                    <th className="px-4 py-2.5 text-start font-medium">حالة التنفيذ</th>
                    <th className="px-4 py-2.5 text-start font-medium">الحالة</th>
                    <th className="px-4 py-2.5 text-start font-medium">اكتمال البيانات</th>
                  </tr>
                </thead>
                <tbody>
                  {solutions.map((s) => (
                    <tr key={s.id} className="border-b border-border/60 last:border-0 hover:bg-slate-50/60 dark:border-border-dark/60 dark:hover:bg-white/5">
                      <td className="px-4 py-2.5">
                        <Link href={`/solutions/${s.id}`} className="text-[13px] font-semibold text-primary hover:underline">
                          {s.nameAr}
                        </Link>
                        {s.ideaId && <span className="ms-1.5 text-[10.5px] text-muted">(من فكرة)</span>}
                      </td>
                      <td className="px-4 py-2.5 text-[12px] text-muted">{s.owningDepartment?.nameAr ?? "—"}</td>
                      <td className="px-4 py-2.5 text-[12px] text-muted">{SOURCE_LABELS[s.source]}</td>
                      <td className="px-4 py-2.5 text-[12px] text-muted">{MATURITY_LABELS[s.maturityStage]}</td>
                      <td className="px-4 py-2.5 text-[12px] text-muted">{IMPLEMENTATION_LABELS[s.implementationStatus]}</td>
                      <td className="px-4 py-2.5">
                        <Badge variant={s.status === "ARCHIVED" ? "neutral" : s.status === "ACTIVE" ? "success" : "primary"}>
                          {RECORD_STATUS_LABELS[s.status]}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <Progress value={s.completionPct} color={readinessColor(s.completionPct)} height={5} />
                          <span className="text-[11px] text-muted">{s.completionPct}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
