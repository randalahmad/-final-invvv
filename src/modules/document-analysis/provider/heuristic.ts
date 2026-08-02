import type { AnalysisContext, AnalysisOutput, AnalysisProvider, Suggestion } from "./types";
import type { ExtractionResult } from "../extractor/types";

/**
 * Rule-based local analysis provider — the default. Deterministic, offline, and
 * sends nothing to third parties, so it is safe pending the provider decision
 * and lets tests run without credentials. It classifies by keywords, suggests a
 * few evidence fields, recommends a requirement mapping by code/keyword match,
 * and (for XLSX) proposes candidate impact rows. It only ever proposes.
 */

const DOC_TYPE_KEYWORDS: { type: string; ar: string[] }[] = [
  { type: "APPROVAL_MEMO", ar: ["اعتماد", "محضر", "قرار", "توصية"] },
  { type: "IMPACT_REPORT", ar: ["الأثر", "المستفيدون", "التوفير", "الوفورات", "مؤشر"] },
  { type: "AGREEMENT", ar: ["اتفاقية", "مذكرة تفاهم", "تعاون", "شراكة"] },
  { type: "TECHNICAL_DOC", ar: ["فني", "تقني", "معماري", "المتطلبات"] },
];

const IMPACT_HEADER_HINTS = ["مؤشر", "الأساس", "المستهدف", "الفعلي", "الوحدة", "baseline", "target", "actual", "unit", "indicator"];

export class HeuristicAnalysisProvider implements AnalysisProvider {
  readonly name = "heuristic";
  readonly model = "rules-1.0.0";
  readonly promptVersion = "n/a";

  async analyze(extraction: ExtractionResult, context: AnalysisContext): Promise<AnalysisOutput> {
    const text = extraction.text ?? "";
    const suggestions: Suggestion[] = [];

    // 1) Document-type classification (keyword score over extracted text).
    const scored = DOC_TYPE_KEYWORDS.map((d) => ({
      type: d.type,
      hits: d.ar.reduce((n, kw) => n + (text.includes(kw) ? 1 : 0), 0),
    })).sort((a, b) => b.hits - a.hits);
    const best = scored[0];
    const documentType = best && best.hits > 0 ? best.type : undefined;
    const coverage = extraction.meta.textCoverage ?? (text.length > 0 ? 1 : 0);

    if (documentType) {
      suggestions.push({
        kind: "FIELD",
        fieldKey: "classification",
        suggestedValue: documentType,
        confidence: round(0.5 + 0.1 * best.hits) * clamp(coverage, 0.3, 1),
        source: { excerpt: firstSnippet(text) },
      });
    }

    // 2) First meaningful line → a title suggestion.
    const firstLine = text.split(/\r?\n/).map((l) => l.trim()).find((l) => l.length >= 6);
    if (firstLine) {
      suggestions.push({
        kind: "FIELD",
        fieldKey: "title",
        suggestedValue: firstLine.slice(0, 120),
        confidence: round(0.6 * clamp(coverage, 0.2, 1)),
        source: { excerpt: firstLine.slice(0, 120) },
      });
    }

    // 3) Requirement mapping — match a requirement code or title keyword in text.
    for (const req of context.requirements) {
      const codeHit = req.code && text.includes(req.code);
      const titleWords = req.titleAr.split(/\s+/).filter((w) => w.length >= 4);
      const titleHit = titleWords.some((w) => text.includes(w));
      if (codeHit || titleHit) {
        suggestions.push({
          kind: "REQUIREMENT_MAP",
          suggestedRequirementId: req.id,
          targetEntityType: "COMPLIANCE_REQUIREMENT",
          targetEntityId: req.id,
          confidence: round(codeHit ? 0.9 : 0.72),
          source: { excerpt: codeHit ? req.code : undefined },
        });
      }
    }

    // 4) XLSX → candidate impact rows from a structured table.
    if (context.format === "XLSX" && !extraction.meta.unsupportedStructure) {
      for (const table of extraction.tables) {
        const headerL = table.headers.map((h) => h.toLowerCase());
        const looksImpact = IMPACT_HEADER_HINTS.some((h) => headerL.some((c) => c.includes(h.toLowerCase())));
        if (!looksImpact) continue;
        const headerMatch = headerL.filter((c) => IMPACT_HEADER_HINTS.some((h) => c.includes(h.toLowerCase()))).length;
        const conf = round(clamp(headerMatch / Math.max(table.headers.length, 1), 0.4, 0.95));
        table.rows.slice(0, 25).forEach((row, i) => {
          const record: Record<string, string> = {};
          table.headers.forEach((h, c) => (record[h || `col${c}`] = row[c] ?? ""));
          suggestions.push({
            kind: "IMPACT_ROW",
            suggestedValue: record,
            confidence: conf,
            source: { section: table.name, cell: `${table.headerCell ?? "A1"}+${i + 1}` },
          });
        });
      }
    }

    return {
      documentType,
      suggestions,
      meta: {
        textChars: text.length,
        needsOCR: !!extraction.meta.needsOCR,
        unsupportedStructure: !!extraction.meta.unsupportedStructure,
      },
    };
  }
}

function round(n: number): number {
  return Math.max(0, Math.min(1, Math.round(n * 100) / 100));
}
function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
function firstSnippet(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 160);
}
