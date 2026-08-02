import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EVALUATION_STAGE_LABELS } from "@/modules/ideas/evaluation-schema";

export interface EvaluationRow {
  id: string;
  stage: string;
  score: number | null;
  notes: string | null;
  createdAt: Date;
  evaluator: { name: string } | null;
}
export interface InfoRequestRow {
  id: string;
  requestedInfo: string;
  requestedAt: Date;
  responseText: string | null;
  respondedAt: Date | null;
  status: string;
}

export function EvaluationTimeline({ evaluations, infoRequests }: { evaluations: EvaluationRow[]; infoRequests: InfoRequestRow[] }) {
  const empty = evaluations.length === 0 && infoRequests.length === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>سجل المراجعة</CardTitle>
      </CardHeader>
      <CardContent>
        {empty ? (
          <p className="py-6 text-center text-sm text-muted">لا توجد تقييمات أو طلبات معلومات بعد.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {infoRequests.map((r) => (
              <div key={r.id} className="rounded-xl border border-warning/30 bg-warning-bg/40 p-3">
                <div className="mb-1 flex items-center justify-between">
                  <Badge variant="warning">طلب معلومات</Badge>
                  <span className="text-[11px] text-muted">{new Date(r.requestedAt).toLocaleString("ar")}</span>
                </div>
                <p className="text-[12.5px] text-slate-700 dark:text-slate-200">{r.requestedInfo}</p>
                {r.responseText ? (
                  <div className="mt-2 rounded-lg bg-surface p-2 dark:bg-surface-dark">
                    <div className="mb-0.5 text-[11px] font-semibold text-success">رد صاحب الفكرة · {r.respondedAt ? new Date(r.respondedAt).toLocaleDateString("ar") : ""}</div>
                    <p className="text-[12px] text-slate-700 dark:text-slate-200">{r.responseText}</p>
                  </div>
                ) : (
                  <p className="mt-1 text-[11px] text-muted">بانتظار رد صاحب الفكرة…</p>
                )}
              </div>
            ))}
            {evaluations.map((e) => (
              <div key={e.id} className="rounded-xl border border-border bg-surface p-3 dark:border-border-dark dark:bg-surface-dark">
                <div className="mb-1 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="primary">{EVALUATION_STAGE_LABELS[e.stage] ?? e.stage}</Badge>
                    {e.score != null && <span className="text-[11.5px] text-muted">الدرجة: {e.score}</span>}
                  </div>
                  <span className="text-[11px] text-muted">{new Date(e.createdAt).toLocaleString("ar")}</span>
                </div>
                <p className="text-[12.5px] text-slate-700 dark:text-slate-200">{e.notes}</p>
                <p className="mt-1 text-[11px] text-muted">المُقيّم: {e.evaluator?.name ?? "—"}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
