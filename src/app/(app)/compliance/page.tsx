import type { Metadata } from "next";
import Link from "next/link";
import { FolderCheck, ArrowLeft } from "lucide-react";

import { requirePermission, getAccessContext, can } from "@/server/authz";
import { listComplianceOverview } from "@/modules/compliance/service";
import { countActivitiesForYear, ANNUAL_ACTIVITY_TARGET } from "@/modules/activities/service";
import { getCommitteeReadiness } from "@/modules/committees/service";
import { getStrategyComplianceReadiness } from "@/modules/strategy/service";
import { readinessBand } from "@/modules/compliance/scoring";
import { READINESS_BAND_LABELS, READINESS_BAND_VARIANT, ESTIMATED_NOTE } from "@/modules/compliance/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export const metadata: Metadata = { title: "ملف الامتثال" };

const BAND_COLOR = { READY: "#16a34a", NEARLY_READY: "#4F46E5", IN_PROGRESS: "#d97706", NOT_READY: "#dc2626" } as const;

export default async function CompliancePage() {
  await requirePermission("compliance.view");
  const ctx = (await getAccessContext())!;
  const rows = await listComplianceOverview(ctx);
  const canViewActivities = can(ctx, "activity.view");
  const canViewCommittees = can(ctx, "committee.view");
  const canViewStrategy = can(ctx, "strategy.document.view");
  const currentYear = new Date().getFullYear();
  const activitiesThisYear = canViewActivities ? await countActivitiesForYear(ctx, currentYear) : null;
  const committeeReadiness = canViewCommittees ? await getCommitteeReadiness(ctx) : null;
  const strategyReadiness = canViewStrategy ? await getStrategyComplianceReadiness(ctx) : null;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">ملف الامتثال</h1>
        <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{ESTIMATED_NOTE}</p>
      </div>

      {strategyReadiness !== null && (
        <Card>
          <CardHeader>
            <CardTitle>التوجه الاستراتيجي (5.23.1)</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <p className="text-[13px] text-muted">
              {strategyReadiness.fulfilled} من {strategyReadiness.total || 0} معيار مُسنَد مُستوفًى (وثيقة معتمدة + شاهد فعلي) ضمن نطاقك.
            </p>
            {strategyReadiness.total > 0 ? (
              <Progress value={Math.round((strategyReadiness.fulfilled / strategyReadiness.total) * 100)} />
            ) : (
              <p className="text-[12px] text-muted">لا توجد معايير مُسنَدة بعد ضمن نطاقك.</p>
            )}
          </CardContent>
        </Card>
      )}

      {activitiesThisYear !== null && (
        <Card>
          <CardHeader>
            <CardTitle>منهجيات الابتكار وفعالياته (5.23.2)</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <p className="text-[13px] text-muted">
              {activitiesThisYear} من {ANNUAL_ACTIVITY_TARGET} نشاطًا موثَّقًا خلال {currentYear} ضمن نطاقك.
            </p>
            <Progress value={Math.min(100, Math.round((activitiesThisYear / ANNUAL_ACTIVITY_TARGET) * 100))} />
          </CardContent>
        </Card>
      )}

      {committeeReadiness !== null && (
        <Card>
          <CardHeader>
            <CardTitle>حوكمة الابتكار (5.23.3)</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <p className="text-[13px] text-muted">
              {committeeReadiness.active} من {committeeReadiness.total || 0} لجنة مُفعَّلة (اجتماعها الأول موثَّق) ضمن نطاقك.
            </p>
            {committeeReadiness.total > 0 ? (
              <Progress value={Math.round((committeeReadiness.active / committeeReadiness.total) * 100)} />
            ) : (
              <p className="text-[12px] text-muted">لا توجد لجان مُشكَّلة بعد ضمن نطاقك.</p>
            )}
          </CardContent>
        </Card>
      )}

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-[13px] text-muted">
            لا توجد حلول ضمن نطاقك الداخلي لعرض ملف امتثالها. ملف الامتثال التفصيلي متاح للفريق الداخلي فقط.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderCheck className="h-4 w-4 text-primary" />
              الجاهزية التقديرية حسب الحل
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col divide-y divide-border/60 dark:divide-border-dark/60">
            {rows.map((row) => {
              const band = row.overallReadiness == null ? null : readinessBand(row.overallReadiness);
              return (
                <Link
                  key={row.solutionId}
                  href={`/solutions/${row.solutionId}/compliance`}
                  className="group flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-[180px] flex-1">
                    <div className="text-[13.5px] font-semibold text-slate-800 group-hover:text-primary dark:text-slate-100">{row.nameAr}</div>
                    {row.departmentAr && <div className="text-[11.5px] text-muted">{row.departmentAr}</div>}
                  </div>
                  <div className="flex min-w-[240px] items-center gap-2">
                    {row.overallReadiness == null || !band ? (
                      <Badge variant="neutral">غير مُهيّأ</Badge>
                    ) : (
                      <>
                        <Progress value={row.overallReadiness} color={BAND_COLOR[band]} className="max-w-[160px]" />
                        <span className="text-[12.5px] font-semibold tabular-nums text-slate-700 dark:text-slate-200">{row.overallReadiness}%</span>
                        <Badge variant={READINESS_BAND_VARIANT[band]}>{READINESS_BAND_LABELS[band]}</Badge>
                      </>
                    )}
                  </div>
                  <ArrowLeft className="h-4 w-4 text-muted transition-transform group-hover:-translate-x-0.5 group-hover:text-primary" />
                </Link>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
