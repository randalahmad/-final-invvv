import Link from "next/link";

import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { readinessColor } from "@/lib/utils";
import type { ComplianceOverviewRow } from "@/modules/compliance/service";

export function ReadinessGrid({ rows }: { rows: ComplianceOverviewRow[] }) {
  if (rows.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((row) => {
        const value = row.overallReadiness;
        return (
          <Link key={row.solutionId} href={`/solutions/${row.solutionId}/compliance`}>
            <Card className="p-5 hover:shadow-card-hover">
              <div className="mb-2.5 flex items-center justify-between">
                <span
                  className="text-2xl font-extrabold"
                  style={value === null ? undefined : { color: readinessColor(value) }}
                >
                  {value === null ? "—" : `${value}%`}
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] text-muted dark:bg-white/10">
                  تقديري داخلي
                </span>
              </div>
              <div className="mb-1 text-[13px] font-semibold">{row.nameAr}</div>
              <div className="mb-2.5 text-[11px] text-muted">{row.departmentAr ?? "غير محدد"}</div>
              <Progress value={value ?? 0} color={value === null ? undefined : readinessColor(value)} />
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
