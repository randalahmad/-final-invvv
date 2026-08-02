"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getAccessContext } from "@/server/authz";
import { isAuthorizationError } from "@/server/authorization";
import { maxFileBytes } from "@/server/storage";
import {
  uploadEvidence,
  uploadActivityEvidence,
  replaceEvidenceFile,
  submitEvidence,
  startEvidenceReview,
  approveEvidence,
  rejectEvidence,
  archiveEvidence,
  linkEvidence,
  unlinkEvidence,
  EvidenceError,
} from "./service";

export interface EvidenceFormState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
}
export interface EvidenceActionState {
  error?: string;
  success?: string;
}

const MSG: Record<string, string> = {
  FORBIDDEN: "لا تملك صلاحية تنفيذ هذا الإجراء",
  OUT_OF_SCOPE: "هذا السجل خارج نطاق صلاحياتك",
  NOT_FOUND: "السجل غير موجود",
  SHARE_INACTIVE: "لا توجد مشاركة سارية لهذا الحل",
  ACTION_NOT_ALLOWED: "رفع الأدلة غير مسموح ضمن المشاركة الممنوحة لك",
  VALIDATION: "يرجى تصحيح الحقول المطلوبة",
  INVALID_TRANSITION: "لا يمكن تنفيذ هذا الإجراء على حالة الدليل الحالية",
  UNSUPPORTED_FILE: "نوع الملف غير مدعوم (المسموح: PDF، DOCX، XLSX)",
  FILE_TOO_LARGE: "حجم الملف يتجاوز الحد المسموح",
  STORAGE_FAILED: "تعذّر تخزين الملف. حاول مرة أخرى.",
  NO_BINARY: "لا يوجد ملف مخزّن لهذا الدليل",
  DUPLICATE: "الربط موجود بالفعل",
  BAD_REFERENCE: "السجل المستهدف غير صالح",
};

function message(e: unknown): string {
  if (e instanceof EvidenceError) {
    const specific = e.message && e.message !== e.code ? e.message : null;
    return specific ?? MSG[e.code] ?? "تعذّر تنفيذ الإجراء";
  }
  if (isAuthorizationError(e)) return MSG[e.code] ?? "غير مصرّح";
  throw e; // re-throw NEXT_REDIRECT / unknown
}
function toFormState(e: unknown): EvidenceFormState {
  const msg = message(e);
  return { error: msg, fieldErrors: e instanceof EvidenceError ? e.fieldErrors : undefined };
}

function revalidate(solutionId: string, evidenceId?: string) {
  revalidatePath(`/solutions/${solutionId}/evidence`);
  if (evidenceId) revalidatePath(`/solutions/${solutionId}/evidence/${evidenceId}`);
  revalidatePath(`/solutions/${solutionId}`);
}

/** Read the posted file into memory, enforcing the configured ceiling first. */
async function readPostedFile(fd: FormData): Promise<{ fileName: string; mimeType: string; bytes: Buffer } | { error: string }> {
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "يرجى اختيار ملف غير فارغ" };
  if (file.size > maxFileBytes()) return { error: MSG.FILE_TOO_LARGE };
  try {
    return { fileName: file.name, mimeType: file.type, bytes: Buffer.from(await file.arrayBuffer()) };
  } catch {
    return { error: "تعذّر قراءة الملف" };
  }
}

/**
 * Upload: the binary is persisted to object storage and its true size and
 * SHA-256 checksum are derived server-side from the bytes (client-declared
 * values are never trusted).
 */
export async function uploadEvidenceAction(_p: EvidenceFormState, fd: FormData): Promise<EvidenceFormState> {
  const ctx = await getAccessContext();
  if (!ctx) return { error: "غير مصرّح" };
  const solutionId = String(fd.get("solutionId") ?? "");

  const posted = await readPostedFile(fd);
  if ("error" in posted) return { error: posted.error };

  let created: { id: string };
  try {
    created = await uploadEvidence(
      ctx,
      solutionId,
      {
        title: fd.get("title"),
        description: fd.get("description"),
        classification: fd.get("classification"),
      },
      posted,
    );
  } catch (e) {
    return toFormState(e);
  }
  revalidate(solutionId, created.id);
  redirect(`/solutions/${solutionId}/evidence/${created.id}`);
}

