import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import type { IdeaStatus } from "@prisma/client";
import { requirePermission } from "@/server/authz";
import { getAccessContext } from "@/server/authz";
import { listIdeasInScope, computeIdeaActionFlags } from "@/modules/ideas/service";
import { IDEA_STATUS_LABELS } from "@/modules/ideas/schema";
import { RestoreIdeaRowButton } from "@/modules/ideas/components/idea-actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "الأفكار" };

// "ARCHIVED" is intentionally not a pill here — it's reached via the
// dedicated ?archived=1 toggle below (same mechanism as /solutions), which
// switches the whole list into an archive/restore view.
const FILTERS: { value: string; label: string }[] = [
  { value: "", label: "الكل" },
  { value: "DRAFT", label: "مسودة" },
  { value: "SUBMITTED", label: "مُقدّمة" },
  { value: "WITHDRAWN", label: "مسحوبة" },
];

const STATUS_VARIANT: Record<string, "neutral" | "primary" | "success" | "warning" | "danger"> = {
  DRAFT: "neutral",
  SUBMITTED: "primary",
  WITHDRAWN: "warning",
  ARCHIVED: "neutral",
  REJECTED: "danger",
  APPROVED_FOR_PILOT: "success",
};

export default async function IdeasListPage({ searchParams }: { searchParams: { status?: string; archived?: string } }) {
  await requirePermission("idea.view"); // server-side gate (partners/viewers → FORBIDDEN)
  const ctx = (await getAccessContext())!;
  const includeArchived = searchParams.archived === "1";
  const status = searchParams.status && searchParams.status in IDEA_STATUS_LABELS ? (searchParams.status as IdeaStatus) : undefined;
  const ideas = await listIdeasInScope(ctx, { status, includeArchived });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">
            {includeArchived ? "أرشيف الأفكار" : "الأفكار الابتكارية"}
          </h1>
          <p className="mt-1 text-[13px] text-muted">
            {includeArchived
              ? "الأفكار المؤرشفة ضمن نطاقك. يمكن استعادة أي فكرة إلى حالتها السابقة."
              : "إنشاء ومتابعة الأفكار ضمن نطاق إدارتك (5.23.3 حوكمة الابتكار)."}
          </p>
        </div>
        {!includeArchived && (
          <Button asChild>
            <Link href="/governance/ideas/new">
              <Plus className="h-4 w-4" />
              فكرة جديدة
            </Link>
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => {
            const active = !includeArchived && (searchParams.status ?? "") === f.value;
            const href = f.value ? `/governance/ideas?status=${f.value}` : "/governance/ideas";
            return (
              <Link
                key={f.value}
                href={href}
                className={cn(
                  "rounded-full px-3 py-1 text-[12.5px] transition-colors",
                  active ? "bg-primary text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-300",
                )}
              >
                {f.label}
              </Link>
            );
          })}
        </div>

        {/* Same ?archived=1 mechanism used on /solutions: a GET checkbox toggle. */}
        <form method="GET" className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-[12px] text-muted">
            <input type="checkbox" name="archived" value="1" defaultChecked={includeArchived} className="h-4 w-4 accent-primary" />
            عرض الأرشيف فقط
          </label>
          <Button type="submit" size="sm" variant="outline">تطبيق</Button>
        </form>
      </div>

      {ideas.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-2 px-6 py-16 text-center">
            <p className="text-sm text-muted">
              {includeArchived ? "لا توجد أفكار مؤرشفة حاليًا ضمن نطاقك." : "لا توجد أفكار مطابقة ضمن نطاقك."}
            </p>
            {!includeArchived && (
              <Button asChild size="sm" variant="outline">
                <Link href="/governance/ideas/new">إنشاء أول فكرة</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-start">
                <thead>
                  <tr className="border-b border-border text-[11.5px] text-muted dark:border-border-dark">
                    <th className="px-4 py-2.5 text-start font-medium">العنوان</th>
                    <th className="px-4 py-2.5 text-start font-medium">الحالة</th>
                    <th className="px-4 py-2.5 text-start font-medium">الإدارة</th>
                    <th className="px-4 py-2.5 text-start font-medium">مقدّم الفكرة</th>
                    <th className="px-4 py-2.5 text-start font-medium">آخر تحديث</th>
                    {includeArchived && <th className="px-4 py-2.5 text-start font-medium">إجراء</th>}
                  </tr>
                </thead>
                <tbody>
                  {ideas.map((idea) => {
                    const flags = includeArchived
                      ? computeIdeaActionFlags(ctx, { status: idea.status, submittedById: null, departmentId: idea.departmentId })
                      : null;
                    return (
                      <tr key={idea.id} className="border-b border-border/60 last:border-0 hover:bg-slate-50/60 dark:border-border-dark/60 dark:hover:bg-white/5">
                        <td className="px-4 py-2.5">
                          <Link href={`/governance/ideas/${idea.id}`} className="text-[13px] font-semibold text-primary hover:underline">
                            {idea.titleAr}
                          </Link>
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge variant={STATUS_VARIANT[idea.status] ?? "neutral"}>{IDEA_STATUS_LABELS[idea.status]}</Badge>
                        </td>
                        <td className="px-4 py-2.5 text-[12px] text-muted">{idea.departmentName ?? "—"}</td>
                        <td className="px-4 py-2.5 text-[12px] text-muted">{idea.authorName ?? "—"}</td>
                        <td className="px-4 py-2.5 text-[12px] text-muted">{new Date(idea.updatedAt).toLocaleDateString("ar")}</td>
                        {includeArchived && (
                          <td className="px-4 py-2.5">
                            {flags?.canRestore ? <RestoreIdeaRowButton ideaId={idea.id} /> : <span className="text-[11.5px] text-muted">—</span>}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
