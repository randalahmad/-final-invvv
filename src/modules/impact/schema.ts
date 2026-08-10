import { z } from "zod";

const decimal = z.preprocess((value) => value === "" ? null : value, z.coerce.number().finite().nullable());
export const impactEntrySchema = z.object({
  solutionId: z.string().min(1),
  indicatorId: z.string().optional(),
  nameAr: z.string().trim().min(2),
  type: z.enum(["FINANCIAL", "OPERATIONAL", "BENEFICIARY", "TIME_REDUCTION", "COST_REDUCTION", "QUALITY", "PRODUCTIVITY", "SATISFACTION", "ENVIRONMENTAL"]),
  unit: z.string().trim().nullable(),
  baselineValue: decimal,
  targetValue: decimal,
  measurementMethod: z.string().trim().nullable(),
  actualValue: decimal,
  periodStart: z.coerce.date().nullable(),
  periodEnd: z.coerce.date().nullable(),
  dataSource: z.string().trim().nullable(),
  notes: z.string().trim().nullable(),
});

export const IMPACT_TYPE_LABELS = {
  FINANCIAL: "مالي", OPERATIONAL: "تشغيلي", BENEFICIARY: "المستفيدون", TIME_REDUCTION: "خفض الوقت",
  COST_REDUCTION: "خفض التكلفة", QUALITY: "الجودة", PRODUCTIVITY: "الإنتاجية", SATISFACTION: "الرضا", ENVIRONMENTAL: "بيئي",
} as const;
