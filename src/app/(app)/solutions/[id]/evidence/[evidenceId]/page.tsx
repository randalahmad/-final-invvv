import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { requirePermission, getAccessContext, can } from "@/server/authz";
import { isAuthorizationError } from "@/server/authorization";
import {
  getEvidenceById,
  listEvidenceLinks,
  getEvidenceTimeline,
  computeEvidenceFlags,
  EvidenceError,
} from "@/modules/evidence/service";
import { REVIEW_STATUS_LABELS, FILE_STATUS_LABELS } from "@/modules/evidence/schema";
import { EvidenceActionBar } from "@/modules/evidence/components/evidence-actions";
import { EvidenceLinksPanel } from "@/modules/evidence/components/evidence-links-panel";
import { EvidenceTimeline } from "@/modules/evidence/components/evidence-timeline";
import { EvidenceFilePanel } from "@/modules/evidence/components/evidence-file-panel";
import { getEvidenceAnalysis, computeAnalysisFlags, confidenceBand } from "@/modules/document-analysis/service";
import { AnalysisPanel, type AnalysisView } from "@/modules/document-analysis/components/analysis-panel";
import { prisma } from "@/server/db";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "تفاصيل الدليل" };

const REVIEW_VARIANT: Record<string, "neutral" | "primary" | "success" | "warning" | "danger"> = {
  DRAFT: "neutral",
  SUBMITTED: "primary",
  UNDER_REVIEW: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  ARCHIVED: "neutral",
};

