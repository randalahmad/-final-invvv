import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { requirePermission, getAccessContext } from "@/server/authz";
import { prisma } from "@/server/db";
import { listOwnableDepartments } from "@/modules/ideas/service";
import { IdeaForm } from "@/modules/ideas/components/idea-form";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "فكرة جديدة" };

export default async function NewIdeaPage() {
  await requirePermission("idea.view");
  const ctx = (await getAccessContext())!;
  const [departments, activities] = await Promise.all([
    listOwnableDepartments(ctx),
    prisma.innovationActivity.findMany({ orderBy: { nameAr: "asc" }, select: { id: true, nameAr: true } }),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href="/governance/ideas" className="inline-flex items-center gap-1 text-[12.5px] text-muted hover:text-primary">
          <ArrowRight className="h-3.5 w-3.5" />
          العودة إلى الأفكار
        </Link>
        <h1 className="mt-2 text-lg font-bold text-slate-800 dark:text-slate-100">إنشاء فكرة جديدة</h1>
        <p className="mt-1 text-[13px] text-muted">تُحفظ كمسودة ويمكنك تعديلها قبل التقديم.</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <IdeaForm mode="create" departments={departments} activities={activities} />
        </CardContent>
      </Card>
    </div>
  );
}
