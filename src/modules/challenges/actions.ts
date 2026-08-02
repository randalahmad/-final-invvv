"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getAccessContext } from "@/server/authz";
import { isAuthorizationError } from "@/server/authorization";
import {
  createChallenge,
  updateChallenge,
  updateChallengeStatus,
  archiveChallenge,
  linkChallengeSolution,
  unlinkChallengeSolution,
  ChallengeError,
} from "./service";

export interface ChallengeFormState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
}
export interface ChallengeActionState {
  error?: string;
  success?: string;
}

const MSG: Record<string, string> = {
  FORBIDDEN: "لا تملك صلاحية الوصول لإدارة التحديات",
  OUT_OF_SCOPE: "هذا التحدي خارج نطاق صلاحياتك",
  NOT_FOUND: "التحدي غير موجود",
  VALIDATION: "يرجى تصحيح الحقول المطلوبة",
  BAD_REFERENCE: "المرجع المحدد غير موجود",
  ALREADY_ARCHIVED: "هذا التحدي مؤرشف بالفعل أو لا يمكن تعديله",
  ALREADY_LINKED: "هذا الحل مرتبط بالتحدي بالفعل",
};

function toFormState(e: unknown): ChallengeFormState {
  if (e instanceof ChallengeError) return { error: MSG[e.code] ?? "تعذّر تنفيذ الإجراء", fieldErrors: e.fieldErrors };
  if (isAuthorizationError(e)) return { error: MSG[e.code] ?? "غير مصرّح" };
  throw e;
}
function toActionState(e: unknown): ChallengeActionState {
  if (e instanceof ChallengeError) return { error: MSG[e.code] ?? "تعذّر تنفيذ الإجراء" };
  if (isAuthorizationError(e)) return { error: MSG[e.code] ?? "غير مصرّح" };
  throw e;
}

function payload(formData: FormData) {
  return {
    titleAr: formData.get("titleAr"),
    description: formData.get("description") || undefined,
    departmentId: formData.get("departmentId"),
    category: formData.get("category") || undefined,
  };
}

export async function createChallengeAction(_prev: ChallengeFormState, formData: FormData): Promise<ChallengeFormState> {
  const ctx = await getAccessContext();
  if (!ctx) return { error: "غير مصرّح" };
  let newId: string;
  try {
    const created = await createChallenge(ctx, payload(formData));
    newId = created.id;
  } catch (e) {
    return toFormState(e);
  }
  revalidatePath("/challenges");
  redirect(`/challenges/${newId}`);
}

export async function updateChallengeAction(_prev: ChallengeFormState, formData: FormData): Promise<ChallengeFormState> {
  const ctx = await getAccessContext();
  if (!ctx) return { error: "غير مصرّح" };
  const id = String(formData.get("challengeId") ?? "");
  try {
    await updateChallenge(ctx, id, payload(formData));
  } catch (e) {
    return toFormState(e);
  }
  revalidatePath(`/challenges/${id}`);
  redirect(`/challenges/${id}`);
}

export async function updateChallengeStatusAction(_prev: ChallengeActionState, formData: FormData): Promise<ChallengeActionState> {
  const ctx = await getAccessContext();
  if (!ctx) return { error: "غير مصرّح" };
  const id = String(formData.get("challengeId") ?? "");
  try {
    await updateChallengeStatus(ctx, id, { status: formData.get("status") });
  } catch (e) {
    return toActionState(e);
  }
  revalidatePath(`/challenges/${id}`);
  return { success: "تم تحديث الحالة" };
}

export async function archiveChallengeAction(_prev: ChallengeActionState, formData: FormData): Promise<ChallengeActionState> {
  const ctx = await getAccessContext();
  if (!ctx) return { error: "غير مصرّح" };
  const id = String(formData.get("challengeId") ?? "");
  try {
    await archiveChallenge(ctx, id);
  } catch (e) {
    return toActionState(e);
  }
  revalidatePath(`/challenges/${id}`);
  revalidatePath("/challenges");
  return { success: "تم تنفيذ الإجراء" };
}

export async function linkChallengeSolutionAction(_prev: ChallengeFormState, formData: FormData): Promise<ChallengeFormState> {
  const ctx = await getAccessContext();
  if (!ctx) return { error: "غير مصرّح" };
  const challengeId = String(formData.get("challengeId") ?? "");
  const solutionId = String(formData.get("solutionId") ?? "");
  try {
    await linkChallengeSolution(ctx, challengeId, solutionId);
  } catch (e) {
    return toFormState(e);
  }
  revalidatePath(`/challenges/${challengeId}`);
  return {};
}

export async function unlinkChallengeSolutionAction(_prev: ChallengeActionState, formData: FormData): Promise<ChallengeActionState> {
  const ctx = await getAccessContext();
  if (!ctx) return { error: "غير مصرّح" };
  const challengeId = String(formData.get("challengeId") ?? "");
  const solutionId = String(formData.get("solutionId") ?? "");
  try {
    await unlinkChallengeSolution(ctx, challengeId, solutionId);
  } catch (e) {
    return toActionState(e);
  }
  revalidatePath(`/challenges/${challengeId}`);
  return { success: "تم إلغاء الربط" };
}
