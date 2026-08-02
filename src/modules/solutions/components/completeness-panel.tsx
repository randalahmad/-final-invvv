import { CheckCircle2, CircleDashed, Info } from "lucide-react";

import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { readinessColor } from "@/lib/utils";
import type { Completeness } from "@/modules/solutions/service";

/**
 * Data-completeness of the solution record — explicitly NOT a compliance /
 * DGA readiness score (no evidence is considered). Every missing field is
 * listed so the figure is fully explainable.
 */
export function CompletenessPanel({ completeness }: { completeness: Completeness }) {
  const { percentage, filled, total, missing } = completeness;

  return (
    <Card>
      <CardHeader>
        <CardTitle>اكتمال بيانات الملف</CardTitle>
        <span className="text-[11.5px] text-muted">
          {filled} من {total} حقلًا
        </span>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">{percentage}%</span>
          </div>
          <Progress value={percentage} color={readinessColor(percentage)} height={8} />
        </div>

        <p className="flex items-start gap-1.5 rounded-lg bg-info-bg px-3 py-2 text-[11.5px] leading-relaxed text-info">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          هذا المؤشر يقيس اكتمال حقول بيانات الحل فقط، وليس مؤشر جاهزية أو امتثال. لا يشمل الأدلة أو تقييم المتطلبات.
        </p>

        {missing.length === 0 ? (
          <p className="flex items-center gap-1.5 text-[12.5px] text-success">
            <CheckCircle2 className="h-4 w-4" />
            جميع الحقول المطلوبة مكتملة.
          </p>
        ) : (
          <div>
            <p className="mb-1.5 text-[12px] font-semibold text-slate-700 dark:text-slate-200">حقول ناقصة:</p>
            <ul className="flex flex-col gap-1">
              {missing.map((m) => (
                <li key={m.key} className="flex items-center gap-1.5 text-[12px] text-muted">
                  <CircleDashed className="h-3.5 w-3.5 shrink-0" />
                  {m.label}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
