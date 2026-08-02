import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import { getAccessContext, can } from "@/server/authz";
import { listKanbanIdeas } from "@/modules/ideas/kanban";
import { IdeasKanban } from "@/modules/ideas/components/ideas-kanban";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "حوكمة الابتكار" };

export default async function GovernancePage() {
  const ctx = await getAccessContext();
  // Server-side gate: no idea data is fetched without `idea.view`.
  if (!ctx || !can(ctx, "idea.view")) {
    return (
      <Card className="border-dashed">
        <CardContent className="px-6 py-16 text-center">
          <p className="text-sm text-muted">لوحة حوكمة الأفكار متاحة للمستخدمين المخوّلين فقط.</p>
        </CardContent>
      </Card>
    );
  }

  const columns = await listKanbanIdeas(ctx);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">حوكمة الابتكار — من الفكرة إلى الاعتماد</h1>
          <p className="mt-1 text-[13px] text-muted">
            لوحة مبنية على سجلات الأفكار الفعلية ضمن نطاقك. اضغط على أي بطاقة لفتح تفاصيل الفكرة وتنفيذ الإجراءات.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/governance/committees">اللجان</Link>
          </Button>
          <Button asChild>
            <Link href="/governance/ideas/new">
              <Plus className="h-4 w-4" />
              فكرة جديدة
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>مسار حوكمة الأفكار</CardTitle>
        </CardHeader>
        <CardContent>
          <IdeasKanban columns={columns} />
        </CardContent>
      </Card>
    </div>
  );
}
