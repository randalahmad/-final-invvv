import { z } from "zod";

const optionalText = (max: number) =>
  z
    .union([z.string(), z.undefined(), z.null()])
    .transform((v) => (typeof v === "string" && v.trim() ? v.trim() : null))
    .refine((v) => v === null || v.length <= max, { message: "القيمة طويلة جدًا" });

const optionalDate = z
  .union([z.string(), z.undefined(), z.null()])
  .transform((v) => (typeof v === "string" && v.trim() ? new Date(v) : null))
  .refine((v) => v === null || !Number.isNaN(v.getTime()), { message: "تاريخ غير صالح" });

export const ACTIVITY_TYPES = [
  "HACKATHON",
  "INNOVATION_CAMP",
  "WORKSHOP",
  "CHALLENGE",
  "INTERNAL_IDEATION",
  "OPEN_INNOVATION",
  "COMPETITION",
  "MEETING",
  "PROGRAM",
  "INITIATIVE",
  "OTHER",
] as const;

export const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  HACKATHON: "هاكاثون",
  INNOVATION_CAMP: "معسكر ابتكار",
  WORKSHOP: "ورشة عمل",
  CHALLENGE: "تحدٍّ",
  INTERNAL_IDEATION: "توليد أفكار داخلي",
  OPEN_INNOVATION: "ابتكار مفتوح",
  COMPETITION: "مسابقة",
  MEETING: "لقاء",
  PROGRAM: "برنامج",
  INITIATIVE: "مبادرة",
  OTHER: "أخرى",
};

export const ACTIVITY_STATUS_LABELS: Record<string, string> = {
  PLANNED: "مخطَّط",
  ONGOING: "جارٍ",
  COMPLETED: "مكتمل",
  CANCELLED: "مُلغى",
};

export const activitySchema = z
  .object({
    nameAr: z.string().trim().min(3, "اسم النشاط مطلوب (3 أحرف على الأقل)").max(200, "الاسم طويل جدًا"),
    type: z.enum(ACTIVITY_TYPES),
    description: optionalText(4000),
    objectivesAr: optionalText(2000),
    eventUrl: optionalText(500),
    organizerDepartmentId: z.string().trim().min(1, "الجهة المنظمة مطلوبة"),
    startDate: optionalDate,
    endDate: optionalDate,
  })
  .refine((v) => !v.startDate || !v.endDate || v.startDate <= v.endDate, {
    message: "تاريخ البداية يجب أن يسبق تاريخ النهاية",
    path: ["endDate"],
  });
export type ActivityInput = z.infer<typeof activitySchema>;
