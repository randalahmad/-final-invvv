import type { Metadata } from "next";

import { requirePermission, getAccessContext } from "@/server/authz";
import { auditActionLabel, listAuditLog, listDistinctAuditActions } from "@/modules/audit/service";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";

export const metadata: Metadata = { title: "سجل التدقيق" };

const fieldClass =
  "w-full rounded-xl border border-border bg-surface px-3.5 py-2 text-[13px] outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-border-dark dark:bg-surface-dark";

export default async function AuditLogPage({ searchParams }: { searchParams: { q?: string; action?: string } }) {
  await requirePermission("audit.view");
  const ctx = (await getAccessContext())!;
  const [rows, actions] = await Promise.all([
    listAuditLog(ctx, { q: searchParams.q, action: searchParams.action }),
    listDistinctAuditActions(ctx),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="سجل التدقيق" description="آخر 200 عملية مسجلة على مستوى المنصة — للقراءة فقط." />

      <form method="GET" className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-surface/60 p-3 dark:border-border-dark dark:bg-surface-dark/40">
        <div className="flex min-w-[200px] flex-1 flex-col gap-1.5">
          <label htmlFor="q" className="text-[11.5px] text-muted">
            بحث في الملخص
          </label>
          <Input id="q" name="q" defaultValue={searchParams.q ?? ""} />
        </div>
        <div className="flex min-w-[200px] flex-col gap-1.5">
          <label htmlFor="action" className="text-[11.5px] text-muted">
            نوع العملية
          </label>
          <select id="action" name="action" defaultValue={searchParams.action ?? ""} className={fieldClass}>
            <option value="">كل العمليات</option>
            {actions.map((a) => (
              <option key={a} value={a}>
                {auditActionLabel(a)}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" size="sm" variant="outline">
          تطبيق
        </Button>
      </form>

      {rows.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="px-6 py-16 text-center text-sm text-muted">لا توجد عمليات مطابقة.</CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-start">
                <thead>
                  <tr className="border-b border-border text-[11.5px] text-muted dark:border-border-dark">
                    <th className="px-4 py-2.5 text-start font-medium">التاريخ</th>
                    <th className="px-4 py-2.5 text-start font-medium">المستخدم</th>
                    <th className="px-4 py-2.5 text-start font-medium">العملية</th>
                    <th className="px-4 py-2.5 text-start font-medium">الكيان</th>
                    <th className="px-4 py-2.5 text-start font-medium">الملخص</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-border/60 last:border-0 dark:border-border-dark/60">
                      <td className="px-4 py-2.5 text-[12px] text-muted">{new Date(r.createdAt).toLocaleString("ar")}</td>
                      <td className="px-4 py-2.5 text-[12.5px] text-slate-700 dark:text-slate-200">{r.actorName ?? "—"}</td>
                      <td className="px-4 py-2.5 text-[12px] text-muted">{auditActionLabel(r.action)}</td>
                      <td className="px-4 py-2.5 text-[12px] text-muted">{r.entityType ?? "—"}</td>
                      <td className="px-4 py-2.5 text-[12.5px] text-slate-700 dark:text-slate-200">{r.summary ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
