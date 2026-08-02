import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { requirePermission, getAccessContext, can } from "@/server/authz";
import { isAuthorizationError } from "@/server/authorization";
import { getIdeaById, computeIdeaActionFlags } from "@/modules/ideas/service";
import { listIdeaEvaluations, listInfoRequests, computeReviewFlags } from "@/modules/ideas/evaluation-service";
import { IDEA_STATUS_LABELS } from "@/modules/ideas/schema";
import { getIdeaDecisionHistory, computeDecisionFlags } from "@/modules/ideas/decision-service";
import { getLinkedSolution } from "@/modules/ideas/conversion-service";
import { IdeaActionBar } from "@/modules/ideas/components/idea-actions";
import { ReviewPanel } from "@/modules/ideas/components/review-panel";
import { EvaluationTimeline } from "@/modules/ideas/components/evaluation-timeline";
import { DecisionPanel } from "@/modules/ideas/components/decision-panel";
import { DecisionHistory } from "@/modules/ideas/components/decision-history";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "تفاصيل الفكرة" };

export default async function IdeaDetailsPage({ params }: { params: { id: string } }) {
  await requirePermission("idea.view");
  const ctx = (await getAccessContext())!;

  let idea;
  try {
    idea = await getIdeaById(ctx, params.id);
  } catch (e) {
    if (isAuthorizationError(e) && (e.code === "NOT_FOUND" || e.code === "OUT_OF_SCOPE")) notFound();
    throw e;
  }

  const flags = computeIdeaActionFlags(ctx, { status: idea.status, submittedById: idea.submittedById, departmentId: idea.departmentId });
  const [evaluations, infoRequests, decisions, linkedSolution] = await Promise.all([
    listIdeaEvaluations(ctx, idea.id),
    listInfoRequests(ctx, idea.id),
    getIdeaDecisionHistory(ctx, idea.id),
    getLinkedSolution(ctx, idea.id),
  ]);
  const reviewFlags = computeReviewFlags(ctx, { status: idea.status, submittedById: idea.submittedById }, can(ctx, "idea.evaluate"));
  const decisionFlags = computeDecisionFlags(
    ctx,
    { status: idea.status, submittedById: idea.submittedById },
    { decide: can(ctx, "idea.decide"), createSolution: can(ctx, "solution.create") },
  );
  // Most recent finalized decision — the target for a governed correction.
  const finalizedDecisionId = decisions.find((d) => d.finalizedAt)?.id ?? null;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href="/governance/ideas" className="inline-flex items-center gap-1 text-[12.5px] text-muted hover:text-primary">
          <ArrowRight className="h-3.5 w-3.5" />
          العودة إلى الأفكار
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">{idea.titleAr}</h1>
          <Badge variant="primary">{IDEA_STATUS_LABELS[idea.status]}</Badge>
          {idea.archivedAt && <Badge variant="neutral">مؤرشفة</Badge>}
        </div>
      </div>

      <IdeaActionBar ideaId={idea.id} flags={flags} />

      <ReviewPanel ideaId={idea.id} flags={reviewFlags} />

      <DecisionPanel ideaId={idea.id} flags={decisionFlags} finalizedDecisionId={finalizedDecisionId} />

      {linkedSolution && (
        <Card className="border-primary/30 bg-primary-50/40">
          <CardHeader>
            <CardTitle>الحل الابتكاري المرتبط</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[13.5px] font-semibold text-slate-800 dark:text-slate-100">{linkedSolution.nameAr}</p>
            <p className="mt-1 text-[12px] text-muted">
              الحالة: {linkedSolution.status} · مرحلة النضج: {linkedSolution.maturityStage} · التنفيذ: {linkedSolution.implementationStatus}
            </p>
            <p className="mt-1 text-[11.5px] text-muted">
              أُنشئ بالتحويل في {new Date(linkedSolution.createdAt).toLocaleString("ar")}
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>الوصف والمشكلة</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-slate-700 dark:text-slate-200">
            {idea.description || "لا يوجد وصف."}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>معلومات الفكرة</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-[13px] sm:grid-cols-2">
            <div className="flex justify-between border-b border-border/50 py-1 dark:border-border-dark/50">
              <dt className="text-muted">الإدارة المالكة</dt>
              <dd className="font-medium text-slate-700 dark:text-slate-200">{idea.department?.nameAr ?? "—"}</dd>
            </div>
            <div className="flex justify-between border-b border-border/50 py-1 dark:border-border-dark/50">
              <dt className="text-muted">النشاط المصدر</dt>
              <dd className="font-medium text-slate-700 dark:text-slate-200">{idea.activity?.nameAr ?? "—"}</dd>
            </div>
            <div className="flex justify-between border-b border-border/50 py-1 dark:border-border-dark/50">
              <dt className="text-muted">مقدّم الفكرة</dt>
              <dd className="font-medium text-slate-700 dark:text-slate-200">{idea.submittedBy?.name ?? "—"}</dd>
            </div>
            <div className="flex justify-between border-b border-border/50 py-1 dark:border-border-dark/50">
              <dt className="text-muted">آخر تحديث</dt>
              <dd className="font-medium text-slate-700 dark:text-slate-200">{new Date(idea.updatedAt).toLocaleString("ar")}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <EvaluationTimeline evaluations={evaluations} infoRequests={infoRequests} />

      <DecisionHistory decisions={decisions} />
    </div>
  );
}
