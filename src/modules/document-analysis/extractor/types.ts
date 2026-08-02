import type { DocumentFormat } from "@prisma/client";

/**
 * Provider-independent document extraction contract. Extraction always runs
 * locally/server-side (it is NOT the deferred external-vs-local decision — that
 * concerns the AnalysisProvider). A DocumentExtractor turns raw bytes into text,
 * optional tables, and structural metadata, with best-effort source references.
 */

/** A tabular block detected in the document (XLSX sheets; DOCX/PDF tables). */
export interface ExtractedTable {
  name?: string; // sheet name / caption
  headers: string[];
  rows: string[][];
  /** 1-based cell address of the header row anchor, when known (e.g. "A1"). */
  headerCell?: string;
}

export interface ExtractionMeta {
  pageCount?: number;
  /** 0..1 ratio of pages/sections that yielded text. Low → likely scanned. */
  textCoverage?: number;
  /** Scanned PDF with no text layer — OCR is out of MVP scope. */
  needsOCR?: boolean;
  /** XLSX (or other) structure the MVP extractor cannot safely interpret. */
  unsupportedStructure?: boolean;
  /** Free-form per-extractor detail (never contains credentials). */
  detail?: Record<string, unknown>;
}

export interface ExtractionResult {
  text: string;
  tables: ExtractedTable[];
  meta: ExtractionMeta;
}

export interface DocumentExtractor {
  readonly name: string;
  readonly version: string;
  supports(format: DocumentFormat): boolean;
  extract(format: DocumentFormat, bytes: Buffer): Promise<ExtractionResult>;
}

export class ExtractionError extends Error {
  code: "UNSUPPORTED" | "CORRUPT" | "ENCRYPTED" | "EMPTY" | "FAILED";
  constructor(code: ExtractionError["code"], message?: string) {
    super(message ?? code);
    this.name = "ExtractionError";
    this.code = code;
  }
}
