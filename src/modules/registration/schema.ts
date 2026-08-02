import { z } from "zod";

/**
 * Roles a member of the public may REQUEST at self-registration.
 * SYSTEM_ADMIN is deliberately excluded and is rejected server-side even if a
 * crafted request submits it.
 */
export const PUBLIC_REQUESTABLE_ROLES = ["INTERNAL_EDITOR", "EXTERNAL_PARTNER", "VIEWER"] as const;
export type PublicRequestableRole = (typeof PUBLIC_REQUESTABLE_ROLES)[number];

const ORG_TYPES = ["UNIVERSITY", "COMPANY", "GOVERNMENT", "PARTNER", "OTHER"] as const;

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, "الاسم مطلوب").max(120, "الاسم طويل جدًا"),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("البريد الإلكتروني غير صالح")
      .max(190, "البريد الإلكتروني طويل جدًا"),
    password: z
      .string()
      .min(8, "كلمة المرور يجب ألا تقل عن 8 أحرف")
      .max(128, "كلمة المرور طويلة جدًا"),
    confirmPassword: z.string(),
    requestedRole: z.enum(PUBLIC_REQUESTABLE_ROLES, {
      errorMap: () => ({ message: "يرجى اختيار نوع مستخدم صالح" }),
    }),
    requestedOrgType: z.enum(ORG_TYPES).optional(),
    requestedOrganizationName: z.string().trim().max(190).optional().or(z.literal("")),
    requestedDepartmentId: z.string().trim().max(60).optional().or(z.literal("")),
    registrationNote: z.string().trim().max(500, "الملاحظة طويلة جدًا").optional().or(z.literal("")),
    acceptTerms: z.literal(true, {
      errorMap: () => ({ message: "يجب الموافقة على الشروط للمتابعة" }),
    }),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "كلمتا المرور غير متطابقتين",
  })
  .refine(
    // External applicants should indicate an affiliation; internal ones a department.
    (d) => d.requestedRole !== "EXTERNAL_PARTNER" || !!d.requestedOrganizationName?.trim(),
    { path: ["requestedOrganizationName"], message: "يرجى إدخال اسم الجهة" },
  );

export type RegisterInput = z.infer<typeof registerSchema>;
