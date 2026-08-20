import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Plus } from "lucide-react";

import { requirePermission, getAccessContext } from "@/server/authz";
import { isAuthorizationError } from "@/server/authorization";
import { getCommittee, computeCommitteeFlags } from "@/modules/committees/service";
import { COMMITTEE_STATUS_LABELS, COMMITTEE_TYPE_LABELS } from "@/modules/committees/schema";
import { ArchiveCommitteeButton } from "@/modules/committees/components/committee-actions";
import { MemberList, AddMemberForm } from "@/modules/committees/components/member-panel";
import { MeetingList } from "@/modules/committees/components/meeting-list";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { prisma } from "@/server/db";

export const metadata: Metadata = { title: "تفاصيل اللجنة" };

const STATUS_VARIANT: Record<string, "success" | "neutral" | "warning"> = {
  PROPOSED: "neutral",
  ACTIVE: "success",
  DISSOLVED: "warning",
};

const TASK_STATUS_LABELS: Record<string, string> = {
  OPEN: "مفتوحة",
  IN_PROGRESS: "قيد التنفيذ",
  WAITING: "بانتظار طرف آخر",
  COMPLETED: "مكتملة",
  CANCELLED: "ملغاة",
};
const TASK_PRIORITY_LABELS: Record<string, string> = { LOW: "منخفضة", MEDIUM: "متوسطة", HIGH: "عالية", URGENT: "عاجلة" };

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-[11.5px] text-muted">{label}</dt>
      <dd className="text-[13.5px] text-slate-800 dark:text-slate-100">{value ?? "—"}</dd>
    </div>
  );
}

export default async function CommitteeDetailPage({ params }: { params: { id: string } }) {
  await requirePermission("committee.view");
  const ctx = (await getAccessContext())!;

  let committee;
  try {
    committee = await getCommittee(ctx, params.id);
  } catch (e) {
    if (isAuthorizationError(e) && (e.code === "NOT_FOUND" || e.code === "OUT_OF_SCOPE")) notFound();
    throw e;
  }

  const flags = computeCommitteeFlags(ctx, { archivedAt: committee.archivedAt });
  const fmt = (d: Date | null) => (d ? new Date(d).toLocaleDateString("ar") : "—");
  const nextSequence = (committee.meetings.at(-1)?.sequenceNumber ?? 0) + 1;
  const tasks = await prisma.requirementTask.findMany({
    where: { committeeId: committee.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/governance/committees" className="inline-flex items-center gap-1 text-[12.5px] text-muted hover:text-primary">
            <ArrowRight className="h-3.5 w-3.5" />
            العودة إلى لجان الحوكمة
          </Link>
          <h1 className="mt-2 text-lg font-bold text-slate-800 dark:text-slate-100">{committee.nameAr}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant={STATUS_VARIANT[committee.status] ?? "neutral"}>{COMMITTEE_STATUS_LABELS[committee.status] ?? committee.status}</Badge>
            {committee.category && <Badge variant="neutral">{committee.category}</Badge>}
            {committee.archivedAt && <Badge variant="neutral">مؤرشفة</Badge>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {flags.canEdit && (
            <Button asChild size="sm" variant="outline">
              <Link href={`/governance/committees/${committee.id}/edit`}>تعديل</Link>
            </Button>
          )}
          {flags.canArchive && <ArchiveCommitteeButton committeeId={committee.id} />}
        </div>
      </div>

      <Card>
        <CardContent className="grid grid-cols-1 gap-5 pt-6 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="الجهة/المنظمة" value={committee.organization?.nameAr ?? null} />
          <Field label="النوع" value={COMMITTEE_TYPE_LABELS[committee.type] ?? committee.type} />
          <Field label="الجهة/الإدارة المرتبطة" value={committee.relatedDepartmentName} />
          <Field label="الرئيس/المسؤول" value={committee.chairName} />
          <Field label="أمين اللجنة" value={committee.secretaryName} />
          <Field label="تاريخ التشكيل" value={fmt(committee.formationDate)} />
          <Field label="تاريخ بداية العمل" value={fmt(committee.operationStartDate)} />
          <Field label="دورية الاجتماعات" value={committee.meetingFrequency} />
          <Field label="رقم قرار التشكيل" value={committee.decisionNumber} />
          <Field label="تاريخ القرار" value={fmt(committee.decisionDate)} />
          <Field label="جهة الاعتماد" value={committee.decisionApprovingAuthority} />
          <Field label="تاريخ السريان" value={fmt(committee.decisionEffectiveDate)} />
          <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-3">
            <dt className="text-[11.5px] text-muted">الغرض</dt>
            <dd className="text-[13.5px] text-slate-800 dark:text-slate-100">{committee.purpose ?? "—"}</dd>
          </div>
          <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-3">
            <dt className="text-[11.5px] text-muted">وصف الاختصاص</dt>
            <dd className="text-[13.5px] text-slate-800 dark:text-slate-100">{committee.mandateDescription ?? "—"}</dd>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-4 px-5 py-4">
          <h2 className="text-[13.5px] font-bold text-slate-800 dark:text-slate-100">الأعضاء</h2>
          <MemberList committeeId={committee.id} members={committee.members} canManage={flags.canManageMembers} />
          {flags.canManageMembers && <AddMemberForm committeeId={committee.id} />}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-4 px-5 py-4">
          <h2 className="text-[13.5px] font-bold text-slate-800 dark:text-slate-100">المهام</h2>
          {tasks.length === 0 ? (
            <p className="text-[12.5px] text-muted">لا توجد مهام مسندة بعد.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {tasks.map((task: (typeof tasks)[number]) => (
                <div key={task.id} id={`task-${task.id}`} className="flex flex-col gap-1 rounded-xl border border-border px-3.5 py-2.5 dark:border-border-dark">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">{task.title}</p>
                    <Badge variant="neutral">{TASK_STATUS_LABELS[task.status] ?? task.status}</Badge>
                  </div>
                  <p className="text-[11.5px] text-muted">
                    الأولوية: {TASK_PRIORITY_LABELS[task.priority] ?? task.priority} · الموعد: {fmt(task.dueDate)}
                    {task.assignedToUserId ? ` · مُسندة إلى: ${task.assignedToUserId}` : " · غير مُسندة إلى مستخدم منصة"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-4 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[13.5px] font-bold text-slate-800 dark:text-slate-100">الاجتماعات</h2>
            {flags.canManageMeetings && (
              <Button asChild size="sm">
                <Link href={`/governance/committees/${committee.id}/meetings/new`}>
                  <Plus className="h-4 w-4" />
                  محضر {nextSequence}
                </Link>
              </Button>
            )}
          </div>
          <MeetingList committeeId={committee.id} meetings={committee.meetings} canManage={flags.canManageMeetings} />
        </CardContent>
      </Card>
    </div>
  );
}
