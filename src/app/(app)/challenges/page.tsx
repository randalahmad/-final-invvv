import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import { requirePermission, getAccessContext } from "@/server/authz";
import { listChallengesInScope, listOwnableDepartments } from "@/modules/challenges/service";
import { CHALLENGE_STATUSES, CHALLENGE_STATUS_LABELS } from "@/modules/challenges/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";

export const metadata: Metadata = { title: "التحديات" };

const STATUS_VARIANT: Record<string, "success" | "neutral" | "warning" | "primary" | "danger"> = {
  NEW: "neutral",
  UNDER_REVIEW: "warning",
  SOLUTION_PROPOSED: "primary",
  IN_PROGRESS: "warning",
  RESOLVED: "success",
  CLOSED_WITHOUT_SOLUTION: "danger",
};

const fieldClass =
  "w-full rounded-xl border border-border bg-surface px-3.5 py-2 text-[13px] outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-border-dark dark:bg-surface-dark";

export default async function ChallengesPage({
  searchParams,
}: {
  searchParams: { archived?: string; departmentId?: string; status?: string; q?: string };
}) {
  await requirePermission("challenge.view");
  const ctx = (await getAccessContext())!;
  const includeArchived = searchParams.archived === "1";
  const [challenges, departments] = await Promise.all([
    listChallengesInScope(ctx, {
      includeArchived,
      departmentId: searchParams.departmentId,
      status: searchParams.status,
      q: searchParams.q,
    }),
    listOwnableDepartments(ctx),
  ]);
  const canCreate = ctx.permissions.has("challenge.create");

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="التحديات"
        description="التحديات المسجلة لدى الجهات ومسار ربطها بالحلول الابتكارية."
        action={canCreate && !includeArchived ? (
          <Button asChild>
            <Link href="/challenges/new">
              <Plus className="h-4 w-4" />
              تسجيل تحدٍّ جديد
            </Link>
          </Button>
        ) : undefined}
      />

      <form method="GET" className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-surface/60 p-3 dark:border-border-dark dark:bg-surface-dark/40">
        <div className="flex min-w-[200px] flex-1 flex-col gap-1.5">
          <label htmlFor="q" className="text-[11.5px] text-muted">
            بحث بعنوان التحدي
          </label>
          <Input id="q" name="q" defaultValue={searchParams.q ?? ""} />
        </div>
        <div className="flex min-w-[160px] flex-col gap-1.5">
          <label htmlFor="departmentId" className="text-[11.5px] text-muted">
            الإدارة المالكة
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
        <div className="flex min-w-[160px] flex-col gap-1.5">
          <label htmlFor="status" className="text-[11.5px] text-muted">
            الحالة
          </label>
          <select id="status" name="status" defaultValue={searchParams.status ?? ""} className={fieldClass}>
            <option value="">كل الحالات</option>
            {CHALLENGE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {CHALLENGE_STATUS_LABELS[s]}
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
      </form>

      {challenges.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-2 px-6 py-16 text-center">
            <p className="text-sm text-muted">
              {searchParams.q || searchParams.departmentId || searchParams.status
                ? "لا توجد نتائج مطابقة."
                : includeArchived
                  ? "لا توجد تحديات مؤرشفة."
                  : "لا توجد تحديات مُسجَّلة بعد."}
            </p>
            {canCreate && !includeArchived && !searchParams.q && !searchParams.departmentId && !searchParams.status && (
              <Button asChild size="sm" variant="outline">
                <Link href="/challenges/new">تسجيل أول تحدٍّ</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {challenges.map((c) => (
            <Link key={c.id} href={`/challenges/${c.id}`}>
              <Card className="h-full transition hover:border-primary/50 hover:shadow-sm">
                <CardContent className="flex h-full flex-col gap-2.5 px-4 py-4">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[11.5px] font-semibold text-muted">{c.departmentName ?? "—"}</span>
                    <Badge variant={STATUS_VARIANT[c.status] ?? "neutral"}>{CHALLENGE_STATUS_LABELS[c.status] ?? c.status}</Badge>
                  </div>
                  <p className="text-[13.5px] font-semibold text-slate-800 dark:text-slate-100">{c.titleAr}</p>
                  {c.descriptionSnippet && <p className="text-[12px] text-muted">{c.descriptionSnippet}</p>}
                  {c.category && (
                    <span className="mt-auto w-fit rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] text-muted dark:bg-white/5">{c.category}</span>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
