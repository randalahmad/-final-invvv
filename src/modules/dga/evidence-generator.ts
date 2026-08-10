import { Document, Packer, Paragraph, HeadingLevel, Table, TableRow, TableCell, TextRun, WidthType, AlignmentType } from "docx";

import type { RequirementWorkspaceConfig } from "./workspace-config";
import type { WorkspaceData } from "./workspace-status";

/**
 * 8.4 — Evidence Generator. Produces a REAL .docx buffer assembled from actual
 * requirement/workspace/governance data — not a template the user fills in and
 * not a plain file upload. The buffer is handed to the existing
 * uploadRequirementEvidence() pipeline (validation, storage, Evidence +
 * EvidenceLink rows, audit, readiness recompute) — this module only builds
 * the document content, it never touches storage or the database itself.
 */
export interface EvidenceDocumentInput {
  unitCode: string; // e.g. "5.23.1"
  unitName: string;
  requirementCode: string; // e.g. "5.23.1.1"
  requirementTitle: string;
  applicationRequirement: string;
  config: RequirementWorkspaceConfig;
  workspaceData: WorkspaceData;
  ownerName: string | null;
  responsibleName: string | null;
  raci: { responsibility: string; name: string | null }[];
  tasks: { title: string; status: string; assignedTo: string }[];
  evidenceRefs: { title: string; fileName: string | null; reviewStatus: string }[];
  workflowState: string;
  reviewComment: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  version: number;
  generatedByName: string;
  generatedAt: Date;
}

const RESPONSIBILITY_LABELS: Record<string, string> = { RESPONSIBLE: "مسؤول التنفيذ", ACCOUNTABLE: "المسؤول المعتمد", CONSULTED: "مستشار", INFORMED: "مطَّلع" };
const WORKFLOW_LABELS: Record<string, string> = { DRAFT: "مسودة", IN_PROGRESS: "قيد التنفيذ", SUBMITTED_FOR_REVIEW: "أُرسل للمراجعة", UNDER_REVIEW: "قيد المراجعة", RETURNED_FOR_AMENDMENT: "أعيد للتعديل", RESUBMITTED: "أُعيد إرساله", PENDING_APPROVAL: "بانتظار الاعتماد", APPROVED: "معتمد", COMPLETED: "مكتمل" };

function headerCell(text: string) {
  return new TableCell({ width: { size: 30, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text, bold: true })] })] });
}
function valueCell(text: string) {
  return new TableCell({ width: { size: 70, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: text || "—" })] })] });
}
function infoRow(label: string, value: string) {
  return new TableRow({ children: [headerCell(label), valueCell(value)] });
}

/** Renders the workspace's own field values (per section/field, as configured for this requirement) — not invented content. */
function fieldValueRows(config: RequirementWorkspaceConfig, data: WorkspaceData): TableRow[] {
  const rows: TableRow[] = [];
  for (const section of config.sections) {
    if (section.repeatable) {
      const items = (data[section.key] as Record<string, unknown>[] | undefined) ?? [];
      items.forEach((item, idx) => {
        for (const field of section.fields) {
          const v = item?.[field.key];
          if (v === undefined || v === null || v === "") continue;
          rows.push(infoRow(`${section.title} #${idx + 1} — ${field.label}`, String(v)));
        }
      });
    } else {
      const item = (data[section.key] as Record<string, unknown> | undefined) ?? {};
      for (const field of section.fields) {
        const v = item?.[field.key];
        if (v === undefined || v === null || v === "") continue;
        rows.push(infoRow(`${section.title} — ${field.label}`, String(v)));
      }
    }
  }
  return rows;
}

export async function buildEvidenceDocumentBuffer(input: EvidenceDocumentInput): Promise<Buffer> {
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, children: [new TextRun({ text: "مستند إثبات — منصة إدارة الابتكار المؤسسي", bold: true })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `تاريخ الإصدار: ${input.generatedAt.toLocaleDateString("ar-SA")} — أنشأه: ${input.generatedByName}`, italics: true, size: 20 })] }),
          new Paragraph({ text: "" }),

          new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("١. معلومات المعيار والمتطلب")] }),
          new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
            infoRow("المعيار", `${input.unitCode} — ${input.unitName}`),
            infoRow("المتطلب", `${input.requirementCode} — ${input.requirementTitle}`),
            infoRow("متطلب التطبيق الرسمي", input.applicationRequirement),
            infoRow("المالك", input.ownerName ?? "—"),
            infoRow("المسؤول عن التنفيذ", input.responsibleName ?? "—"),
          ] }),
          new Paragraph({ text: "" }),

          new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("٢. RACI")] }),
          new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: input.raci.length
            ? input.raci.map((r) => infoRow(RESPONSIBILITY_LABELS[r.responsibility] ?? r.responsibility, r.name ?? "—"))
            : [infoRow("—", "لا توجد بيانات RACI مسجَّلة")] }),
          new Paragraph({ text: "" }),

          new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("٣. بيانات المتطلب المُدخلة")] }),
          new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: fieldValueRows(input.config, input.workspaceData).length
            ? fieldValueRows(input.config, input.workspaceData)
            : [infoRow("—", "لا توجد بيانات مُدخلة بعد")] }),
          new Paragraph({ text: "" }),

          new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("٤. المهام المرتبطة")] }),
          ...(input.tasks.length ? input.tasks.map((t) => new Paragraph({ text: `• ${t.title} — ${t.assignedTo} (${t.status})` })) : [new Paragraph({ text: "لا توجد مهام مرتبطة." })]),
          new Paragraph({ text: "" }),

          new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("٥. الأدلة المرتبطة")] }),
          ...(input.evidenceRefs.length ? input.evidenceRefs.map((e) => new Paragraph({ text: `• ${e.title}${e.fileName ? ` — ${e.fileName}` : ""} (${e.reviewStatus})` })) : [new Paragraph({ text: "لا توجد أدلة مرفوعة بعد." })]),
          new Paragraph({ text: "" }),

          new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("٦. حالة المراجعة والاعتماد")] }),
          new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
            infoRow("حالة Workflow", WORKFLOW_LABELS[input.workflowState] ?? input.workflowState),
            infoRow("آخر ملاحظة مراجعة", input.reviewComment ?? "—"),
            infoRow("اعتمده", input.approvedByName ?? "—"),
            infoRow("تاريخ الاعتماد", input.approvedAt ?? "—"),
            infoRow("رقم الإصدار (Version)", String(input.version)),
          ] }),
        ],
      },
    ],
  });
  return Packer.toBuffer(doc);
}
