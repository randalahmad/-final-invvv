import type { DocumentFormat, Prisma, SuggestionReviewOutcome } from "@prisma/client";

import { prisma } from "@/server/db";
import { writeAudit, AUDIT } from "@/server/audit";
import { getStorage } from "@/server/storage";
import type { AccessContext } from "@/server/access-context";
import { requirePermission, requireScope, effectiveScopes } from "@/server/authorization";
import { getDocumentExtractor, ExtractionError } from "./extractor";
import { getAnalysisProvider, type Suggestion } from "./provider";

export type AnalysisErrorCode =
  | "NOT_FOUND"
  | "UNSUPPORTED_FORMAT"
  | "EVIDENCE_LOCKED"
  | "NO_BINARY"
  | "NOT_READY"
  | "INVALID_OUTCOME"
  | "VALIDATION";

export class AnalysisError extends Error {
  code: AnalysisErrorCode;
  constructor(code: AnalysisErrorCode, message?: string) {
    super(message ?? code);
    this.name = "AnalysisError";
    this.code = code;
  }
}

const VIEW = "evidence.view" as const;
const MAP = "evidence.upload" as const; // mapping/linking is an upload-level action

/** Confidence bands (document-analysis.md §5). Below LOW cannot be bulk-accepted. */
export const CONFIDENCE = { HIGH: 0.85, LOW: 0.7 } as const;
export function confidenceBand(c: number | null | undefined): "HIGH" | "MEDIUM" | "LOW" {
  if (c == null) return "LOW";
  if (c >= CONFIDENCE.HIGH) return "HIGH";
  if (c >= CONFIDENCE.LOW) return "MEDIUM";
  return "LOW";
}

const MIME_FORMAT: Record<string, DocumentFormat> = {
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLSX",
};
export function formatFromMime(mime: string | null | undefined): DocumentFormat | null {
  return mime ? MIME_FORMAT[mime] ?? null : null;
}

type EvidenceRow = {
  id: string;
  reviewStatus: string;
  mimeType: string | null;
  storagePath: string | null;
};

async function solutionIdForEvidence(evidenceId: string): Promise<string> {
  const link = await prisma.evidenceLink.findFirst({
    where: { evidenceId, entityType: "INNOVATION_SOLUTION" },
    select: { entityId: true },
  });
  if (!link) throw new AnalysisError("NOT_FOUND", "الدليل غير مرتبط بحل");
  return link.entityId;
}

/**
 * Analysis and suggestion review are INTERNAL actions: the caller must reach the
 * solution through department/organization/platform scope (never merely a
 * partner share or the published projection). `write` also forbids acting on an
 * APPROVED or ARCHIVED evidence item — AI output never mutates approved records.
 */
async function requireInternalEvidence(actor: AccessContext, evidenceId: string, opts: { write: boolean }) {
  const solutionId = await solutionIdForEvidence(evidenceId);
  requirePermission(actor, opts.write ? MAP : VIEW);
  await requireScope(actor, "INNOVATION_SOLUTION", solutionId);

  const solution = await prisma.innovationSolution.findUniqueOrThrow({
    where: { id: solutionId },
    select: { id: true, nameAr: true, owningDepartmentId: true, owningDepartment: { select: { organizationId: true } } },
  });
  const es = effectiveScopes(actor);
  const internal =
    es.platform ||
    (!!solution.owningDepartmentId && es.departmentIds.includes(solution.owningDepartmentId)) ||
    (!!solution.owningDepartment && es.organizationIds.includes(solution.owningDepartment.organizationId));
  if (!internal) throw new AnalysisError("EVIDENCE_LOCKED", "تحليل المستندات من صلاحية الفريق الداخلي");

  const evidence = (await prisma.evidence.findUnique({
    where: { id: evidenceId },
    select: { id: true, reviewStatus: true, mimeType: true, storagePath: true },
  })) as EvidenceRow | null;
  if (!evidence) throw new AnalysisError("NOT_FOUND", "الدليل غير موجود");
  if (opts.write && (evidence.reviewStatus === "APPROVED" || evidence.reviewStatus === "ARCHIVED")) {
    throw new AnalysisError("EVIDENCE_LOCKED", "لا يمكن تعديل تحليل دليل معتمد أو مؤرشف");
  }
  return { solution, evidence };
}

