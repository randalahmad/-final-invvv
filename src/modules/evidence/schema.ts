import { z } from "zod";

/** Supported evidence file types (MVP): PDF, DOCX, XLSX. */
export const ALLOWED_MIME_TYPES: Record<string, { ext: string; label: string }> = {
  "application/pdf": { ext: "pdf", label: "PDF" },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { ext: "docx", label: "DOCX" },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": { ext: "xlsx", label: "XLSX" },
};
export const ALLOWED_EXTENSIONS = ["pdf", "docx", "xlsx"] as const;

/* Per-file size ceiling is configurable via EVIDENCE_MAX_FILE_MB — see
   maxFileBytes() in @/server/storage (default 25 MB). */

/** Entity types evidence may be linked to (subset of the LinkedEntityType whitelist). */
export const LINKABLE_ENTITY_TYPES = [
  "COMPLIANCE_REQUIREMENT",
  "REQUIREMENT_ASSIGNMENT",
  "INNOVATION_SOLUTION",
  "STRATEGIC_OBJECTIVE",
  "INNOVATION_ACTIVITY",
  "IMPACT_MEASUREMENT",
] as const;

const optionalText = (max: number) =>
  z
    .union([z.string(), z.undefined(), z.null()])
    .transform((v) => (typeof v === "string" && v.trim() ? v.trim() : null))
    .refine((v) => v === null || v.length <= max, { message: "القيمة طويلة جدًا" });

/**
 * Evidence intake metadata. The Evidence model has no `description` column, so
 * the description is stored in `notes` (documented mapping — no new field).
 */
export const evidenceMetadataSchema = z.object({
  title: z.string().trim().min(3, "عنوان الدليل مطلوب (3 أحرف على الأقل)").max(200, "العنوان طويل جدًا"),
  description: optionalText(2000),
  classification: optionalText(80),
});
export type EvidenceMetadataInput = z.infer<typeof evidenceMetadataSchema>;

export const evidenceLinkSchema = z.object({
  entityType: z.enum(LINKABLE_ENTITY_TYPES, { errorMap: () => ({ message: "نوع السجل غير مدعوم" }) }),
  entityId: z.string().trim().min(1, "معرّف السجل مطلوب"),
  requirementId: optionalText(60),
});
export type EvidenceLinkInput = z.infer<typeof evidenceLinkSchema>;

export const REVIEW_STATUS_LABELS: Record<string, string> = {
  DRAFT: "مسودة",
  SUBMITTED: "مُقدّم",
  UNDER_REVIEW: "قيد المراجعة",
  APPROVED: "معتمد",
  REJECTED: "مرفوض",
  ARCHIVED: "مؤرشف",
};

export const FILE_STATUS_LABELS: Record<string, string> = {
  UPLOADED: "تم الرفع",
  PROCESSING: "قيد المعالجة",
  EXTRACTION_READY: "جاهز للاستخراج",
  PROCESSING_FAILED: "فشلت المعالجة",
};

export const ENTITY_TYPE_LABELS: Record<string, string> = {
  COMPLIANCE_REQUIREMENT: "متطلب امتثال",
  REQUIREMENT_ASSIGNMENT: "مساحة عمل متطلب",
  INNOVATION_SOLUTION: "حل ابتكاري",
  STRATEGIC_OBJECTIVE: "هدف استراتيجي",
  INNOVATION_ACTIVITY: "نشاط ابتكاري",
  IMPACT_MEASUREMENT: "قياس أثر",
};
