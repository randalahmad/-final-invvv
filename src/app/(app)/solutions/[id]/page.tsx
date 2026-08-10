import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, BarChart3, FolderCheck, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";

import { requirePermission, getAccessContext, can } from "@/server/authz";
import { isAuthorizationError, findActiveShareForEntity } from "@/server/authorization";
import { prisma } from "@/server/db";
import { getSolutionById, computeSolutionCompleteness } from "@/modules/solutions/service";
import { listChallengesForSolution } from "@/modules/challenges/service";
import { CHALLENGE_STATUS_LABELS } from "@/modules/challenges/schema";
import { computeLifecycleFlags } from "@/modules/solutions/lifecycle-service";
import { listSolutionShares, listParticipatingOrganizations } from "@/modules/solutions/sharing-service";
import { getSolutionHistory } from "@/modules/solutions/history-service";
import { LifecyclePanel } from "@/modules/solutions/components/lifecycle-panel";
import { SharingPanel, OrganizationsPanel } from "@/modules/solutions/components/sharing-panel";
import { HistoryTimeline } from "@/modules/solutions/components/history-timeline";
import {
  MATURITY_LABELS,
  IMPLEMENTATION_LABELS,
  SOURCE_LABELS,
  RECORD_STATUS_LABELS,
} from "@/modules/solutions/schema";
import { CompletenessPanel } from "@/modules/solutions/components/completeness-panel";
import { SolutionActionBar, PartnerFieldsForm } from "@/modules/solutions/components/solution-actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "تفاصيل الحل" };

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border/50 py-1.5 dark:border-border-dark/50">
      <dt className="text-muted">{label}</dt>
      <dd className="text-end font-medium text-slate-700 dark:text-slate-200">{value ?? "—"}</dd>
    </div>
  );
}

