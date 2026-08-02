import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { EvidenceTimelineRow } from "@/modules/evidence/service";

const ACTION_LABELS: Record<string, string> = {
  EVIDENCE_UPLOADED: "رفع الدليل",
  EVIDENCE_UPDATED: "تحديث بيانات الدليل",
  EVIDENCE_SUBMITTED: "تقديم للمراجعة",
  EVIDENCE_REVIEW_STARTED: "بدء المراجعة",
  EVIDENCE_APPROVED: "اعتماد الدليل",
  EVIDENCE_REJECTED: "رفض الدليل",
  EVIDENCE_ARCHIVED: "أرشفة الدليل",
  EVIDENCE_LINKED: "ربط الدليل بسجل",
  EVIDENCE_UNLINKED: "إلغاء ربط",
};

const DOT_COLOR: Record<string, string> = {
  EVIDENCE_APPROVED: "bg-success",
  EVIDENCE_REJECTED: "bg-danger",
  EVIDENCE_ARCHIVED: "bg-slate-400",
};

export function EvidenceTimeline({ events }: { events: EvidenceTimelineRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>سجل أحداث الدليل</CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-muted">لا توجد أحداث مسجّلة بعد.</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {events.map((e) => {
              const meta = (e.metadata ?? null) as { note?: string; targetType?: string; targetId?: string } | null;
              return (
                <li key={e.id} className="flex gap-3">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOT_COLOR[e.action] ?? "bg-primary"}`} />
                  <div className="flex-1 border-b border-border/50 pb-3 last:border-0 dark:border-border-dark/50">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">
                        {ACTION_LABELS[e.action] ?? e.action}
                      </span>
                      <span className="text-[11.5px] text-muted">{new Date(e.createdAt).toLocaleString("ar")}</span>
                    </div>
                    <div className="mt-0.5 text-[12px] text-muted">
                      {e.actor?.name ?? "النظام"}
                      {meta?.note ? ` — ${meta.note}` : ""}
                      {meta?.targetType ? ` — ${meta.targetType}: ${meta.targetId}` : ""}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
