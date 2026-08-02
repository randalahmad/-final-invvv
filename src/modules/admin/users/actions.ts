"use server";

import { revalidatePath } from "next/cache";

import { getAccessContext } from "@/server/authz";
import { approveRegistration, rejectRegistration, setAccountState, assignPlatformRole, removeUserRole, type ServiceResult } from "./service";

export interface AdminActionState {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string[]>;
}

const ERROR_AR: Record<string, string> = {
  FORBIDDEN: "لا تملك صلاحية تنفيذ هذا الإجراء",
  NOT_FOUND: "المستخدم غير موجود",
  NOT_PENDING: "لم يعد الطلب قيد الانتظار",
  INVALID_ROLE: "الدور المطلوب غير صالح",
  INVALID_STATE: "لا يمكن تنفيذ هذا التغيير على الحالة الحالية",
  VALIDATION: "يرجى تصحيح الحقول المطلوبة",
};

function toState(result: ServiceResult, successMsg: string): AdminActionState {
  if (result.ok) return { success: successMsg };
  return { error: ERROR_AR[result.error] ?? "تعذّر تنفيذ الإجراء", fieldErrors: result.fieldErrors };
}

/** Server-side actor resolution — never trusts client-provided identity. */
async function requireActor() {
  const ctx = await getAccessContext();
  return ctx; // service re-checks the `user.manage` permission
}

export async function approveAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const ctx = await requireActor();
  if (!ctx) return { error: "غير مصرّح" };
  const result = await approveRegistration(ctx, {
    userId: formData.get("userId"),
    roleKey: formData.get("roleKey"),
    scopeType: formData.get("scopeType"),
    scopeId: formData.get("scopeId") || "",
    organizationId: formData.get("organizationId") || "",
    departmentId: formData.get("departmentId") || "",
  });
  if (result.ok) revalidatePath("/admin/users/requests");
  return toState(result, "تم اعتماد التسجيل وتفعيل الحساب");
}

export async function rejectAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const ctx = await requireActor();
  if (!ctx) return { error: "غير مصرّح" };
  const result = await rejectRegistration(ctx, {
    userId: formData.get("userId"),
    reason: formData.get("reason") || "",
  });
  if (result.ok) revalidatePath("/admin/users/requests");
  return toState(result, "تم رفض طلب التسجيل");
}

export async function accountStateAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const ctx = await requireActor();
  if (!ctx) return { error: "غير مصرّح" };
  const result = await setAccountState(ctx, {
    userId: formData.get("userId"),
    action: formData.get("action"),
  });
  if (result.ok) revalidatePath("/admin/users/requests");
  return toState(result, "تم تحديث حالة الحساب");
}

export async function assignRoleAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const ctx = await requireActor();
  if (!ctx) return { error: "غير مصرّح" };
  const userId = String(formData.get("userId") ?? "");
  const roleId = String(formData.get("roleId") ?? "");
  const result = await assignPlatformRole(ctx, userId, roleId);
  if (result.ok) revalidatePath("/admin/users");
  return toState(result, "تم إسناد الدور");
}

export async function removeRoleAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const ctx = await requireActor();
  if (!ctx) return { error: "غير مصرّح" };
  const userRoleId = String(formData.get("userRoleId") ?? "");
  const result = await removeUserRole(ctx, userRoleId);
  if (result.ok) revalidatePath("/admin/users");
  return toState(result, "تم إلغاء إسناد الدور");
}
