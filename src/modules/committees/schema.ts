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

/// Product distinction (5.23.3 Requirement 01) — not a DGA-mandated field name.
export const COMMITTEE_TYPE_LABELS: Record<string, string> = {
  UNIT: "وحدة",
  COMMITTEE: "لجنة",
};

const optionalEmail = z
  .union([z.string(), z.undefined(), z.null()])
  .transform((v) => (typeof v === "string" && v.trim() ? v.trim() : null))
  .refine((v) => v === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), { message: "بريد إلكتروني غير صالح" });

export const committeeSchema = z.object({
  nameAr: z.string().trim().min(3, "اسم اللجنة مطلوب (3 أحرف على الأقل)").max(200, "الاسم طويل جدًا"),
  category: optionalText(120),
  type: z.enum(["UNIT", "COMMITTEE"]).default("COMMITTEE"),
  purpose: optionalText(2000),
  mandateDescription: optionalText(4000),
  relatedDepartmentName: optionalText(200),
  chairName: optionalText(150),
  secretaryName: optionalText(150),
  organizationId: z.string().trim().min(1, "الجهة/المنظمة مطلوبة"),
  formationDate: optionalDate,
  operationStartDate: optionalDate,
  meetingFrequency: optionalText(120),
  notes: optionalText(4000),
  decisionNumber: optionalText(80),
  decisionDate: optionalDate,
  decisionApprovingAuthority: optionalText(200),
  decisionEffectiveDate: optionalDate,
  decisionNotes: optionalText(2000),
});
export type CommitteeInput = z.infer<typeof committeeSchema>;

/// Product member categories (5.23.3 Requirement 01, §4) — not a DGA-mandated list.
export const COMMITTEE_MEMBER_CATEGORY_LABELS: Record<string, string> = {
  EMPLOYEE: "موظف",
  DEPARTMENT_REPRESENTATIVE: "ممثل إدارة",
  EXPERT: "خبير",
  EXTERNAL_MEMBER: "عضو خارجي",
  STUDENT: "طالب",
  STUDENT_VOLUNTEER: "طالب متطوع",
  VOLUNTEER: "متطوع",
  OTHER: "فئة أخرى",
};

export const COMMITTEE_MEMBER_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "نشط",
  ENDED: "منتهي",
  SUSPENDED: "موقوف",
};

export const committeeMemberSchema = z.object({
  name: z.string().trim().min(2, "اسم العضو مطلوب").max(200, "الاسم طويل جدًا"),
  category: z
    .enum(["EMPLOYEE", "DEPARTMENT_REPRESENTATIVE", "EXPERT", "EXTERNAL_MEMBER", "STUDENT", "STUDENT_VOLUNTEER", "VOLUNTEER", "OTHER"])
    .default("EMPLOYEE"),
  affiliation: optionalText(200),
  title: optionalText(150),
  email: optionalEmail,
  phone: optionalText(40),
  roleInCommittee: optionalText(150),
  responsibilities: optionalText(2000),
  responsibilityScope: optionalText(1000),
  isPrimaryResponsible: z
    .union([z.string(), z.boolean(), z.undefined(), z.null()])
    .transform((v) => v === true || v === "true" || v === "on"),
  delegateName: optionalText(150),
  membershipEndDate: optionalDate,
  status: z.enum(["ACTIVE", "ENDED", "SUSPENDED"]).default("ACTIVE"),
  notes: optionalText(2000),
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
