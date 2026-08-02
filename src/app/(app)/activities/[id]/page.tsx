import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { requirePermission, getAccessContext } from "@/server/authz";
import { isAuthorizationError } from "@/server/authorization";
import { getActivity, computeActivityFlags } from "@/modules/activities/service";
import { listActivityEvidence } from "@/modules/evidence/service";
import { ACTIVITY_TYPE_LABELS, ACTIVITY_STATUS_LABELS } from "@/modules/activities/schema";
import { ActivityActionBar } from "@/modules/activities/components/activity-actions";
import { ActivityEvidenceUploadForm, ActivityEvidenceList } from "@/modules/activities/components/activity-evidence";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "تفاصيل النشاط" };

const STATUS_VARIANT: Record<string, "success" | "neutral" | "warning" | "danger"> = {
  PLANNED: "neutral",
  ONGOING: "warning",
  COMPLETED: "success",
  CANCELLED: "danger",
};

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-[11.5px] text-muted">{label}</dt>
      <dd className="text-[13.5px] text-slate-800 dark:text-slate-100">{value ?? "—"}</dd>
    </div>
  );
}

export default async function ActivityDetailPage({ params }: { params: { id: string } }) {
  await requirePermission("activity.view");
  const ctx = (await getAccessContext())!;

  let activity;
  try {
    activity = await getActivity(ctx, params.id);
  } catch (e) {
    if (isAuthorizationError(e) && (e.code === "NOT_FOUND" || e.code === "OUT_OF_SCOPE")) notFound();
    throw e;
  }

  const flags = computeActivityFlags(ctx, { archivedAt: activity.archivedAt, organizerDepartmentId: activity.organizerDepartmentId });
  const fmt = (d: Date | null) => (d ? new Date(d).toLocaleDateString("ar") : "—");
  const evidenceRows = await listActivityEvidence(ctx, activity.id);
  const canUploadEvidence = flags.canEdit; // activity.manage + in-scope + not archived
  const canArchiveEvidence = ctx.permissions.has("evidence.approve");

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/activities" className="inline-flex items-center gap-1 text-[12.5px] text-muted hover:text-primary">
            <ArrowRight className="h-3.5 w-3.5" />
            العودة إلى منهجيات الابتكار وفعالياته
          </Link>
          <h1 className="mt-2 text-lg font-bold text-slate-800 dark:text-slate-100">{activity.nameAr}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="neutral">{ACTIVITY_TYPE_LABELS[activity.type] ?? activity.type}</Badge>
            <Badge variant={STATUS_VARIANT[activity.status] ?? "neutral"}>{ACTIVITY_STATUS_LABELS[activity.status] ?? activity.status}</Badge>
            {activity.archivedAt && <Badge variant="neutral">مؤرشف</Badge>}
          </div>
        </div>
        <ActivityActionBar activityId={activity.id} flags={flags} />
      </div>

      <Card>
        <CardContent className="grid grid-cols-1 gap-5 pt-6 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="الجهة المنظمة" value={activity.organizerDepartment?.nameAr ?? null} />
          <Field label="تاريخ البداية" value={fmt(activity.startDate)} />
          <Field label="تاريخ النهاية" value={fmt(activity.endDate)} />
          {activity.eventUrl && (
            <div className="flex flex-col gap-1">
              <dt className="text-[11.5px] text-muted">رابط الحدث</dt>
              <dd className="text-[13.5px]">
                <a href={activity.eventUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  {activity.eventUrl}
                </a>
              </dd>
            </div>
          )}
          <div className="sm:col-span-2 lg:col-span-3">
            <Field label="الوصف" value={activity.description} />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <Field label="الأهداف" value={activity.objectivesAr} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-4 px-5 py-4">
          <div>
            <h2 className="text-[13.5px] font-bold text-slate-800 dark:text-slate-100">الشواهد</h2>
            <p className="mt-1 text-[12px] text-muted">شواهد التوثيق أثناء التنفيذ وبعد إغلاق النشاط.</p>
          </div>
          <ActivityEvidenceList rows={evidenceRows} canArchive={canArchiveEvidence} />
          {canUploadEvidence && (
            <div className="border-t border-border pt-4 dark:border-border-dark">
              <ActivityEvidenceUploadForm activityId={activity.id} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
