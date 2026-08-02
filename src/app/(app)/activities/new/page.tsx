import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { requirePermission, getAccessContext } from "@/server/authz";
import { listOwnableDepartments } from "@/modules/activities/service";
import { ActivityForm } from "@/modules/activities/components/activity-form";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "نشاط جديد" };

export default async function NewActivityPage() {
  await requirePermission("activity.manage");
  const ctx = (await getAccessContext())!;
  const departments = await listOwnableDepartments(ctx);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href="/activities" className="inline-flex items-center gap-1 text-[12.5px] text-muted hover:text-primary">
          <ArrowRight className="h-3.5 w-3.5" />
          العودة إلى منهجيات الابتكار وفعالياته
        </Link>
        <h1 className="mt-2 text-lg font-bold text-slate-800 dark:text-slate-100">نشاط جديد</h1>
      </div>

      <Card>
        <CardContent className="pt-6">
          <ActivityForm mode="create" departments={departments.map((d: { id: string; nameAr: string }) => ({ id: d.id, label: d.nameAr }))} />
        </CardContent>
      </Card>
    </div>
  );
}
