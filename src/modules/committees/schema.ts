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

export const COMMITTEE_STATUS_LABELS: Record<string, string> = {
  PROPOSED: "مُقترَحة",
  ACTIVE: "نشطة",
  DISSOLVED: "منحلّة",
};

export const committeeSchema = z.object({
  nameAr: z.string().trim().min(3, "اسم اللجنة مطلوب (3 أحرف على الأقل)").max(200, "الاسم طويل جدًا"),
  category: optionalText(120),
  organizationId: z.string().trim().min(1, "الجهة/المنظمة مطلوبة"),
  decisionNumber: optionalText(80),
  decisionDate: optionalDate,
});
export type CommitteeInput = z.infer<typeof committeeSchema>;

export const committeeMemberSchema = z.object({
  name: z.string().trim().min(2, "اسم العضو مطلوب").max(200, "الاسم طويل جدًا"),
  title: optionalText(150),
  email: z
    .union([z.string(), z.undefined(), z.null()])
    .transform((v) => (typeof v === "string" && v.trim() ? v.trim() : null))
    .refine((v) => v === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), { message: "بريد إلكتروني غير صالح" }),
});
export type CommitteeMemberInput = z.infer<typeof committeeMemberSchema>;

export const MEETING_STATUS_LABELS: Record<string, string> = {
  SCHEDULED: "مجدوَل",
  HELD: "مُنعقد",
  CANCELLED: "مُلغى",
};

export const committeeMeetingSchema = z.object({
  meetingDate: z
    .string()
    .trim()
    .min(1, "تاريخ الاجتماع مطلوب")
    .transform((v) => new Date(v))
    .refine((v) => !Number.isNaN(v.getTime()), { message: "تاريخ غير صالح" }),
  status: z.enum(["SCHEDULED", "HELD", "CANCELLED"]).default("SCHEDULED"),
  agenda: optionalText(4000),
  topicsDiscussed: optionalText(4000),
  decisionsAndRecommendations: optionalText(4000),
});
export type CommitteeMeetingInput = z.infer<typeof committeeMeetingSchema>;
