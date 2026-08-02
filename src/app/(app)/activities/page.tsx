import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import { requirePermission, getAccessContext } from "@/server/authz";
import { listActivitiesInScope, listOwnableDepartments } from "@/modules/activities/service";
import { ACTIVITY_TYPE_LABELS, ACTIVITY_STATUS_LABELS } from "@/modules/activities/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "منهجيات الابتكار وفعالياته" };

const STATUS_VARIANT: Record<string, "success" | "neutral" | "warning" | "danger"> = {
  PLANNED: "neutral",
  ONGOING: "warning",
  COMPLETED: "success",
  CANCELLED: "danger",
};

const fieldClass =
  "w-full rounded-xl border border-border bg-surface px-3.5 py-2 text-[13px] outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-border-dark dark:bg-surface-dark";

export default async function ActivitiesPage({
  searchParams,
}: {
  searchParams: { archived?: string; departmentId?: string; year?: string; q?: string };
}) {
  await requirePermission("activity.view");
  const ctx = (await getAccessContext())!;
  const includeArchived = searchParams.archived === "1";
  const [activities, departments] = await Promise.all([
    listActivitiesInScope(ctx, {
      includeArchived,
      departmentId: searchParams.departmentId,
      year: searchParams.year,
      q: searchParams.q,
    }),
    listOwnableDepartments(ctx),
  ]);
  const canManage = ctx.permissions.has("activity.manage");

  const fmt = (d: Date | null) => (d ? new Date(d).toLocaleDateString("ar") : "—");
  const years = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">منهجيات الابتكار وفعالياته</h1>
          <p className="mt-1 text-[13px] text-muted">توثيق اللقاءات والبرامج والورش والهاكاثونات والمبادرات (5.23.2).</p>
        </div>
        {canManage && !includeArchived && (
          <Button asChild>
            <Link href="/activities/new">
              <Plus className="h-4 w-4" />
              نشاط جديد
            </Link>
          </Button>
        )}
      </div>

      <form method="GET" className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-surface/60 p-3 dark:border-border-dark dark:bg-surface-dark/40">
        <div className="flex min-w-[200px] flex-1 flex-col gap-1.5">
          <label htmlFor="q" className="text-[11.5px] text-muted">
            بحث باسم النشاط
          </label>
          <Input id="q" name="q" defaultValue={searchParams.q ?? ""} placeholder="مثال: ورشة تجربة المستفيد" />
        </div>
        <div className="flex min-w-[180px] flex-col gap-1.5">
          <label htmlFor="departmentId" className="text-[11.5px] text-muted">
            الجهة المنظمة
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
        <div className="flex min-w-[120px] flex-col gap-1.5">
          <label htmlFor="year" className="text-[11.5px] text-muted">
            السنة
          </label>
          <select id="year" name="year" defaultValue={searchParams.year ?? ""} className={fieldClass}>
            <option value="">كل السنوات</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
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
        {(searchParams.q || searchParams.departmentId || searchParams.year || includeArchived) && (
          <Button asChild size="sm" variant="outline">
            <Link href="/activities">مسح الفلاتر</Link>
          </Button>
        )}
      </form>

      {activities.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-2 px-6 py-16 text-center">
            <p className="text-sm text-muted">
              {searchParams.q || searchParams.departmentId || searchParams.year
                ? "لا توجد نتائج مطابقة لهذا البحث/الفلتر."
                : includeArchived
                  ? "لا توجد أنشطة مؤرشفة حاليًا ضمن نطاقك."
                  : "لا توجد أنشطة مضافة بعد ضمن نطاقك."}
            </p>
            {canManage && !includeArchived && !searchParams.q && !searchParams.departmentId && !searchParams.year && (
              <Button asChild size="sm" variant="outline">
                <Link href="/activities/new">إنشاء أول نشاط</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {activities.map((a) => (
            <Link key={a.id} href={`/activities/${a.id}`}>
              <Card className="h-full transition hover:border-primary/50 hover:shadow-sm">
                <CardContent className="flex h-full flex-col gap-2.5 px-4 py-4">
                  <div className="flex items-start justify-between gap-2">
                    <Badge variant="neutral">{ACTIVITY_TYPE_LABELS[a.type] ?? a.type}</Badge>
                    <Badge variant={STATUS_VARIANT[a.status] ?? "neutral"}>{ACTIVITY_STATUS_LABELS[a.status] ?? a.status}</Badge>
                  </div>
                  <p className="text-[13.5px] font-semibold text-slate-800 dark:text-slate-100">{a.nameAr}</p>
                  <p className="text-[12px] text-muted">{a.departmentName ?? "—"}</p>
                  <p className="mt-auto text-[11.5px] text-muted">
                    {fmt(a.startDate)} – {fmt(a.endDate)}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
