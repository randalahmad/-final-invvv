import type { AnalysisSuggestionKind, DocumentFormat, LinkedEntityType } from "@prisma/client";

import type { ExtractionResult } from "../extractor/types";

/**
 * Provider-independent AI-analysis contract. THIS is the seam where the deferred
 * self-hosted-vs-external decision lives: a local heuristic provider (no
 * external calls) ships as the default; an LLM-backed provider can be swapped in
 * without touching the pipeline. A provider only ever PROPOSES — it can never
 * approve evidence, mutate official records, or affect readiness.
 */

/** Best-effort source reference for a suggestion (page/section/cell/text range). */
export interface SourceRef {
  page?: number;
  section?: string;
  cell?: string;
  excerpt?: string;
}

export interface Suggestion {
  kind: AnalysisSuggestionKind; // FIELD | REQUIREMENT_MAP | IMPACT_ROW
  fieldKey?: string;
  suggestedValue?: unknown;
  targetEntityType?: LinkedEntityType;
  targetEntityId?: string;
  suggestedRequirementId?: string;
  confidence: number; // 0.0–1.0
  source?: SourceRef;
}

export interface AnalysisContext {
  format: DocumentFormat;
  /** The solution the evidence is attached to (context prior for classification). */
  solution: { id: string; nameAr: string };
  fileName?: string | null;
  /** Compliance requirements available for mapping (id + code + title). */
  requirements: { id: string; code: string; titleAr: string }[];
}

export interface AnalysisOutput {
  /** Classified document type label, e.g. "APPROVAL_MEMO" / "IMPACT_REPORT". */
  documentType?: string;
  suggestions: Suggestion[];
  /** Coarse metadata surfaced to the reviewer (never credentials). */
  meta?: Record<string, unknown>;
}

export interface AnalysisProvider {
  readonly name: string;
  readonly model: string;
  readonly promptVersion?: string;
  analyze(extraction: ExtractionResult, context: AnalysisContext): Promise<AnalysisOutput>;
}
