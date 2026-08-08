import type { Metadata } from "next";
import Link from "next/link";
import { FileDown } from "lucide-react";

import { requirePermission, getAccessContext } from "@/server/authz";
import { getPlatformSummary } from "@/modules/reports/service";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";

export const metadata: Metadata = { title: "التقارير" };

export default async function ReportsPage() {
  await requirePermission("compliance.view");
  const ctx = (await getAccessContext())!;
  const summary = await getPlatformSummary(ctx);

  const cards: { label: string; value: number }[] = [
    { label: "الحلول الابتكارية", value: summary.solutions },
    { label: "الأفكار النشطة", value: summary.ideas },
    { label: "الأهداف الاستراتيجية", value: summary.strategicObjectives },
    { label: "الأنشطة الموثَّقة هذه السنة", value: summary.activitiesThisYear },
    { label: "التحديات المسجَّلة", value: summary.challenges },
    { label: "لجان الحوكمة", value: summary.committees },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="التقارير" description="ملخص حي من البيانات الفعلية ضمن نطاقك، مع الوصول إلى التقارير التفصيلية المتاحة." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="flex flex-col gap-1 px-5 py-5">
              <p className="text-[12px] text-muted">{c.label}</p>
              <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div>
            <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">تقرير امتثال حل محدَّد</p>
            <p className="mt-1 text-[12px] text-muted">افتح صفحة أي حل ابتكاري لتصدير تقرير امتثاله التفصيلي.</p>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href="/solutions">
              <FileDown className="h-4 w-4" />
              الانتقال إلى الحلول
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
