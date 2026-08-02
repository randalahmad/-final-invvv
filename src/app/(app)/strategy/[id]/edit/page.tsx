import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { requirePermission, getAccessContext } from "@/server/authz";
import { isAuthorizationError } from "@/server/authorization";
import { prisma } from "@/server/db";
import { getObjective, listOwnableDepartments } from "@/modules/strategy/service";
import { ObjectiveForm } from "@/modules/strategy/components/objective-form";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "تعديل الهدف الاستراتيجي" };

const day = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : null);

export default async function EditObjectivePage({ params }: { params: { id: string } }) {
  await requirePermission("strategy.objective.manage");
  const ctx = (await getAccessContext())!;

  let objective;
  try {
    objective = await getObjective(ctx, params.id);
  } catch (e) {
    if (isAuthorizationError(e) && (e.code === "NOT_FOUND" || e.code === "OUT_OF_SCOPE")) notFound();
    throw e;
  }
  if (objective.status === "ARCHIVED") notFound();

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
        <Link href={`/strategy/${objective.id}`} className="inline-flex items-center gap-1 text-[12.5px] text-muted hover:text-primary">
          <ArrowRight className="h-3.5 w-3.5" />
          العودة إلى التفاصيل
        </Link>
        <h1 className="mt-2 text-lg font-bold text-slate-800 dark:text-slate-100">تعديل الهدف الاستراتيجي</h1>
      </div>

      <Card>
        <CardContent className="pt-6">
          <ObjectiveForm
            mode="edit"
            departments={departments.map((d: { id: string; nameAr: string }) => ({ id: d.id, label: d.nameAr }))}
            responsibleUsers={users.map((u: { id: string; name: string }) => ({ id: u.id, label: u.name }))}
            initial={{
              objectiveId: objective.id,
              code: objective.code,
              titleAr: objective.titleAr,
              description: objective.description,
              departmentId: objective.departmentId,
              responsibleUserId: objective.responsibleUserId,
              kpi: objective.kpi,
              targetValue: objective.targetValue,
              periodStart: day(objective.periodStart),
              periodEnd: day(objective.periodEnd),
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
