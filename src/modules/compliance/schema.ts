import { z } from "zod";

import type { ReadinessBand } from "./scoring";

/**
 * Arabic presentation labels + input validation for the compliance engine.
 * Every readiness label carries the "estimated / internal" qualifier until DGA
 * methodology sign-off (compliance-rules.md §10).
 */

export const READINESS_BAND_LABELS: Record<ReadinessBand, string> = {
  NOT_READY: "غير جاهز",
  IN_PROGRESS: "قيد الإعداد",
  NEARLY_READY: "شبه جاهز",
  READY: "جاهز (تقديري)",
};

/** Badge variant per band (matches the shared Badge component variants). */
export const READINESS_BAND_VARIANT: Record<ReadinessBand, "danger" | "warning" | "primary" | "success"> = {
  NOT_READY: "danger",
  IN_PROGRESS: "warning",
  NEARLY_READY: "primary",
  READY: "success",
};

/** The mandatory "this is an internal estimate" qualifier, shown with every score. */
export const ESTIMATED_LABEL = "مؤشر جاهزية تقديري (داخلي)";
export const ESTIMATED_NOTE =
  "مؤشر جاهزية تقديري داخلي محسوب من السجلات الفعلية والأدلة المعتمدة بشريًا فقط. ليس تقييم جاهزية رسميًا من هيئة الحكومة الرقمية (DGA)، وتُعدّ الأوزان والبوابات والحدود قيمًا افتراضية غير مُصادق عليها بعد.";

export const NA_STATE_LABELS: Record<string, string> = {
  NONE: "غير مطلوب",
  REQUESTED: "طلب استثناء (قيد الاعتماد)",
  APPROVED: "غير منطبق — معتمد",
  REJECTED: "طلب استثناء مرفوض",
  REVOKED: "أُلغي الاستثناء",
};

// ── Input validation ────────────────────────────────────────────────────────

/** Request an N/A exception for a requirement on a specific solution. */
export const naRequestSchema = z.object({
  requirementId: z.string().min(1),
  solutionId: z.string().min(1),
  reason: z.string().trim().min(10, "سبب الاستثناء مطلوب (10 أحرف على الأقل)").max(1000),
});
export type NARequestInput = z.infer<typeof naRequestSchema>;

/** Approve / reject / revoke an existing N/A determination. */
export const naDecisionSchema = z.object({
  naId: z.string().min(1),
  solutionId: z.string().min(1),
});
export type NADecisionInput = z.infer<typeof naDecisionSchema>;

const fieldRuleInput = z.object({
  fieldKey: z.string().trim().min(1).max(80),
  labelAr: z.string().trim().max(200).optional(),
  rule: z.string().trim().min(1).max(60).default("required"),
  weight: z.number().int().min(0).max(100).default(1),
  mandatoryGate: z.boolean().default(false),
  optional: z.boolean().default(false),
  orderIndex: z.number().int().optional(),
});

const evidenceRuleInput = z.object({
  evidenceTypeKey: z.string().trim().min(1).max(80),
  labelAr: z.string().trim().max(200).optional(),
  minCount: z.number().int().min(1).max(50).default(1),
  weight: z.number().int().min(0).max(100).default(1),
  mandatoryGate: z.boolean().default(false),
});

/**
 * Create/replace a requirement's scoring configuration. All numeric knobs are
 * data (weights/gates/ceiling/allowNA) — there is no scoring logic in code.
 */
export const requirementConfigSchema = z.object({
  code: z.string().trim().min(1).max(40),
  titleAr: z.string().trim().min(1).max(300),
  description: z.string().trim().max(2000).optional(),
  sectionCode: z.string().trim().max(40).optional(),
  entityType: z.enum(["INNOVATION_SOLUTION"]).nullable().optional(),
  requirementWeight: z.number().int().min(1).max(100).default(1),
  gateCeiling: z.number().int().min(0).max(100).default(69),
  allowNA: z.boolean().default(false),
  isActive: z.boolean().default(true),
  fields: z.array(fieldRuleInput).max(50).default([]),
  evidenceTypes: z.array(evidenceRuleInput).max(50).default([]),
});
export type RequirementConfigInput = z.infer<typeof requirementConfigSchema>;

export const sectionConfigSchema = z.object({
  code: z.string().trim().min(1).max(40),
  titleAr: z.string().trim().min(1).max(300),
  description: z.string().trim().max(2000).optional(),
  sectionWeight: z.number().int().min(1).max(100).default(1),
  orderIndex: z.number().int().optional(),
  isActive: z.boolean().default(true),
});
export type SectionConfigInput = z.infer<typeof sectionConfigSchema>;
