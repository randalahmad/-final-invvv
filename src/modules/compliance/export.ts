import { READINESS_BAND_LABELS, NA_STATE_LABELS, ESTIMATED_LABEL } from "./schema";
import type { ComplianceFile } from "./service";

/**
 * Pure builders for the basic exportable compliance report (mvp-scope.md §2.7).
 * CSV only — the bundled official ZIP package is explicitly out of MVP scope.
 * Every row carries the "estimated / internal" qualifier so an exported file can
 * never be mistaken for an official DGA assessment.
 */

/** RFC-4180-safe CSV cell (quotes when needed; escapes embedded quotes). */
function csvCell(value: string | number | null | undefined): string {
  const s = value == null ? "" : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csvRow(cells: (string | number | null | undefined)[]): string {
  return cells.map(csvCell).join(",");
}

/**
 * Build a CSV of the compliance file: a header banner stating the estimate
 * qualifier + overall readiness, then one row per requirement with its readiness,
 * band, gate status, missing counts and N/A state. Prefixed with a UTF-8 BOM so
 * Excel renders Arabic correctly.
 */
export function buildComplianceCsv(file: ComplianceFile): string {
  const lines: string[] = [];
  lines.push(csvRow([ESTIMATED_LABEL]));
  lines.push(csvRow(["الحل", file.solution.nameAr]));
  lines.push(csvRow(["الإدارة", file.solution.departmentAr ?? "—"]));
  lines.push(
    csvRow(["الجاهزية التقديرية العامة", file.overallReadiness == null ? "—" : `${file.overallReadiness}%`]),
  );
  lines.push(csvRow(["تاريخ التوليد", file.generatedAt]));
  lines.push("");
  lines.push(
    csvRow([
      "القسم",
      "رمز المتطلب",
      "المتطلب",
      "الجاهزية التقديرية %",
      "التصنيف",
      "محجوب ببند إلزامي",
      "حقول ناقصة",
      "أدلة ناقصة",
      "حالة عدم الانطباق",
      "مستثنى من الاحتساب",
    ]),
  );

  for (const section of file.sections) {
    for (const r of section.requirements) {
      const readiness = r.excluded ? "—" : r.score ? `${r.score.estimatedReadiness}` : "—";
      const band = r.excluded || !r.score ? "—" : READINESS_BAND_LABELS[r.score.band];
      const blocked = r.score && r.score.blockedByMandatory.length ? r.score.blockedByMandatory.map((b) => b.label).join(" | ") : "—";
      lines.push(
        csvRow([
          section.code,
          r.code,
          r.titleAr,
          readiness,
          band,
          blocked,
          r.missingFields.length,
          r.missingEvidence.length,
          NA_STATE_LABELS[r.naStatus.state] ?? r.naStatus.state,
          r.excluded ? "نعم" : "لا",
        ]),
      );
    }
  }

  // BOM + CRLF line endings for spreadsheet compatibility.
  return "﻿" + lines.join("\r\n") + "\r\n";
}

/** Safe ASCII-ish filename stem for the export (falls back to the id). */
export function exportFileName(file: ComplianceFile): string {
  return `compliance-${file.solution.id}.csv`;
}
