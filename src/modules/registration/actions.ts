"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { submitRegistration } from "./service";
import { requestMetadataFromHeaders } from "@/server/request-context";

export interface RegisterState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

export async function registerAction(_prev: RegisterState, formData: FormData): Promise<RegisterState> {
  const raw = {
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    requestedRole: formData.get("requestedRole"),
    requestedOrgType: formData.get("requestedOrgType") || undefined,
    requestedOrganizationName: formData.get("requestedOrganizationName") || undefined,
    requestedDepartmentId: formData.get("requestedDepartmentId") || undefined,
    registrationNote: formData.get("registrationNote") || undefined,
    acceptTerms: formData.get("acceptTerms") === "true",
  };

  const result = await submitRegistration(raw, requestMetadataFromHeaders(headers()));
  if (!result.ok) {
    if (result.error === "DUPLICATE_EMAIL") return { error: "هذا البريد الإلكتروني مُسجّل بالفعل" };
    if (result.error === "VALIDATION") return { error: "يرجى تصحيح الحقول المطلوبة", fieldErrors: result.fieldErrors };
    if (result.error === "INVALID_ROLE") return { error: "نوع المستخدم المطلوب غير صالح" };
    if (result.error === "RATE_LIMITED") return { error: "تم تجاوز عدد محاولات التسجيل المسموح بها. حاول مرة أخرى لاحقًا." };
    return { error: "تعذّر إكمال التسجيل. حاول مرة أخرى لاحقًا." };
  }

  redirect("/register/submitted");
}