function formatSize(bytes: number | null): string {
  if (!bytes || bytes <= 0) return "—";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function EvidenceDetailsPage({ params }: { params: { id: string; evidenceId: string } }) {
  await requirePermission("evidence.view");
  const ctx = (await getAccessContext())!;

  let evidence;
  try {
    evidence = await getEvidenceById(ctx, params.evidenceId);
  } catch (e) {
    if (e instanceof EvidenceError && e.code === "NOT_FOUND") notFound();
    if (isAuthorizationError(e) && (e.code === "NOT_FOUND" || e.code === "OUT_OF_SCOPE")) notFound();
    throw e;
  }
  if (evidence.solutionId !== params.id) notFound();

  const [links, timeline] = await Promise.all([
    listEvidenceLinks(ctx, evidence.id),
    getEvidenceTimeline(ctx, evidence.id),
  ]);

  const flags = computeEvidenceFlags(
    { reviewStatus: evidence.reviewStatus, uploadedById: evidence.uploadedById },
    ctx,
    { canUpload: can(ctx, "evidence.upload"), canApprove: can(ctx, "evidence.approve") },
  );

  const canReplaceFile =
    can(ctx, "evidence.upload") && evidence.reviewStatus !== "APPROVED" && evidence.reviewStatus !== "ARCHIVED";

  // AI analysis is internal-only; a non-internal reader simply sees no panel.
  let analysisView: AnalysisView | null = null;
  let analysisAvailable = false;
  try {
    const analysis = await getEvidenceAnalysis(ctx, evidence.id);
    analysisAvailable = true;
    if (analysis) {
      const reqIds = Array.from(
        new Set(analysis.suggestions.map((s) => s.suggestedRequirementId).filter((v): v is string => !!v)),
      );
      const reqs = reqIds.length
        ? await prisma.complianceRequirement.findMany({ where: { id: { in: reqIds } }, select: { id: true, code: true, titleAr: true } })
        : [];
      const reqLabel = new Map(reqs.map((r) => [r.id, `${r.code} — ${r.titleAr}`]));
      analysisView = {
        status: analysis.status,
        provider: analysis.provider,
        model: analysis.model,
        extractorVersion: analysis.extractorVersion,
        promptVersion: analysis.promptVersion,
        completedAt: analysis.completedAt?.toISOString() ?? null,
        failedAt: analysis.failedAt?.toISOString() ?? null,
        error: analysis.error,
        suggestions: analysis.suggestions.map((s) => ({
          id: s.id,
          kind: s.kind,
          fieldKey: s.fieldKey,
          suggestedValue: s.suggestedValue,
          suggestedRequirementId: s.suggestedRequirementId,
          requirementLabel: s.suggestedRequirementId ? reqLabel.get(s.suggestedRequirementId) ?? null : null,
          confidence: s.confidence,
          band: confidenceBand(s.confidence),
          source: { page: s.sourcePage, section: s.sourceSection, cell: s.sourceCell, excerpt: s.sourceExcerpt },
          reviewOutcome: s.reviewOutcome,
        })),
      };
    }
  } catch {
    analysisAvailable = false; // partner/viewer or out-of-scope → no analysis surface
  }
  const analysisFlags = computeAnalysisFlags(
    analysisView?.status,
    evidence.fileProcessingStatus,
    evidence.reviewStatus,
    { canMap: can(ctx, "evidence.upload") },
  );

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link
          href={`/solutions/${params.id}/evidence`}
          className="inline-flex items-center gap-1 text-[12.5px] text-muted hover:text-primary"
        >
          <ArrowRight className="h-3.5 w-3.5" />
          العودة إلى الأدلة
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">{evidence.title}</h1>
          <Badge variant={REVIEW_VARIANT[evidence.reviewStatus] ?? "neutral"}>
            {REVIEW_STATUS_LABELS[evidence.reviewStatus] ?? evidence.reviewStatus}
          </Badge>
          <Badge variant="neutral">{FILE_STATUS_LABELS[evidence.fileProcessingStatus] ?? evidence.fileProcessingStatus}</Badge>
        </div>
      </div>

      <EvidenceActionBar evidenceId={evidence.id} solutionId={params.id} flags={flags} />

      {evidence.notes && (
        <Card>
          <CardHeader>
            <CardTitle>الوصف</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-slate-700 dark:text-slate-200">{evidence.notes}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>بيانات الملف</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-[13px] sm:grid-cols-2">
            <div className="flex justify-between border-b border-border/50 py-1 dark:border-border-dark/50">
              <dt className="text-muted">اسم الملف</dt>
              <dd className="font-medium text-slate-700 dark:text-slate-200">{evidence.fileName ?? "—"}</dd>
            </div>
            <div className="flex justify-between border-b border-border/50 py-1 dark:border-border-dark/50">
              <dt className="text-muted">النوع</dt>
              <dd className="font-medium text-slate-700 dark:text-slate-200">{evidence.mimeType ?? "—"}</dd>
            </div>
            <div className="flex justify-between border-b border-border/50 py-1 dark:border-border-dark/50">
              <dt className="text-muted">الحجم</dt>
              <dd className="font-medium text-slate-700 dark:text-slate-200">{formatSize(evidence.sizeBytes)}</dd>
            </div>
            <div className="flex justify-between border-b border-border/50 py-1 dark:border-border-dark/50">
              <dt className="text-muted">التصنيف</dt>
              <dd className="font-medium text-slate-700 dark:text-slate-200">{evidence.classification ?? "—"}</dd>
            </div>
            <div className="flex justify-between border-b border-border/50 py-1 dark:border-border-dark/50">
              <dt className="text-muted">رفعه</dt>
              <dd className="font-medium text-slate-700 dark:text-slate-200">{evidence.uploadedBy?.name ?? "—"}</dd>
            </div>
            <div className="flex justify-between border-b border-border/50 py-1 dark:border-border-dark/50">
              <dt className="text-muted">تاريخ الرفع</dt>
              <dd className="font-medium text-slate-700 dark:text-slate-200">{new Date(evidence.createdAt).toLocaleString("ar")}</dd>
            </div>
            <div className="flex justify-between border-b border-border/50 py-1 dark:border-border-dark/50">
              <dt className="text-muted">الإصدار</dt>
              <dd className="font-medium text-slate-700 dark:text-slate-200">{evidence.version}</dd>
            </div>
            <div className="flex justify-between border-b border-border/50 py-1 sm:col-span-2 dark:border-border-dark/50">
              <dt className="text-muted">بصمة التحقق (SHA-256)</dt>
              <dd className="font-mono text-[11px] text-slate-700 dark:text-slate-200">{evidence.checksum ?? "—"}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <EvidenceFilePanel
        evidenceId={evidence.id}
        solutionId={params.id}
        hasBinary={!!evidence.storagePath}
        version={evidence.version}
        canDownload
        canReplace={canReplaceFile}
        replaceBlockedReason={
          evidence.reviewStatus === "APPROVED" || evidence.reviewStatus === "ARCHIVED"
            ? "لا يمكن استبدال ملف دليل معتمد أو مؤرشف."
            : undefined
        }
      />

      {analysisAvailable && (
        <AnalysisPanel evidenceId={evidence.id} solutionId={params.id} analysis={analysisView} flags={analysisFlags} />
      )}

      <EvidenceLinksPanel
        evidenceId={evidence.id}
        solutionId={params.id}
        solutionLinkEntityId={evidence.solutionId}
        links={links}
        canLink={flags.canLink}
      />

      <EvidenceTimeline events={timeline} />
    </div>
  );
}
