import { Gavel, RotateCcw, Layers } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DECISION_LABELS } from "@/modules/ideas/decision-schema";
import type { DecisionHistoryRow } from "@/modules/ideas/decision-service";

const DECISION_VARIANT: Record<string, "neutral" | "primary" | "success" | "warning" | "danger"> = {
  APPROVE_FOR_PILOT: "success",
  REJECT: "danger",
  CONVERT_TO_SOLUTION: "primary",
  REQUEST_MORE_INFO: "warning",
  DEFER: "neutral",
};

/** Append-only decision history: superseding and reopening are shown, never hidden. */
export function DecisionHistory({ decisions }: { decisions: DecisionHistoryRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>سجل القرارات</CardTitle>
      </CardHeader>
      <CardContent>
        {decisions.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">لا توجد قرارات بعد.</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {decisions.map((d) => (
              <li key={d.id} className="rounded-xl border border-border p-3 dark:border-border-dark">
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <Gavel className="h-3.5 w-3.5 text-muted" />
                  <Badge variant={DECISION_VARIANT[d.decision] ?? "neutral"}>
                    {DECISION_LABELS[d.decision] ?? d.decision}
                  </Badge>
                  {d.finalizedAt ? (
                    <span className="text-[11px] text-success">نهائي</span>
                  ) : (
                    <span className="text-[11px] text-warning">غير نهائي</span>
                  )}
                  {d.supersedesId && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted">
                      <Layers className="h-3 w-3" /> يَنسخ قرارًا سابقًا
                    </span>
                  )}
                  {d.reopenedAt && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-warning">
                      <RotateCcw className="h-3 w-3" /> أُعيد فتحه
                    </span>
                  )}
                  <span className="ms-auto text-[11px] text-muted">{new Date(d.createdAt).toLocaleString("ar")}</span>
                </div>
                {d.notes && <p className="whitespace-pre-wrap text-[12.5px] text-slate-700 dark:text-slate-200">{d.notes}</p>}
                {d.reopenReason && (
                  <p className="mt-1 text-[11.5px] text-muted">سبب إعادة الفتح: {d.reopenReason}</p>
                )}
                <p className="mt-1 text-[11px] text-muted">متخذ القرار: {d.decidedBy?.name ?? "—"}</p>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
