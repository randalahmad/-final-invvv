import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import { requirePermission, getAccessContext } from "@/server/authz";
import { listCommitteesInScope } from "@/modules/committees/service";
import { COMMITTEE_STATUS_LABELS } from "@/modules/committees/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "لجان الحوكمة" };

const STATUS_VARIANT: Record<string, "success" | "neutral" | "warning"> = {
  PROPOSED: "neutral",
  ACTIVE: "success",
  DISSOLVED: "warning",
};

export default async function CommitteesPage({ searchParams }: { searchParams: { archived?: string; q?: string } }) {
  await requirePermission("committee.view");
  const ctx = (await getAccessContext())!;
  const includeArchived = searchParams.archived === "1";
  const committees = await listCommitteesInScope(ctx, { includeArchived, q: searchParams.q });
  const canManage = ctx.permissions.has("committee.manage");

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href="/governance" className="text-[12.5px] text-muted hover:text-primary">
          ← العودة إلى حوكمة الابتكار
        </Link>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">لجان الحوكمة</h1>
          <p className="mt-1 text-[13px] text-muted">تشكيل اللجان وأعضائها ومحاضر اجتماعاتها (5.23.3).</p>
        </div>
        {canManage && !includeArchived && (
          <Button asChild>
            <Link href="/governance/committees/new">
              <Plus className="h-4 w-4" />
              تشكيل لجنة جديدة
            </Link>
          </Button>
        )}
      </div>

      <form method="GET" className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-surface/60 p-3 dark:border-border-dark dark:bg-surface-dark/40">
        <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
          <label htmlFor="q" className="text-[11.5px] text-muted">
            بحث باسم اللجنة
          </label>
          <Input id="q" name="q" defaultValue={searchParams.q ?? ""} />
        </div>
        <label className="flex items-center gap-1.5 pb-2 text-[12px] text-muted">
          <input type="checkbox" name="archived" value="1" defaultChecked={includeArchived} className="h-4 w-4 accent-primary" />
          عرض الأرشيف فقط
        </label>
        <Button type="submit" size="sm" variant="outline">
          تطبيق
        </Button>
      </form>

      {committees.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-2 px-6 py-16 text-center">
            <p className="text-sm text-muted">
              {searchParams.q ? "لا توجد نتائج مطابقة." : includeArchived ? "لا توجد لجان مؤرشفة." : "لا توجد لجان مُشكَّلة بعد."}
            </p>
            {canManage && !includeArchived && !searchParams.q && (
              <Button asChild size="sm" variant="outline">
                <Link href="/governance/committees/new">تشكيل أول لجنة</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {committees.map((c) => (
            <Link key={c.id} href={`/governance/committees/${c.id}`}>
              <Card className="h-full transition hover:border-primary/50 hover:shadow-sm">
                <CardContent className="flex h-full flex-col gap-2.5 px-4 py-4">
                  <div className="flex items-start justify-between gap-2">
                    <Badge variant="neutral">{c.category ?? "لجنة"}</Badge>
                    <Badge variant={STATUS_VARIANT[c.status] ?? "neutral"}>{COMMITTEE_STATUS_LABELS[c.status] ?? c.status}</Badge>
                  </div>
                  <p className="text-[13.5px] font-semibold text-slate-800 dark:text-slate-100">{c.nameAr}</p>
                  <p className="text-[12px] text-muted">{c.organizationName ?? "—"}</p>
                  <p className="mt-auto text-[11.5px] text-muted">
                    {c.memberCount} عضو · {c.meetingCount} اجتماع
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
