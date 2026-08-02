import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { requirePermission, getAccessContext } from "@/server/authz";
import { prisma } from "@/server/db";
import { listOwnableDepartments } from "@/modules/solutions/service";
import { SolutionForm } from "@/modules/solutions/components/solution-form";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "حل جديد" };

export default async function NewSolutionPage() {
  await requirePermission("solution.create");
  const ctx = (await getAccessContext())!;

  const [departments, activities, objectives, owners] = await Promise.all([
    listOwnableDepartments(ctx),
    prisma.innovationActivity.findMany({ orderBy: { nameAr: "asc" }, select: { id: true, nameAr: true } }),
    prisma.strategicObjective.findMany({ orderBy: { titleAr: "asc" }, select: { id: true, titleAr: true } }),
    prisma.user.findMany({
      where: { status: "ACTIVE", registrationStatus: "APPROVED" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href="/solutions" className="inline-flex items-center gap-1 text-[12.5px] text-muted hover:text-primary">
          <ArrowRight className="h-3.5 w-3.5" />
          العودة إلى السجل
        </Link>
        <h1 className="mt-2 text-lg font-bold text-slate-800 dark:text-slate-100">تسجيل حل ابتكاري جديد</h1>
        <p className="mt-1 text-[13px] text-muted">يُحفظ كمسودة ويمكن تعديله لاحقًا.</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <SolutionForm
            mode="create"
            departments={departments.map((d) => ({ id: d.id, label: d.nameAr }))}
            activities={activities.map((a) => ({ id: a.id, label: a.nameAr }))}
            objectives={objectives.map((o) => ({ id: o.id, label: o.titleAr }))}
            owners={owners.map((u) => ({ id: u.id, label: u.name }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
