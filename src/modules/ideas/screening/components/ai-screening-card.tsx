import { Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Verdict = "STRONG" | "ACCEPTABLE" | "WEAK" | "CONCERN";
type Recommendation = "PROCEED" | "NEEDS_INFO" | "REJECT";

export interface AiScreeningCardData {
  status: "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";
  provider: string | null;
  model: string | null;
  score: number | null;
  recommendation: Recommendation | null;
  summaryAr: string | null;
  error: string | null;
  completedAt: Date | string | null;
  findings: { id: string; criterionKey: string; labelAr: string; verdict: Verdict; noteAr: string | null }[];
}

const RECOMMENDATION_LABEL: Record<Recommendation, string> = {
  PROCEED: "تبدو جاهزة للمتابعة",
  NEEDS_INFO: "تحتاج معلومات إضافية",
  REJECT: "لا يُنصح بالمتابعة",
};
const RECOMMENDATION_VARIANT: Record<Recommendation, "success" | "warning" | "danger"> = {
  PROCEED: "success",
  NEEDS_INFO: "warning",
  REJECT: "danger",
};
const VERDICT_LABEL: Record<Verdict, string> = { STRONG: "قوي", ACCEPTABLE: "مقبول", WEAK: "ضعيف", CONCERN: "يستدعي الانتباه" };
const VERDICT_VARIANT: Record<Verdict, "success" | "neutral" | "warning" | "danger"> = {
  STRONG: "success",
  ACCEPTABLE: "neutral",
  WEAK: "warning",
  CONCERN: "danger",
};

export function AiScreeningCard({ data }: { data: AiScreeningCardData | null }) {
  if (!data) return null;

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          الفحص الآلي الأولي (استشاري)
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-[11.5px] text-muted">
          توصية تمهيدية مبنية على الذكاء الاصطناعي لمساعدة المُقيّم — لا تُغيّر حالة الفكرة ولا تُغني عن المراجعة البشرية.
        </p>

        {data.status === "QUEUED" && <Badge variant="neutral">بانتظار التشغيل</Badge>}
        {data.status === "PROCESSING" && <Badge variant="info">جارٍ التحليل…</Badge>}

        {data.status === "FAILED" && (
          <div className="rounded-xl bg-warning-bg px-3 py-2 text-[12px] text-warning">
            تعذّر تشغيل الفحص الآلي: {data.error || "سبب غير معروف"} — تابع المراجعة البشرية كالمعتاد.
          </div>
        )}

        {data.status === "COMPLETED" && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {data.recommendation && (
                <Badge variant={RECOMMENDATION_VARIANT[data.recommendation]}>{RECOMMENDATION_LABEL[data.recommendation]}</Badge>
              )}
              {data.score !== null && <Badge variant="neutral">المؤشر التقديري: {data.score}/100</Badge>}
            </div>
            {data.summaryAr && <p className="text-[13px] leading-relaxed text-slate-700 dark:text-slate-200">{data.summaryAr}</p>}

            {data.findings.length > 0 && (
              <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-[12.5px] sm:grid-cols-2">
                {data.findings.map((f) => (
                  <div key={f.id} className="flex flex-col gap-0.5 border-b border-border/50 py-1 dark:border-border-dark/50">
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-slate-600 dark:text-slate-300">{f.labelAr}</dt>
                      <Badge variant={VERDICT_VARIANT[f.verdict]}>{VERDICT_LABEL[f.verdict]}</Badge>
                    </div>
                    {f.noteAr && <dd className="text-[11.5px] text-muted">{f.noteAr}</dd>}
                  </div>
                ))}
              </dl>
            )}
            <p className="text-[10.5px] text-muted">
              {data.provider ? `المزوّد: ${data.provider}${data.model ? ` (${data.model})` : ""}` : null}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
