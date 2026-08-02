"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getAccessContext } from "@/server/authz";
import { isAuthorizationError } from "@/server/authorization";
import { createIdea, updateDraftIdea, submitIdea, withdrawIdea, archiveIdea, restoreIdea, IdeaError } from "./service";

export interface IdeaFormState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
}
export interface IdeaActionState {
  error?: string;
  success?: string;
}

const MSG: Record<string, string> = {
  FORBIDDEN: "لا تملك صلاحية الوصول للأفكار",
  OUT_OF_SCOPE: "هذه الفكرة خارج نطاق صلاحياتك",
  NOT_FOUND: "الفكرة غير موجودة",
  VALIDATION: "يرجى تصحيح الحقول المطلوبة",
  NOT_DRAFT: "لا يمكن تعديل فكرة بعد تقديمها",
  INVALID_TRANSITION: "لا يمكن تنفيذ هذا الإجراء على حالة الفكرة الحالية",
  NOT_AUTHOR: "هذا الإجراء من صلاحية صاحب الفكرة",
  BAD_ACTIVITY: "النشاط المرتبط غير صالح",
  RESTORE_UNAVAILABLE: "تعذّر تحديد الحالة السابقة لهذه الفكرة بثقة، لذا لا يمكن استعادتها تلقائيًا. راجع فريق النظام.",
};

function toFormState(e: unknown): IdeaFormState {
  if (e instanceof IdeaError) return { error: MSG[e.code] ?? "تعذّر تنفيذ الإجراء", fieldErrors: e.fieldErrors };
  if (isAuthorizationError(e)) return { error: MSG[e.code] ?? "غير مصرّح" };
  throw e; // re-throw NEXT_REDIRECT / unknown
}
function toActionState(e: unknown): IdeaActionState {
  if (e instanceof IdeaError) return { error: MSG[e.code] ?? "تعذّر تنفيذ الإجراء" };
  if (isAuthorizationError(e)) return { error: MSG[e.code] ?? "غير مصرّح" };
  throw e;
}

function payload(formData: FormData) {
  return {
    titleAr: formData.get("titleAr"),
    description: formData.get("description") || undefined,
    departmentId: formData.get("departmentId"),
    activityId: formData.get("activityId") || undefined,
  };
}

export async function createIdeaAction(_prev: IdeaFormState, formData: FormData): Promise<IdeaFormState> {
  const ctx = await getAccessContext();
  if (!ctx) return { error: "غير مصرّح" };
  let newId: string;
  try {
    const created = await createIdea(ctx, payload(formData));
    newId = created.id;
  } catch (e) {
    return toFormState(e);
  }
  revalidatePath("/governance/ideas");
  redirect(`/governance/ideas/${newId}`);
}

export async function updateIdeaAction(_prev: IdeaFormState, formData: FormData): Promise<IdeaFormState> {
  const ctx = await getAccessContext();
  if (!ctx) return { error: "غير مصرّح" };
  const id = String(formData.get("ideaId") ?? "");
  try {
    await updateDraftIdea(ctx, id, payload(formData));
  } catch (e) {
    return toFormState(e);
  }
  revalidatePath(`/governance/ideas/${id}`);
  redirect(`/governance/ideas/${id}`);
}

async function runTransition(formData: FormData, fn: (ctx: NonNullable<Awaited<ReturnType<typeof getAccessContext>>>, id: string) => Promise<void>): Promise<IdeaActionState> {
  const ctx = await getAccessContext();
  if (!ctx) return { error: "غير مصرّح" };
  const id = String(formData.get("ideaId") ?? "");
  try {
    await fn(ctx, id);
  } catch (e) {
    return toActionState(e);
  }
  revalidatePath(`/governance/ideas/${id}`);
  revalidatePath("/governance/ideas");
  return { success: "تم تنفيذ الإجراء" };
}

export async function submitIdeaAction(_prev: IdeaActionState, formData: FormData): Promise<IdeaActionState> {
  return runTransition(formData, submitIdea);
}
export async function withdrawIdeaAction(_prev: IdeaActionState, formData: FormData): Promise<IdeaActionState> {
  return runTransition(formData, withdrawIdea);
}
export async function archiveIdeaAction(_prev: IdeaActionState, formData: FormData): Promise<IdeaActionState> {
  return runTransition(formData, archiveIdea);
}
export async function restoreIdeaAction(_prev: IdeaActionState, formData: FormData): Promise<IdeaActionState> {
  return runTransition(formData, restoreIdea);
}
