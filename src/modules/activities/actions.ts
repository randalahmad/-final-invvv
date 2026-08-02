"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getAccessContext } from "@/server/authz";
import { isAuthorizationError } from "@/server/authorization";
import { createActivity, updateActivity, archiveActivity, ActivityError } from "./service";

export interface ActivityFormState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
}
export interface ActivityActionState {
  error?: string;
  success?: string;
}

const MSG: Record<string, string> = {
  FORBIDDEN: "لا تملك صلاحية الوصول لإدارة المنهجيات الابتكارية",
  OUT_OF_SCOPE: "هذا النشاط خارج نطاق صلاحياتك",
  NOT_FOUND: "النشاط غير موجود",
  VALIDATION: "يرجى تصحيح الحقول المطلوبة",
  BAD_REFERENCE: "الجهة المحددة غير موجودة",
  ALREADY_ARCHIVED: "هذا النشاط مؤرشف بالفعل",
};

function toFormState(e: unknown): ActivityFormState {
  if (e instanceof ActivityError) return { error: MSG[e.code] ?? "تعذّر تنفيذ الإجراء", fieldErrors: e.fieldErrors };
  if (isAuthorizationError(e)) return { error: MSG[e.code] ?? "غير مصرّح" };
  throw e;
}
function toActionState(e: unknown): ActivityActionState {
  if (e instanceof ActivityError) return { error: MSG[e.code] ?? "تعذّر تنفيذ الإجراء" };
  if (isAuthorizationError(e)) return { error: MSG[e.code] ?? "غير مصرّح" };
  throw e;
}

function payload(formData: FormData) {
  return {
    nameAr: formData.get("nameAr"),
    type: formData.get("type"),
    description: formData.get("description") || undefined,
    objectivesAr: formData.get("objectivesAr") || undefined,
    eventUrl: formData.get("eventUrl") || undefined,
    organizerDepartmentId: formData.get("organizerDepartmentId"),
    startDate: formData.get("startDate") || undefined,
    endDate: formData.get("endDate") || undefined,
  };
}

export async function createActivityAction(_prev: ActivityFormState, formData: FormData): Promise<ActivityFormState> {
  const ctx = await getAccessContext();
  if (!ctx) return { error: "غير مصرّح" };
  let newId: string;
  try {
    const created = await createActivity(ctx, payload(formData));
    newId = created.id;
  } catch (e) {
    return toFormState(e);
  }
  revalidatePath("/activities");
  redirect(`/activities/${newId}`);
}

export async function updateActivityAction(_prev: ActivityFormState, formData: FormData): Promise<ActivityFormState> {
  const ctx = await getAccessContext();
  if (!ctx) return { error: "غير مصرّح" };
  const id = String(formData.get("activityId") ?? "");
  const status = String(formData.get("status") ?? "");
  try {
    await updateActivity(ctx, id, payload(formData), status);
  } catch (e) {
    return toFormState(e);
  }
  revalidatePath(`/activities/${id}`);
  redirect(`/activities/${id}`);
}

export async function archiveActivityAction(_prev: ActivityActionState, formData: FormData): Promise<ActivityActionState> {
  const ctx = await getAccessContext();
  if (!ctx) return { error: "غير مصرّح" };
  const id = String(formData.get("activityId") ?? "");
  try {
    await archiveActivity(ctx, id);
  } catch (e) {
    return toActionState(e);
  }
  revalidatePath(`/activities/${id}`);
  revalidatePath("/activities");
  return { success: "تم تنفيذ الإجراء" };
}
