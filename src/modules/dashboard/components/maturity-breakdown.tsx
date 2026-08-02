import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { MATURITY_LABELS, IMPLEMENTATION_LABELS } from "@/modules/solutions/schema";
import type { SolutionStats } from "@/modules/solutions/stats-service";

function Bars({ rows, total }: { rows: { key: string; count: number }[]; total: number }) {
  return (
    <div className="flex flex-col gap-2">
      {rows.map((r) => {
        const pct = total > 0 ? Math.round((r.count / total) * 100) : 0;
        return (
          <div key={r.key}>
            <div className="mb-1 flex items-center justify-between text-[12px]">
              <span className="text-slate-600 dark:text-slate-300">
                {MATURITY_LABELS[r.key] ?? IMPLEMENTATION_LABELS[r.key] ?? r.key}
              </span>
              <span className="text-muted">{r.count}</span>
            </div>
            <Progress value={pct} height={5} />
          </div>
        );
      })}
    </div>
  );
}

/**
 * Real, scope-filtered solution aggregates (replaces the previous mock-driven
 * breakdown). Counts and data-completeness only — no compliance/readiness claim.
 */
export function MaturityBreakdown({ stats }: { stats: SolutionStats }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>الحلول الابتكارية حسب المرحلة والتنفيذ</CardTitle>
        <span className="text-[11.5px] text-muted">{stats.total} حل ضمن نطاقك</span>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {stats.total === 0 ? (
          <p className="py-6 text-center text-sm text-muted">لا توجد حلول مسجّلة ضمن نطاقك بعد.</p>
        ) : (
          <>
            <div>
              <p className="mb-2 text-[12px] font-semibold text-slate-700 dark:text-slate-200">مرحلة النضج</p>
              <Bars rows={stats.byMaturity} total={stats.total} />
            </div>
            <div>
              <p className="mb-2 text-[12px] font-semibold text-slate-700 dark:text-slate-200">حالة التنفيذ</p>
              <Bars rows={stats.byImplementation} total={stats.total} />
            </div>
            <div>
              <p className="mb-2 text-[12px] font-semibold text-slate-700 dark:text-slate-200">
                توزيع اكتمال البيانات <span className="font-normal text-muted">(ليس مؤشر امتثال)</span>
              </p>
              <Bars rows={stats.completeness.map((c) => ({ key: c.label, count: c.count }))} total={stats.total} />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
