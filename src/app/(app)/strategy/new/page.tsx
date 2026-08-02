import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { requirePermission, getAccessContext } from "@/server/authz";
import { prisma } from "@/server/db";
import { listOwnableDepartments } from "@/modules/strategy/service";
import { ObjectiveForm } from "@/modules/strategy/components/objective-form";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "هدف استراتيجي جديد" };

export default async function NewObjectivePage() {
  await requirePermission("strategy.objective.manage");
  const ctx = (await getAccessContext())!;

  const [departments, users] = await Promise.all([
    listOwnableDepartments(ctx),
    prisma.user.findMany({
      where: { status: "ACTIVE", registrationStatus: "APPROVED" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href="/strategy" className="inline-flex items-center gap-1 text-[12.5px] text-muted hover:text-primary">
          <ArrowRight className="h-3.5 w-3.5" />
          العودة إلى التخطيط الاستراتيجي
        </Link>
        <h1 className="mt-2 text-lg font-bold text-slate-800 dark:text-slate-100">هدف استراتيجي جديد</h1>
      </div>

      <Card>
        <CardContent className="pt-6">
          <ObjectiveForm
            mode="create"
            departments={departments.map((d: { id: string; nameAr: string }) => ({ id: d.id, label: d.nameAr }))}
            responsibleUsers={users.map((u: { id: string; name: string }) => ({ id: u.id, label: u.name }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
