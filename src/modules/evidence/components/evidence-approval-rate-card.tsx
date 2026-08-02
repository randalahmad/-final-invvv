import { Info } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { EvidenceApprovalRate } from "@/modules/evidence/service";

/**
 * Approval rate of UPLOADED evidence. Deliberately not called "readiness":
 * required-but-missing evidence is invisible to this metric.
 */
export function EvidenceApprovalRateCard({ rate }: { rate: EvidenceApprovalRate }) {
  const color = rate.percentage >= 80 ? "#16B364" : rate.percentage >= 40 ? "#F79009" : "#EF4444";

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <div className="text-[13px] font-bold text-slate-800 dark:text-slate-100">نسبة اعتماد الأدلة المرفوعة</div>
            <div className="mt-0.5 text-[11.5px] text-muted">
              الأدلة المعتمدة ÷ الأدلة المرفوعة المتتبَّعة ({rate.approved} من {rate.tracked}) — باستثناء المرفوضة والمؤرشفة
            </div>
          </div>
          <div className="text-2xl font-extrabold" style={{ color }}>
            {rate.percentage}%
          </div>
        </div>

        <div className="mt-3">
          <Progress value={rate.percentage} color={color} height={7} />
        </div>

        <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-info-bg px-3 py-2 text-[11.5px] leading-relaxed text-info">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          هذا المؤشر يقيس نسبة اعتماد ما تم رفعه فقط. وهو ليس جاهزية امتثال، ولا جاهزية DGA، ولا يقيس تغطية الأدلة
          المطلوبة — لأن الأدلة المطلوبة وغير المرفوعة لا تدخل في الحساب.
        </p>
      </CardContent>
    </Card>
  );
}