/**
 * Create (or reset) the QUEUED analysis record for an evidence item. Safe to
 * call inside the upload transaction — no auth (the caller is already
 * authorized). Only supported formats are enqueued.
 */
export async function enqueueAnalysisRecord(
  db: Prisma.TransactionClient,
  evidenceId: string,
  format: DocumentFormat,
  actorUserId?: string | null,
) {
  await db.documentAnalysis.upsert({
    where: { evidenceId },
    update: { status: "QUEUED", queuedAt: new Date(), startedAt: null, completedAt: null, failedAt: null, error: null },
    create: { evidenceId, format, status: "QUEUED" },
  });
  await writeAudit(
    { actorUserId: actorUserId ?? null, action: AUDIT.ANALYSIS_QUEUED, entityType: "EVIDENCE", entityId: evidenceId, summary: "إدراج مهمة تحليل" },
    db,
  );
}

/**
 * Run the extraction + analysis pipeline for one evidence item.
 * fp: UPLOADED → PROCESSING → EXTRACTION_READY | PROCESSING_FAILED
 * an: QUEUED   → PROCESSING → COMPLETED        | FAILED
 * reviewStatus is NEVER touched — extraction success never implies approval.
 */
export async function runEvidenceAnalysis(actor: AccessContext, evidenceId: string): Promise<{ status: "COMPLETED" | "FAILED"; suggestions: number }> {
  const { solution, evidence } = await requireInternalEvidence(actor, evidenceId, { write: true });
  const format = formatFromMime(evidence.mimeType);
  if (!format) throw new AnalysisError("UNSUPPORTED_FORMAT", "صيغة غير مدعومة للتحليل");
  if (!evidence.storagePath) throw new AnalysisError("NO_BINARY", "لا يوجد ملف مخزّن للتحليل");

  const extractor = getDocumentExtractor();
  const provider = getAnalysisProvider();

  // Mark processing (both the file and the AI job) and stamp provenance.
  await prisma.$transaction(async (tx) => {
    await tx.evidence.update({ where: { id: evidenceId }, data: { fileProcessingStatus: "PROCESSING" } });
    await tx.documentAnalysis.upsert({
      where: { evidenceId },
      update: {
        status: "PROCESSING",
        startedAt: new Date(),
        error: null,
        failedAt: null,
        completedAt: null,
        provider: provider.name,
        model: provider.model,
        extractorVersion: `${extractor.name}@${extractor.version}`,
        promptVersion: provider.promptVersion ?? null,
      },
      create: {
        evidenceId,
        format,
        status: "PROCESSING",
        startedAt: new Date(),
        provider: provider.name,
        model: provider.model,
        extractorVersion: `${extractor.name}@${extractor.version}`,
        promptVersion: provider.promptVersion ?? null,
      },
    });
    await writeAudit({ actorUserId: actor.userId, action: AUDIT.ANALYSIS_STARTED, entityType: "EVIDENCE", entityId: evidenceId, summary: "بدء تحليل المستند" }, tx);
  });

  try {
    const storage = await getStorage();
    const object = await storage.get(evidence.storagePath);
    const extraction = await extractor.extract(format, object.body);

    const requirements = await prisma.complianceRequirement.findMany({
      where: { isActive: true },
      select: { id: true, code: true, titleAr: true },
    });
    const output = await provider.analyze(extraction, {
      format,
      solution: { id: solution.id, nameAr: solution.nameAr },
      requirements,
    });

    await prisma.$transaction(async (tx) => {
      // Replace any prior suggestions for a re-run (previous review outcomes are
      // superseded; the audit trail retains the history).
      const analysis = await tx.documentAnalysis.findUniqueOrThrow({ where: { evidenceId }, select: { id: true } });
      await tx.analysisSuggestion.deleteMany({ where: { analysisId: analysis.id } });

      for (const s of output.suggestions) {
        await tx.analysisSuggestion.create({ data: toSuggestionRow(analysis.id, s) });
      }
      await tx.documentAnalysis.update({
        where: { evidenceId },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          extractedTextMeta: extraction.meta as Prisma.InputJsonValue,
          sourceRefs: (output.meta ?? {}) as Prisma.InputJsonValue,
        },
      });
      // EXTRACTION_READY is purely technical — it does NOT approve the evidence.
      await tx.evidence.update({ where: { id: evidenceId }, data: { fileProcessingStatus: "EXTRACTION_READY" } });
      await writeAudit(
        {
          actorUserId: actor.userId,
          action: AUDIT.ANALYSIS_COMPLETED,
          entityType: "EVIDENCE",
          entityId: evidenceId,
          summary: "اكتمل التحليل — اقتراحات جاهزة للمراجعة",
          metadata: { suggestions: output.suggestions.length, documentType: output.documentType ?? null, provider: provider.name },
        },
        tx,
      );
    });
    return { status: "COMPLETED", suggestions: output.suggestions.length };
  } catch (e) {
    const reason = e instanceof ExtractionError ? e.code : (e as Error).message?.slice(0, 300) ?? "FAILED";
    await prisma.$transaction(async (tx) => {
      await tx.documentAnalysis.update({ where: { evidenceId }, data: { status: "FAILED", failedAt: new Date(), error: reason } });
      // Manual mapping stays available; reviewStatus is unaffected.
      await tx.evidence.update({ where: { id: evidenceId }, data: { fileProcessingStatus: "PROCESSING_FAILED" } });
      await writeAudit({ actorUserId: actor.userId, action: AUDIT.ANALYSIS_FAILED, entityType: "EVIDENCE", entityId: evidenceId, summary: "فشل التحليل", metadata: { reason } }, tx);
    });
    return { status: "FAILED", suggestions: 0 };
  }
}

