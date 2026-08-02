import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import { requirePermission, getAccessContext } from "@/server/authz";
import { listObjectivesInScope, listOwnableDepartments } from "@/modules/strategy/service";
import { RECORD_STATUS_LABELS } from "@/modules/strategy/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "التوجه الاستراتيجي" };

const STATUS_VARIANT: Record<string, "success" | "neutral" | "warning"> = {
  ACTIVE: "success",
  DRAFT: "neutral",
  ARCHIVED: "neutral",
};

const fieldClass =
  "w-full rounded-xl border border-border bg-surface px-3.5 py-2 text-[13px] outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-border-dark dark:bg-surface-dark";

export default async function StrategyPage({ searchParams }: { searchParams: { archived?: string; departmentId?: string; q?: string } }) {
  await requirePermission("strategy.objective.view");
  const ctx = (await getAccessContext())!;
  const includeArchived = searchParams.archived === "1";
  const [objectives, departments] = await Promise.all([
    listObjectivesInScope(ctx, { includeArchived, departmentId: searchParams.departmentId, q: searchParams.q }),
    listOwnableDepartments(ctx),
  ]);
  const canManage = ctx.permissions.has("strategy.objective.manage");

  const fmt = (d: Date | null) => (d ? new Date(d).toLocaleDateString("ar") : "—");

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">التوجه الاستراتيجي</h1>
          <p className="mt-1 text-[13px] text-muted">
            الأهداف الاستراتيجية والجهات المسؤولة عنها (5.23.1). ربط الأهداف بمعايير الامتثال والوثائق المُستوفاة يُبنى في المرحلة التالية.
          </p>
        </div>
        {canManage && !includeArchived && (
          <Button asChild>
            <Link href="/strategy/new">
              <Plus className="h-4 w-4" />
              هدف استراتيجي جديد
            </Link>
          </Button>
        )}
      </div>

      <form method="GET" className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-surface/60 p-3 dark:border-border-dark dark:bg-surface-dark/40">
        <div className="flex min-w-[200px] flex-1 flex-col gap-1.5">
          <label htmlFor="q" className="text-[11.5px] text-muted">
            بحث بعنوان الهدف أو رمزه
          </label>
          <Input id="q" name="q" defaultValue={searchParams.q ?? ""} placeholder="مثال: SO-01 أو النضج الرقمي" />
        </div>
        <div className="flex min-w-[180px] flex-col gap-1.5">
          <label htmlFor="departmentId" className="text-[11.5px] text-muted">
            الجهة المسؤولة
          </label>
          <select id="departmentId" name="departmentId" defaultValue={searchParams.departmentId ?? ""} className={fieldClass}>
            <option value="">كل الجهات ضمن نطاقك</option>
            {departments.map((d: { id: string; nameAr: string }) => (
              <option key={d.id} value={d.id}>
                {d.nameAr}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-1.5 pb-2 text-[12px] text-muted">
          <input type="checkbox" name="archived" value="1" defaultChecked={includeArchived} className="h-4 w-4 accent-primary" />
          عرض الأرشيف فقط
        </label>
        <Button type="submit" size="sm" variant="outline">
          تطبيق
        </Button>
        {(searchParams.q || searchParams.departmentId || includeArchived) && (
          <Button asChild size="sm" variant="outline">
            <Link href="/strategy">مسح الفلاتر</Link>
          </Button>
        )}
      </form>

      {objectives.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-2 px-6 py-16 text-center">
            <p className="text-sm text-muted">
              {searchParams.q || searchParams.departmentId
                ? "لا توجد نتائج مطابقة لهذا البحث/الفلتر."
                : includeArchived
                  ? "لا توجد أهداف استراتيجية مؤرشفة حاليًا ضمن نطاقك."
                  : "لا توجد أهداف استراتيجية مضافة بعد ضمن نطاقك."}
            </p>
            {canManage && !includeArchived && !searchParams.q && !searchParams.departmentId && (
              <Button asChild size="sm" variant="outline">
                <Link href="/strategy/new">إنشاء أول هدف</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-start">
                <thead>
                  <tr className="border-b border-border text-[11.5px] text-muted dark:border-border-dark">
                    <th className="px-4 py-2.5 text-start font-medium">الهدف</th>
                    <th className="px-4 py-2.5 text-start font-medium">الجهة المسؤولة</th>
                    <th className="px-4 py-2.5 text-start font-medium">مؤشر الأداء</th>
                    <th className="px-4 py-2.5 text-start font-medium">الفترة</th>
                    <th className="px-4 py-2.5 text-start font-medium">الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {objectives.map((o) => (
                    <tr key={o.id} className="border-b border-border/60 last:border-0 hover:bg-slate-50/60 dark:border-border-dark/60 dark:hover:bg-white/5">
                      <td className="px-4 py-2.5">
                        <Link href={`/strategy/${o.id}`} className="text-[13px] font-semibold text-primary hover:underline">
                          {o.code ? `${o.code} — ${o.titleAr}` : o.titleAr}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-[12px] text-muted">{o.departmentName ?? "—"}</td>
                      <td className="px-4 py-2.5 text-[12px] text-muted">{o.kpi ?? "—"}</td>
                      <td className="px-4 py-2.5 text-[12px] text-muted">
                        {fmt(o.periodStart)} – {fmt(o.periodEnd)}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge variant={STATUS_VARIANT[o.status] ?? "neutral"}>{RECORD_STATUS_LABELS[o.status] ?? o.status}</Badge>
                      </td>
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
