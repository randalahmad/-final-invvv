import Link from "next/link";
import { ArrowLeft, FileCheck2, FolderCheck } from "lucide-react";

import { StatTile } from "@/components/shared/stat-tile";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReadinessGrid } from "@/modules/dashboard/components/readiness-grid";
import { MaturityBreakdown } from "@/modules/dashboard/components/maturity-breakdown";
import { getAccessContext, can } from "@/server/authz";
import { getSolutionStats } from "@/modules/solutions/stats-service";
import type { SolutionStats } from "@/modules/solutions/stats-service";
import { listComplianceOverview } from "@/modules/compliance/service";
import { estimatedReadiness } from "@/modules/dashboard/readiness";

const EMPTY_STATS: SolutionStats = { total: 0, byMaturity: [], byImplementation: [], completeness: [] };

export default async function DashboardPage() {
  // Real, scope-filtered solution aggregates (no mock). Nothing is fetched
  // without solution.view.
  const ctx = await getAccessContext();
  const [stats, complianceRows] = await Promise.all([
    ctx && can(ctx, "solution.view") ? getSolutionStats(ctx) : EMPTY_STATS,
    ctx && can(ctx, "compliance.view") ? listComplianceOverview(ctx) : [],
  ]);
  const readiness = estimatedReadiness(complianceRows);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="لوحة العمل"
        description="نقطة البداية لمتابعة الحلول والجاهزية والإجراءات المتاحة ضمن نطاق صلاحياتك."
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatTile
          label="مؤشر جاهزية تقديري داخلي"
          value={readiness === null ? "—" : `${readiness}%`}
          sub={
            complianceRows.length
              ? `متوسط ${complianceRows.length} من الحلول ضمن نطاق صلاحياتك`
              : "لا توجد حلول مهيأة للحساب ضمن نطاق صلاحياتك"
          }
          href="/compliance"
          hero
        />
        <StatTile
          label="الحلول الابتكارية المسجّلة"
          value={String(stats.total)}
          sub="ضمن نطاق صلاحياتك"
          href="/solutions"
        />
      </div>

      <div className="flex flex-col gap-3">
        <ReadinessGrid rows={complianceRows.slice(0, 5)} />
        {complianceRows.length > 5 && (
          <Link href="/solutions" className="self-end text-[12px] font-semibold text-primary hover:underline">
            عرض جميع الحلول في السجل
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MaturityBreakdown stats={stats} />
        <Card>
          <CardHeader>
            <CardTitle>ابدأ من هنا</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Link
              href="/compliance"
              className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-[13px] font-semibold hover:border-primary/40 hover:bg-primary-50/40 dark:border-border-dark"
            >
              <FolderCheck className="h-4 w-4 text-primary" />
              <span className="flex-1">مراجعة الجاهزية وفجوات الامتثال</span>
              <ArrowLeft className="h-4 w-4 text-muted" />
            </Link>
            <Link
              href="/solutions"
              className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-[13px] font-semibold hover:border-primary/40 hover:bg-primary-50/40 dark:border-border-dark"
            >
              <FileCheck2 className="h-4 w-4 text-primary" />
              <span className="flex-1">استعراض الحلول الابتكارية</span>
              <ArrowLeft className="h-4 w-4 text-muted" />
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