function toSuggestionRow(analysisId: string, s: Suggestion): Prisma.AnalysisSuggestionUncheckedCreateInput {
  return {
    analysisId,
    kind: s.kind,
    fieldKey: s.fieldKey ?? null,
    suggestedValue: s.suggestedValue === undefined ? undefined : (s.suggestedValue as Prisma.InputJsonValue),
    targetEntityType: s.targetEntityType ?? null,
    targetEntityId: s.targetEntityId ?? null,
    suggestedRequirementId: s.suggestedRequirementId ?? null,
    confidence: s.confidence ?? null,
    sourcePage: s.source?.page ?? null,
    sourceSection: s.source?.section ?? null,
    sourceCell: s.source?.cell ?? null,
    sourceExcerpt: s.source?.excerpt ?? null,
  };
}

// ── Reads ──────────────────────────────────────────────────────────────────

export async function getEvidenceAnalysis(actor: AccessContext, evidenceId: string) {
  await requireInternalEvidence(actor, evidenceId, { write: false });
  const analysis = await prisma.documentAnalysis.findUnique({
    where: { evidenceId },
    include: { suggestions: { orderBy: [{ kind: "asc" }, { confidence: "desc" }] } },
  });
  return analysis;
}

// ── Suggestion review (human-in-the-loop) ──────────────────────────────────

/**
 * Accept / edit / reject a single suggestion. A human confirmation is the only
 * thing that turns a suggestion into anything official — and even then it never
 * approves the evidence. Accepting a REQUIREMENT_MAP creates the EvidenceLink;
 * accepting a FIELD suggestion for an evidence-owned field (title/classification)
 * updates that field only. IMPACT_ROW acceptance records the outcome (creating
 * ImpactMeasurement rows belongs to the impact workflow, out of this phase).
 */
