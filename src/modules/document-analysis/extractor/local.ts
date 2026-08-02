import type { DocumentFormat } from "@prisma/client";

import { ExtractionError, type DocumentExtractor, type ExtractionResult, type ExtractedTable } from "./types";

/**
 * Local, self-hosted extraction using in-process libraries (pdf-parse, mammoth,
 * exceljs). No document ever leaves the environment. Libraries are dynamically
 * imported so they never reach the edge/client bundle.
 */
export class LocalDocumentExtractor implements DocumentExtractor {
  readonly name = "local";
  readonly version = "1.0.0";

  supports(format: DocumentFormat): boolean {
    return format === "PDF" || format === "DOCX" || format === "XLSX";
  }

  async extract(format: DocumentFormat, bytes: Buffer): Promise<ExtractionResult> {
    if (!bytes || bytes.length === 0) throw new ExtractionError("EMPTY", "empty document");
    switch (format) {
      case "PDF":
        return this.extractPdf(bytes);
      case "DOCX":
        return this.extractDocx(bytes);
      case "XLSX":
        return this.extractXlsx(bytes);
      default:
        throw new ExtractionError("UNSUPPORTED", `unsupported format ${format}`);
    }
  }

  private async extractPdf(bytes: Buffer): Promise<ExtractionResult> {
    let parsed: { text: string; numpages: number };
    try {
      // Import the lib entry directly to avoid pdf-parse's debug harness.
      // The deep path has no bundled types; resolve via a dynamic specifier so
      // TS treats it as `any` (shape asserted below) without a ts-directive.
      const deep = "pdf-parse/lib/pdf-parse.js";
      const mod = (await import(/* webpackIgnore: true */ deep)) as {
        default: (b: Buffer) => Promise<{ text: string; numpages: number }>;
      };
      parsed = await mod.default(bytes);
    } catch (e) {
      const msg = (e as Error).message ?? "";
      if (/password|encrypt/i.test(msg)) throw new ExtractionError("ENCRYPTED", "encrypted PDF");
      throw new ExtractionError("CORRUPT", "could not parse PDF");
    }
    const text = (parsed.text ?? "").trim();
    const pageCount = parsed.numpages || 0;
    // A text layer of a few chars per page is our (crude) "has text" signal.
    const needsOCR = pageCount > 0 && text.length < pageCount * 8;
    return {
      text,
      tables: [],
      meta: {
        pageCount,
        textCoverage: needsOCR ? 0 : 1,
        needsOCR,
        detail: { chars: text.length },
      },
    };
  }

  private async extractDocx(bytes: Buffer): Promise<ExtractionResult> {
    let result: { value: string };
    try {
      const mammoth = (await import("mammoth")) as unknown as {
        extractRawText: (o: { buffer: Buffer }) => Promise<{ value: string }>;
      };
      result = await mammoth.extractRawText({ buffer: bytes });
    } catch (e) {
      const msg = (e as Error).message ?? "";
      if (/password|encrypt/i.test(msg)) throw new ExtractionError("ENCRYPTED", "protected DOCX");
      throw new ExtractionError("CORRUPT", "could not parse DOCX");
    }
    const text = (result.value ?? "").trim();
    // Heading heuristic: short lines are treated as section headings.
    const headings = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && l.length <= 60);
    return {
      text,
      tables: [],
      meta: { textCoverage: text.length > 0 ? 1 : 0, detail: { chars: text.length, headings: headings.slice(0, 20) } },
    };
  }

  private async extractXlsx(bytes: Buffer): Promise<ExtractionResult> {
    const ExcelJS = (await import("exceljs")).default as unknown as {
      Workbook: new () => {
        xlsx: { load: (b: Buffer) => Promise<unknown> };
        worksheets: {
          name: string;
          rowCount: number;
          getRow: (i: number) => { values: unknown[] };
        }[];
      };
    };
    const wb = new ExcelJS.Workbook();
    try {
      await wb.xlsx.load(bytes);
    } catch {
      throw new ExtractionError("CORRUPT", "could not parse XLSX");
    }

    const tables: ExtractedTable[] = [];
    let unsupportedStructure = false;
    const textParts: string[] = [];

    for (const sheet of wb.worksheets) {
      // MVP: a single header row over contiguous data rows. Find the first
      // non-empty row and treat it as the header.
      const maxScan = Math.min(sheet.rowCount, 500);
      let headerRowIndex = 0;
      let headers: string[] = [];
      for (let i = 1; i <= maxScan; i++) {
        const cells = cellStrings(sheet.getRow(i).values);
        if (cells.some((c) => c !== "")) {
          headerRowIndex = i;
          headers = cells;
          break;
        }
      }
      if (headerRowIndex === 0) continue; // empty sheet

      // A "structured" header is mostly labels (non-numeric).
      const labelCells = headers.filter((h) => h !== "");
      const numericHeaders = labelCells.filter((h) => /^-?\d+(\.\d+)?$/.test(h)).length;
      if (labelCells.length === 0 || numericHeaders > labelCells.length / 2) {
        unsupportedStructure = true;
      }

      const rows: string[][] = [];
      for (let i = headerRowIndex + 1; i <= maxScan; i++) {
        const cells = cellStrings(sheet.getRow(i).values);
        if (cells.every((c) => c === "")) continue;
        rows.push(cells);
        if (rows.length >= 200) break; // bound MVP extraction
      }

      tables.push({ name: sheet.name, headers, rows, headerCell: `A${headerRowIndex}` });
      textParts.push(`${sheet.name}: ${headers.join(" | ")}`);
    }

    if (tables.length === 0) unsupportedStructure = true;

    return {
      text: textParts.join("\n"),
      tables,
      meta: { unsupportedStructure, detail: { sheets: wb.worksheets.length } },
    };
  }
}

/** Normalise an ExcelJS row `.values` (1-based, index 0 is empty) into strings. */
function cellStrings(values: unknown[]): string[] {
  const out: string[] = [];
  for (let i = 1; i < values.length; i++) {
    const v = values[i];
    if (v === null || v === undefined) {
      out.push("");
    } else if (typeof v === "object" && v !== null && "result" in (v as Record<string, unknown>)) {
      // Formula cell → use its last cached result only (formulas not evaluated).
      const r = (v as { result?: unknown }).result;
      out.push(r === null || r === undefined ? "" : String(r));
    } else if (typeof v === "object" && v !== null && "text" in (v as Record<string, unknown>)) {
      out.push(String((v as { text?: unknown }).text ?? ""));
    } else {
      out.push(String(v));
    }
  }
  return out;
}
