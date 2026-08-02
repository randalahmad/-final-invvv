import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { requirePermission, getAccessContext } from "@/server/authz";
import { isAuthorizationError } from "@/server/authorization";
import { getActivity, listOwnableDepartments } from "@/modules/activities/service";
import { ActivityForm } from "@/modules/activities/components/activity-form";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "تعديل النشاط" };

const day = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : null);

export default async function EditActivityPage({ params }: { params: { id: string } }) {
  await requirePermission("activity.manage");
  const ctx = (await getAccessContext())!;

  let activity;
  try {
    activity = await getActivity(ctx, params.id);
  } catch (e) {
    if (isAuthorizationError(e) && (e.code === "NOT_FOUND" || e.code === "OUT_OF_SCOPE")) notFound();
    throw e;
  }
  if (activity.archivedAt) notFound();

  const departments = await listOwnableDepartments(ctx);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href={`/activities/${activity.id}`} className="inline-flex items-center gap-1 text-[12.5px] text-muted hover:text-primary">
          <ArrowRight className="h-3.5 w-3.5" />
          العودة إلى التفاصيل
        </Link>
        <h1 className="mt-2 text-lg font-bold text-slate-800 dark:text-slate-100">تعديل النشاط</h1>
      </div>

      <Card>
        <CardContent className="pt-6">
          <ActivityForm
            mode="edit"
            departments={departments.map((d: { id: string; nameAr: string }) => ({ id: d.id, label: d.nameAr }))}
            initial={{
              activityId: activity.id,
              nameAr: activity.nameAr,
              type: activity.type,
              description: activity.description,
              objectivesAr: activity.objectivesAr,
              eventUrl: activity.eventUrl,
              organizerDepartmentId: activity.organizerDepartmentId,
              startDate: day(activity.startDate),
              endDate: day(activity.endDate),
              status: activity.status,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