/** Same upload mechanics as uploadEvidenceAction, targeting an activity instead of a solution. */
export async function uploadActivityEvidenceAction(_p: EvidenceFormState, fd: FormData): Promise<EvidenceFormState> {
  const ctx = await getAccessContext();
  if (!ctx) return { error: "غير مصرّح" };
  const activityId = String(fd.get("activityId") ?? "");

  const posted = await readPostedFile(fd);
  if ("error" in posted) return { error: posted.error };

  try {
    await uploadActivityEvidence(
      ctx,
      activityId,
      {
        title: fd.get("title"),
        description: fd.get("description"),
        classification: fd.get("classification"),
      },
      posted,
    );
  } catch (e) {
    return toFormState(e);
  }
  revalidatePath(`/activities/${activityId}`);
  redirect(`/activities/${activityId}`);
}

/** Replace the binary with a new version (never overwrites the stored object). */
export async function replaceEvidenceFileAction(_p: EvidenceFormState, fd: FormData): Promise<EvidenceFormState> {
  const ctx = await getAccessContext();
  if (!ctx) return { error: "غير مصرّح" };
  const solutionId = String(fd.get("solutionId") ?? "");
  const evidenceId = String(fd.get("evidenceId") ?? "");

  const posted = await readPostedFile(fd);
  if ("error" in posted) return { error: posted.error };

  try {
    await replaceEvidenceFile(ctx, evidenceId, posted);
  } catch (e) {
    return toFormState(e);
  }
  revalidate(solutionId, evidenceId);
  return {};
}

async function runTransition(
  fd: FormData,
  fn: (ctx: NonNullable<Awaited<ReturnType<typeof getAccessContext>>>, id: string) => Promise<unknown>,
  success: string,
): Promise<EvidenceActionState> {
  const ctx = await getAccessContext();
  if (!ctx) return { error: "غير مصرّح" };
  const evidenceId = String(fd.get("evidenceId") ?? "");
  const solutionId = String(fd.get("solutionId") ?? "");
  try {
    await fn(ctx, evidenceId);
  } catch (e) {
    return { error: message(e) };
  }
  revalidate(solutionId, evidenceId);
  return { success };
}

export async function submitEvidenceAction(_p: EvidenceActionState, fd: FormData) {
  return runTransition(fd, submitEvidence, "تم تقديم الدليل للمراجعة");
}
export async function startReviewAction(_p: EvidenceActionState, fd: FormData) {
  return runTransition(fd, startEvidenceReview, "بدأت مراجعة الدليل");
}
export async function approveEvidenceAction(_p: EvidenceActionState, fd: FormData) {
  return runTransition(fd, approveEvidence, "تم اعتماد الدليل");
}
export async function archiveEvidenceAction(_p: EvidenceActionState, fd: FormData) {
  return runTransition(fd, archiveEvidence, "تمت أرشفة الدليل");
}

export async function rejectEvidenceAction(_p: EvidenceActionState, fd: FormData): Promise<EvidenceActionState> {
  const ctx = await getAccessContext();
  if (!ctx) return { error: "غير مصرّح" };
  const evidenceId = String(fd.get("evidenceId") ?? "");
  const solutionId = String(fd.get("solutionId") ?? "");
  try {
    await rejectEvidence(ctx, evidenceId, String(fd.get("reason") ?? ""));
  } catch (e) {
    return { error: message(e) };
  }
  revalidate(solutionId, evidenceId);
  return { success: "تم رفض الدليل" };
}

export async function linkEvidenceAction(_p: EvidenceActionState, fd: FormData): Promise<EvidenceActionState> {
  const ctx = await getAccessContext();
  if (!ctx) return { error: "غير مصرّح" };
  const evidenceId = String(fd.get("evidenceId") ?? "");
  const solutionId = String(fd.get("solutionId") ?? "");
  try {
    await linkEvidence(ctx, evidenceId, {
      entityType: fd.get("entityType"),
      entityId: fd.get("entityId"),
      requirementId: fd.get("requirementId"),
    });
  } catch (e) {
    return { error: message(e) };
  }
  revalidate(solutionId, evidenceId);
  return { success: "تم ربط الدليل" };
}

export async function unlinkEvidenceAction(_p: EvidenceActionState, fd: FormData): Promise<EvidenceActionState> {
  const ctx = await getAccessContext();
  if (!ctx) return { error: "غير مصرّح" };
  const evidenceId = String(fd.get("evidenceId") ?? "");
  const solutionId = String(fd.get("solutionId") ?? "");
  try {
    await unlinkEvidence(ctx, String(fd.get("linkId") ?? ""));
  } catch (e) {
    return { error: message(e) };
  }
  revalidate(solutionId, evidenceId);
  return { success: "تم إلغاء الربط" };
}
