import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import { getAccessContext, can } from "@/server/authz";
import { listKanbanIdeas } from "@/modules/ideas/kanban";
import { IdeasKanban } from "@/modules/ideas/components/ideas-kanban";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";

export const metadata: Metadata = { title: "اللجان والتقييمات" };

export default async function GovernancePage() {
  const ctx = await getAccessContext();
  // Server-side gate: no idea data is fetched without `idea.view`.
  if (!ctx || !can(ctx, "idea.view")) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title="اللجان والتقييمات" description="متابعة اللجان ومسارات تقييم مخرجات الابتكار ضمن صلاحياتك." />
        <Card className="border-dashed">
          <CardContent className="px-6 py-16 text-center">
            <p className="text-sm text-muted">تفاصيل التقييم متاحة للمستخدمين المخوّلين فقط.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const columns = await listKanbanIdeas(ctx);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="اللجان والتقييمات"
        description="متابعة لجان الابتكار ومسار تقييم السجلات الفعلية ضمن نطاقك."
        action={<div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/governance/committees">اللجان</Link>
          </Button>
          <Button asChild>
            <Link href="/governance/ideas/new">
              <Plus className="h-4 w-4" />
              إضافة إلى بنك الابتكار
            </Link>
          </Button>
        </div>}
      />

      <Card>
        <CardHeader>
          <CardTitle>مسار التقييم والاعتماد</CardTitle>
        </CardHeader>
        <CardContent>
          <IdeasKanban columns={columns} />
        </CardContent>
      </Card>
    </div>
  );
}
