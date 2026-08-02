import { History } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SolutionHistoryRow } from "@/modules/solutions/history-service";

const ACTION_LABELS: Record<string, string> = {
  SOLUTION_CREATED: "إنشاء الحل",
  SOLUTION_UPDATED: "تحديث البيانات",
  SOLUTION_ARCHIVED: "أرشفة",
  SOLUTION_PARTNER_UPDATED: "تعديل من شريك",
  SOLUTION_STATUS_CHANGED: "تغيير حالة السجل",
  SOLUTION_IMPLEMENTATION_CHANGED: "تغيير حالة التنفيذ",
  SOLUTION_MATURITY_CHANGED: "تغيير مرحلة النضج",
  SOLUTION_PUBLISHED: "نشر",
  SOLUTION_UNPUBLISHED: "إلغاء النشر",
  SOLUTION_SHARE_GRANTED: "منح مشاركة",
  SOLUTION_SHARE_UPDATED: "تعديل مشاركة",
  SOLUTION_SHARE_REVOKED: "إلغاء مشاركة",
  SOLUTION_ORG_ADDED: "إضافة جهة مشاركة",
  SOLUTION_ORG_REMOVED: "إزالة جهة مشاركة",
};

/** Read-only lifecycle timeline derived from the append-only audit log. */
export function HistoryTimeline({ events }: { events: SolutionHistoryRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>سجل دورة الحياة</CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">لا توجد أحداث مسجّلة بعد.</p>
        ) : (
          <ol className="flex flex-col gap-2.5">
            {events.map((e) => (
              <li key={e.id} className="flex gap-2.5 rounded-xl border border-border p-3 dark:border-border-dark">
                <History className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[12.5px] font-semibold text-slate-800 dark:text-slate-100">
                      {ACTION_LABELS[e.action] ?? e.action}
                    </span>
                    <span className="ms-auto text-[11px] text-muted">{new Date(e.createdAt).toLocaleString("ar")}</span>
                  </div>
                  {e.summary && <p className="mt-0.5 text-[12px] text-slate-600 dark:text-slate-300">{e.summary}</p>}
                  <p className="mt-0.5 text-[11px] text-muted">بواسطة: {e.actor?.name ?? "—"}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
