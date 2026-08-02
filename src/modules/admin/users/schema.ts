import { z } from "zod";

/** Roles an admin may assign when approving a PUBLIC registration (never SYSTEM_ADMIN). */
export const APPROVABLE_ROLES = ["INTERNAL_EDITOR", "EXTERNAL_PARTNER", "VIEWER"] as const;

const SCOPE_TYPES = ["PLATFORM", "ORGANIZATION", "DEPARTMENT", "AGREEMENT", "SOLUTION", "PUBLISHED"] as const;

export const approveSchema = z
  .object({
    userId: z.string().min(1),
    roleKey: z.enum(APPROVABLE_ROLES, {
      errorMap: () => ({ message: "لا يمكن إسناد هذا الدور عبر التسجيل العام" }),
    }),
    scopeType: z.enum(SCOPE_TYPES),
    scopeId: z.string().trim().optional().or(z.literal("")),
    organizationId: z.string().trim().optional().or(z.literal("")),
    departmentId: z.string().trim().optional().or(z.literal("")),
  })
  .refine(
    // Scoped types require a target id.
    (d) => !["ORGANIZATION", "DEPARTMENT", "AGREEMENT", "SOLUTION"].includes(d.scopeType) || !!d.scopeId?.trim(),
    { path: ["scopeId"], message: "يجب تحديد نطاق الوصول" },
  );

export type ApproveInput = z.infer<typeof approveSchema>;

export const rejectSchema = z.object({
  userId: z.string().min(1),
  reason: z.string().trim().max(500, "السبب طويل جدًا").optional().or(z.literal("")),
});
export type RejectInput = z.infer<typeof rejectSchema>;

export const ACCOUNT_ACTIONS = ["ACTIVATE", "DEACTIVATE", "SUSPEND", "RESTORE"] as const;
export const accountStateSchema = z.object({
  userId: z.string().min(1),
  action: z.enum(ACCOUNT_ACTIONS),
});
export type AccountStateInput = z.infer<typeof accountStateSchema>;
