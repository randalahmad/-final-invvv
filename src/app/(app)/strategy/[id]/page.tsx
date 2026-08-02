import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { requirePermission, getAccessContext } from "@/server/authz";
import { isAuthorizationError } from "@/server/authorization";
import { getObjective, computeObjectiveFlags, listAssignmentsForObjective, listOwnableDepartments } from "@/modules/strategy/service";
import { RECORD_STATUS_LABELS } from "@/modules/strategy/schema";
import { ObjectiveActionBar } from "@/modules/strategy/components/objective-actions";
import { AssignmentForm, AssignmentList } from "@/modules/strategy/components/assignment-panel";
import { prisma } from "@/server/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "تفاصيل الهدف الاستراتيجي" };

const STATUS_VARIANT: Record<string, "success" | "neutral" | "warning"> = {
  ACTIVE: "success",
  DRAFT: "neutral",
  ARCHIVED: "neutral",
};

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-[11.5px] text-muted">{label}</dt>
      <dd className="text-[13.5px] text-slate-800 dark:text-slate-100">{value ?? "—"}</dd>
    </div>
  );
}

export default async function ObjectiveDetailPage({ params }: { params: { id: string } }) {
  await requirePermission("strategy.objective.view");
  const ctx = (await getAccessContext())!;

  let objective;
  try {
    objective = await getObjective(ctx, params.id);
  } catch (e) {
    if (isAuthorizationError(e) && (e.code === "NOT_FOUND" || e.code === "OUT_OF_SCOPE")) notFound();
    throw e;
  }

  const flags = computeObjectiveFlags(ctx, { status: objective.status, departmentId: objective.departmentId });
  const fmt = (d: Date | null) => (d ? new Date(d).toLocaleDateString("ar") : "—");

  const canManageAssignment = ctx.permissions.has("strategy.assignment.manage");
  const canUploadDocument = ctx.permissions.has("strategy.document.upload");
  const canManageDocument = ctx.permissions.has("strategy.document.manage");
  const canArchiveDocument = ctx.permissions.has("strategy.document.archive");

  const [assignments, requirements, departments] = await Promise.all([
    listAssignmentsForObjective(ctx, objective.id),
    prisma.complianceRequirement.findMany({
      where: { sectionCode: "5.23", isActive: true },
      orderBy: { code: "asc" },
      select: { id: true, code: true, titleAr: true },
    }),
    canManageAssignment ? listOwnableDepartments(ctx) : Promise.resolve([]),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/strategy" className="inline-flex items-center gap-1 text-[12.5px] text-muted hover:text-primary">
            <ArrowRight className="h-3.5 w-3.5" />
            العودة إلى التخطيط الاستراتيجي
          </Link>
          <h1 className="mt-2 text-lg font-bold text-slate-800 dark:text-slate-100">
            {objective.code ? `${objective.code} — ${objective.titleAr}` : objective.titleAr}
          </h1>
          <div className="mt-2">
            <Badge variant={STATUS_VARIANT[objective.status] ?? "neutral"}>{RECORD_STATUS_LABELS[objective.status] ?? objective.status}</Badge>
          </div>
        </div>
        <ObjectiveActionBar objectiveId={objective.id} flags={flags} />
      </div>

      <Card>
        <CardContent className="grid grid-cols-1 gap-5 pt-6 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="الجهة المسؤولة" value={objective.department?.nameAr ?? null} />
          <Field label="مؤشر الأداء (KPI)" value={objective.kpi} />
          <Field label="القيمة المستهدفة" value={objective.targetValue} />
          <Field label="بداية الفترة" value={fmt(objective.periodStart)} />
          <Field label="نهاية الفترة" value={fmt(objective.periodEnd)} />
          <div className="sm:col-span-2 lg:col-span-3">
            <Field label="الوصف" value={objective.description} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-5 px-5 py-5">
          <div>
            <h2 className="text-[14.5px] font-bold text-slate-800 dark:text-slate-100">معايير الامتثال المُسنَدة وحالة الاستيفاء</h2>
            <p className="mt-1 text-[12.5px] text-muted">
              الحالة محسوبة من البيانات الفعلية (وثيقة معتمدة غير مؤرشفة + شاهد فعلي مرفوع) — لا تُخزَّن كحقل مستقل.
            </p>
          </div>
          <AssignmentList
            objectiveId={objective.id}
            assignments={assignments}
            canManageAssignment={canManageAssignment}
            canUploadDocument={canUploadDocument}
            canManageDocument={canManageDocument}
            canArchiveDocument={canArchiveDocument}
          />
          {canManageAssignment && (
            <AssignmentForm
              objectiveId={objective.id}
              requirements={requirements.map((r: { id: string; code: string | null; titleAr: string }) => ({
                id: r.id,
                label: r.code ? `${r.code} — ${r.titleAr}` : r.titleAr,
              }))}
              departments={departments.map((d: { id: string; nameAr: string }) => ({ id: d.id, label: d.nameAr }))}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