export async function reviewSuggestion(
  actor: AccessContext,
  suggestionId: string,
  input: { outcome: SuggestionReviewOutcome; editedValue?: unknown },
): Promise<void> {
  if (input.outcome === "PENDING") throw new AnalysisError("INVALID_OUTCOME", "نتيجة مراجعة غير صالحة");

  const suggestion = await prisma.analysisSuggestion.findUnique({
    where: { id: suggestionId },
    include: { analysis: { select: { evidenceId: true } } },
  });
  if (!suggestion) throw new AnalysisError("NOT_FOUND", "الاقتراح غير موجود");
  const evidenceId = suggestion.analysis.evidenceId;
  const { solution } = await requireInternalEvidence(actor, evidenceId, { write: true });

  const accepted = input.outcome === "ACCEPTED" || input.outcome === "EDITED";
  const value = input.outcome === "EDITED" ? input.editedValue : suggestion.suggestedValue;

  await prisma.$transaction(async (tx) => {
    await tx.analysisSuggestion.update({
      where: { id: suggestionId },
      data: {
        reviewOutcome: input.outcome,
        reviewedById: actor.userId,
        reviewedAt: new Date(),
        reviewedValue: input.outcome === "EDITED" ? (input.editedValue as Prisma.InputJsonValue) : undefined,
      },
    });

    if (accepted && suggestion.kind === "REQUIREMENT_MAP" && suggestion.suggestedRequirementId) {
      // The sanctioned human mapping — idempotent create.
      await tx.evidenceLink.upsert({
        where: {
          evidenceId_entityType_entityId: {
            evidenceId,
            entityType: "COMPLIANCE_REQUIREMENT",
            entityId: suggestion.suggestedRequirementId,
          },
        },
        update: {},
        create: {
          evidenceId,
          entityType: "COMPLIANCE_REQUIREMENT",
          entityId: suggestion.suggestedRequirementId,
          requirementId: suggestion.suggestedRequirementId,
        },
      });
      await writeAudit(
        {
          actorUserId: actor.userId,
          action: AUDIT.EVIDENCE_LINKED,
          entityType: "EVIDENCE",
          entityId: evidenceId,
          departmentId: solution.owningDepartmentId,
          summary: "ربط الدليل بمتطلب (من اقتراح مؤكَّد)",
          metadata: { requirementId: suggestion.suggestedRequirementId, fromSuggestion: suggestionId },
        },
        tx,
      );
    }

    if (accepted && suggestion.kind === "FIELD" && suggestion.fieldKey) {
      const v = typeof value === "string" ? value : value != null ? String(value) : null;
      if (v && suggestion.fieldKey === "classification") {
        await tx.evidence.update({ where: { id: evidenceId }, data: { classification: v.slice(0, 80) } });
      } else if (v && suggestion.fieldKey === "title") {
        await tx.evidence.update({ where: { id: evidenceId }, data: { title: v.slice(0, 200) } });
      }
    }

    const action =
      input.outcome === "ACCEPTED" ? AUDIT.SUGGESTION_ACCEPTED : input.outcome === "EDITED" ? AUDIT.SUGGESTION_EDITED : AUDIT.SUGGESTION_REJECTED;
    await writeAudit(
      {
        actorUserId: actor.userId,
        action,
        entityType: "EVIDENCE",
        entityId: evidenceId,
        departmentId: solution.owningDepartmentId,
        summary: "مراجعة اقتراح تحليل",
        metadata: { suggestionId, kind: suggestion.kind, fieldKey: suggestion.fieldKey ?? null },
      },
      tx,
    );
  });
}

/** Bulk-accept only HIGH-confidence suggestions (≥ threshold). Low items excluded. */
export async function acceptHighConfidence(actor: AccessContext, evidenceId: string): Promise<{ accepted: number }> {
  await requireInternalEvidence(actor, evidenceId, { write: true });
  const analysis = await prisma.documentAnalysis.findUnique({ where: { evidenceId }, select: { id: true } });
  if (!analysis) throw new AnalysisError("NOT_READY", "لا يوجد تحليل");

  const high = await prisma.analysisSuggestion.findMany({
    where: { analysisId: analysis.id, reviewOutcome: "PENDING", confidence: { gte: CONFIDENCE.HIGH } },
    select: { id: true },
  });
  for (const s of high) {
    await reviewSuggestion(actor, s.id, { outcome: "ACCEPTED" });
  }
  return { accepted: high.length };
}

/** UI flags — the server re-enforces every action. */
export function computeAnalysisFlags(
  analysisStatus: string | undefined,
  fileProcessingStatus: string,
  reviewStatus: string,
  perms: { canMap: boolean },
) {
  const locked = reviewStatus === "APPROVED" || reviewStatus === "ARCHIVED";
  const running = analysisStatus === "PROCESSING" || fileProcessingStatus === "PROCESSING";
  return {
    canRun: perms.canMap && !locked && !running,
    canReview: perms.canMap && !locked && analysisStatus === "COMPLETED",
    isRunning: running,
  };
}