export default async function SolutionDetailsPage({ params }: { params: { id: string } }) {
  await requirePermission("solution.view");
  const ctx = (await getAccessContext())!;

  let solution;
  try {
    solution = await getSolutionById(ctx, params.id);
  } catch (e) {
    if (isAuthorizationError(e) && (e.code === "NOT_FOUND" || e.code === "OUT_OF_SCOPE")) notFound();
    throw e;
  }

  const completeness = computeSolutionCompleteness(solution as unknown as Record<string, unknown>);
  const canViewEvidence = can(ctx, "evidence.view");
  const canViewCompliance = can(ctx, "compliance.view");
  const canViewImpact = can(ctx, "impact.view");
  const canEdit = can(ctx, "solution.update") && solution.status === "DRAFT";
  const canArchive = can(ctx, "solution.archive") && solution.status !== "ARCHIVED";
  // Partners edit only through an active share's allowedFields.
  const share = await findActiveShareForEntity(ctx.userId, "INNOVATION_SOLUTION", solution.id);

  const canManage = can(ctx, "solution.update");
  const lifecycleFlags = computeLifecycleFlags(solution, canManage);
  const canViewChallenges = can(ctx, "challenge.view");
  const [orgs, history, shares, allOrgs, partnerUsers, linkedChallenges] = await Promise.all([
    listParticipatingOrganizations(ctx, solution.id),
    getSolutionHistory(ctx, solution.id),
    canManage ? listSolutionShares(ctx, solution.id) : Promise.resolve([]),
    canManage
      ? prisma.organization.findMany({ where: { type: { not: "OWNER" } }, orderBy: { nameAr: "asc" }, select: { id: true, nameAr: true } })
      : Promise.resolve([]),
    canManage
      ? prisma.user.findMany({
          where: {
            status: "ACTIVE",
            registrationStatus: "APPROVED",
            roleAssignments: { some: { role: { key: "EXTERNAL_PARTNER" } } },
          },
          orderBy: { name: "asc" },
          select: { id: true, name: true, email: true },
        })
      : Promise.resolve([]),
    canViewChallenges ? listChallengesForSolution(ctx, solution.id) : Promise.resolve([]),
  ]);
  const linkedOrgIds = new Set(orgs.map((o) => o.id));
  const availableOrgs = allOrgs.filter((o) => !linkedOrgIds.has(o.id)).map((o) => ({ id: o.id, label: o.nameAr }));

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href="/solutions" className="inline-flex items-center gap-1 text-[12.5px] text-muted hover:text-primary">
          <ArrowRight className="h-3.5 w-3.5" />
          العودة إلى السجل
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">{solution.nameAr}</h1>
          <Badge variant={solution.status === "ARCHIVED" ? "neutral" : solution.status === "ACTIVE" ? "success" : "primary"}>
            {RECORD_STATUS_LABELS[solution.status]}
          </Badge>
          {solution.idea && <Badge variant="info">محوّل من فكرة</Badge>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SolutionActionBar solutionId={solution.id} canEdit={canEdit} canArchive={canArchive} />
        {canViewEvidence && (
          <Button asChild size="sm" variant="outline">
            <Link href={`/solutions/${solution.id}/evidence`}>
              <FolderCheck className="h-4 w-4" />
              أدلة الحل
            </Link>
          </Button>
        )}
        {canViewCompliance && (
          <Button asChild size="sm" variant="outline">
            <Link href={`/solutions/${solution.id}/compliance`}>
              <ShieldCheck className="h-4 w-4" />
              ملف الامتثال (تقديري)
            </Link>
          </Button>
        )}
        {canViewImpact && (
          <Button asChild size="sm" variant="outline">
            <Link href={`/impact/${solution.id}`}>
              <BarChart3 className="h-4 w-4" />
              قياس الأثر
            </Link>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="flex flex-col gap-5 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>الوصف والمشكلة</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div>
                <p className="mb-1 text-[11.5px] text-muted">الوصف</p>
                <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-slate-700 dark:text-slate-200">
                  {solution.description || "—"}
                </p>
              </div>
              <div>
                <p className="mb-1 text-[11.5px] text-muted">وصف المشكلة</p>
                <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-slate-700 dark:text-slate-200">
                  {solution.problemStatement || "—"}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>بيانات الحل</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 gap-x-6 text-[13px] sm:grid-cols-2">
                <Row label="الإدارة المالكة" value={solution.owningDepartment?.nameAr} />
                <Row label="المسؤول عن الحل" value={solution.owner?.name} />
                <Row label="المصدر" value={SOURCE_LABELS[solution.source]} />
                <Row label="النشاط المصدر" value={solution.activity?.nameAr} />
                <Row label="الهدف الاستراتيجي" value={solution.strategicObjective?.titleAr} />
                <Row label="مرحلة النضج" value={MATURITY_LABELS[solution.maturityStage]} />
                <Row label="حالة التنفيذ" value={IMPLEMENTATION_LABELS[solution.implementationStatus]} />
                <Row label="تاريخ البدء" value={solution.startDate ? new Date(solution.startDate).toLocaleDateString("ar") : null} />
                <Row label="الانتهاء المستهدف" value={solution.targetEndDate ? new Date(solution.targetEndDate).toLocaleDateString("ar") : null} />
                <Row label="الانتهاء الفعلي" value={solution.actualEndDate ? new Date(solution.actualEndDate).toLocaleDateString("ar") : null} />
                <Row label="المدة (أشهر)" value={solution.durationMonths} />
                <Row label="التكلفة التقديرية" value={solution.cost ? `${solution.cost} ر.س` : null} />
                <Row label="الفئة المستفيدة" value={solution.targetBeneficiaries} />
                <Row label="التقنيات المستخدمة" value={solution.technologies} />
                <Row label="المخاطر" value={solution.risks} />
                <Row label="ملاحظات" value={solution.notes} />
              </dl>
            </CardContent>
          </Card>

          {solution.idea && (
            <Card className="border-info/30 bg-info-bg/40">
              <CardHeader>
                <CardTitle>الفكرة المصدر</CardTitle>
              </CardHeader>
              <CardContent>
                <Link href={`/governance/ideas/${solution.idea.id}`} className="text-[13.5px] font-semibold text-primary hover:underline">
                  {solution.idea.titleAr}
                </Link>
                <p className="mt-1 text-[12px] text-muted">حالة الفكرة: {solution.idea.status}</p>
              </CardContent>
            </Card>
          )}

          {share && (
            <PartnerFieldsForm
              solutionId={solution.id}
              allowedFields={share.allowedFields}
              values={{
                notes: solution.notes,
                description: solution.description,
                technologies: solution.technologies,
                targetBeneficiaries: solution.targetBeneficiaries,
                risks: solution.risks,
              }}
            />
          )}

          <OrganizationsPanel
            solutionId={solution.id}
            organizations={orgs}
            available={availableOrgs}
            canManage={canManage}
          />

          {canManage && (
            <SharingPanel
              solutionId={solution.id}
              shares={shares}
              partners={partnerUsers.map((u) => ({ id: u.id, label: `${u.name} — ${u.email}` }))}
            />
          )}

          <HistoryTimeline events={history} />
        </div>

        <div className="flex flex-col gap-5">
          <CompletenessPanel completeness={completeness} />
          {canViewChallenges && linkedChallenges.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>التحديات المرتبطة</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {linkedChallenges.map((c) => (
                  <Link
                    key={c.id}
                    href={`/challenges/${c.id}`}
                    className="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-[12.5px] hover:border-primary/50 dark:border-border-dark"
                  >
                    <span className="text-slate-700 dark:text-slate-200">{c.titleAr}</span>
                    <Badge variant="neutral">{CHALLENGE_STATUS_LABELS[c.status] ?? c.status}</Badge>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}
          <LifecyclePanel solutionId={solution.id} flags={lifecycleFlags} />
        </div>
      </div>
    </div>
  );
}
