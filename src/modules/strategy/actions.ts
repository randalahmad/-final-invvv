"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getAccessContext } from "@/server/authz";
import { isAuthorizationError } from "@/server/authorization";
import {
  createObjective,
  updateObjective,
  archiveObjective,
  createAssignment,
  updateAssignment,
  archiveAssignment,
  uploadStrategyDocument,
  updateStrategyDocument,
  archiveStrategyDocument,
  StrategyError,
} from "./service";

export interface StrategyFormState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
}
export interface StrategyActionState {
  error?: string;
  success?: string;
}

const MSG: Record<string, string> = {
  FORBIDDEN: "لا تملك صلاحية الوصول للتخطيط الاستراتيجي",
  OUT_OF_SCOPE: "هذا السجل خارج نطاق صلاحياتك",
  NOT_FOUND: "السجل غير موجود",
  VALIDATION: "يرجى تصحيح الحقول المطلوبة",
  BAD_REFERENCE: "المرجع المحدد غير موجود",
  ALREADY_ARCHIVED: "هذا السجل مؤرشف بالفعل أو لا يمكن تعديله",
  DUPLICATE_ASSIGNMENT: "هذا المعيار مُسنَد بالفعل لهذه الجهة",
  DUPLICATE_DOCUMENT: "توجد وثيقة نشطة بالفعل لهذا الإسناد — أرشفها أولًا لاستبدالها",
};

function toFormState(e: unknown): StrategyFormState {
  if (e instanceof StrategyError) return { error: MSG[e.code] ?? "تعذّر تنفيذ الإجراء", fieldErrors: e.fieldErrors };
  if (isAuthorizationError(e)) return { error: MSG[e.code] ?? "غير مصرّح" };
  throw e; // re-throw NEXT_REDIRECT / unknown
}
function toActionState(e: unknown): StrategyActionState {
  if (e instanceof StrategyError) return { error: MSG[e.code] ?? "تعذّر تنفيذ الإجراء" };
  if (isAuthorizationError(e)) return { error: MSG[e.code] ?? "غير مصرّح" };
  throw e;
}

function payload(formData: FormData) {
  return {
    code: formData.get("code") || undefined,
    titleAr: formData.get("titleAr"),
    description: formData.get("description") || undefined,
    departmentId: formData.get("departmentId"),
    responsibleUserId: formData.get("responsibleUserId") || undefined,
    kpi: formData.get("kpi") || undefined,
    targetValue: formData.get("targetValue") || undefined,
    periodStart: formData.get("periodStart") || undefined,
    periodEnd: formData.get("periodEnd") || undefined,
  };
}

export async function createObjectiveAction(_prev: StrategyFormState, formData: FormData): Promise<StrategyFormState> {
  const ctx = await getAccessContext();
  if (!ctx) return { error: "غير مصرّح" };
  let newId: string;
  try {
    const created = await createObjective(ctx, payload(formData));
    newId = created.id;
  } catch (e) {
    return toFormState(e);
  }
  revalidatePath("/strategy");
  redirect(`/strategy/${newId}`);
}

export async function updateObjectiveAction(_prev: StrategyFormState, formData: FormData): Promise<StrategyFormState> {
  const ctx = await getAccessContext();
  if (!ctx) return { error: "غير مصرّح" };
  const id = String(formData.get("objectiveId") ?? "");
  try {
    await updateObjective(ctx, id, payload(formData));
  } catch (e) {
    return toFormState(e);
  }
  revalidatePath(`/strategy/${id}`);
  redirect(`/strategy/${id}`);
}

export async function archiveObjectiveAction(_prev: StrategyActionState, formData: FormData): Promise<StrategyActionState> {
  const ctx = await getAccessContext();
  if (!ctx) return { error: "غير مصرّح" };
  const id = String(formData.get("objectiveId") ?? "");
  try {
    await archiveObjective(ctx, id);
  } catch (e) {
    return toActionState(e);
  }
  revalidatePath(`/strategy/${id}`);
  revalidatePath("/strategy");
  return { success: "تم تنفيذ الإجراء" };
}

// ── Assignments ───────────────────────────────────────────────────────────

function assignmentPayload(formData: FormData) {
  return {
    complianceRequirementId: formData.get("complianceRequirementId"),
    departmentId: formData.get("departmentId"),
    strategicObjectiveId: formData.get("strategicObjectiveId") || undefined,
    dueDate: formData.get("dueDate") || undefined,
  };
}

export async function createAssignmentAction(_prev: StrategyFormState, formData: FormData): Promise<StrategyFormState> {
  const ctx = await getAccessContext();
  if (!ctx) return { error: "غير مصرّح" };
  const objectiveId = String(formData.get("objectiveId") ?? "");
  try {
    await createAssignment(ctx, assignmentPayload(formData));
  } catch (e) {
    return toFormState(e);
  }
  revalidatePath(`/strategy/${objectiveId}`);
  redirect(`/strategy/${objectiveId}`);
}

export async function archiveAssignmentAction(_prev: StrategyActionState, formData: FormData): Promise<StrategyActionState> {
  const ctx = await getAccessContext();
  if (!ctx) return { error: "غير مصرّح" };
  const assignmentId = String(formData.get("assignmentId") ?? "");
  const objectiveId = String(formData.get("objectiveId") ?? "");
  try {
    await archiveAssignment(ctx, assignmentId);
  } catch (e) {
    return toActionState(e);
  }
  revalidatePath(`/strategy/${objectiveId}`);
  return { success: "تم تنفيذ الإجراء" };
}

export async function updateAssignmentAction(_prev: StrategyActionState, formData: FormData): Promise<StrategyActionState> {
  const ctx = await getAccessContext();
  if (!ctx) return { error: "غير مصرّح" };
  const assignmentId = String(formData.get("assignmentId") ?? "");
  const objectiveId = String(formData.get("objectiveId") ?? "");
  try {
    await updateAssignment(ctx, assignmentId, { dueDate: formData.get("dueDate") || undefined, strategicObjectiveId: objectiveId });
  } catch (e) {
    return toActionState(e);
  }
  revalidatePath(`/strategy/${objectiveId}`);
  return { success: "تم تحديث تاريخ الاستحقاق" };
}

// ── StrategyDocument ──────────────────────────────────────────────────────

async function fileFromFormData(formData: FormData): Promise<{ fileName: string; mimeType: string; bytes: Buffer } | undefined> {
  const f = formData.get("file");
  if (!(f instanceof File) || f.size === 0) return undefined;
  const bytes = Buffer.from(await f.arrayBuffer());
  return { fileName: f.name, mimeType: f.type, bytes };
}

export async function uploadStrategyDocumentAction(_prev: StrategyFormState, formData: FormData): Promise<StrategyFormState> {
  const ctx = await getAccessContext();
  if (!ctx) return { error: "غير مصرّح" };
  const assignmentId = String(formData.get("assignmentId") ?? "");
  const objectiveId = String(formData.get("objectiveId") ?? "");
  const payload = {
    titleAr: formData.get("titleAr"),
    documentType: formData.get("documentType"),
    description: formData.get("description") || undefined,
    documentDate: formData.get("documentDate") || undefined,
    approvalStatus: formData.get("approvalStatus") || "DRAFT",
    notes: formData.get("notes") || undefined,
  };
  try {
    const file = await fileFromFormData(formData);
    await uploadStrategyDocument(ctx, assignmentId, payload, file);
  } catch (e) {
    return toFormState(e);
  }
  revalidatePath(`/strategy/${objectiveId}`);
  redirect(`/strategy/${objectiveId}`);
}

export async function archiveStrategyDocumentAction(_prev: StrategyActionState, formData: FormData): Promise<StrategyActionState> {
  const ctx = await getAccessContext();
  if (!ctx) return { error: "غير مصرّح" };
  const documentId = String(formData.get("documentId") ?? "");
  const objectiveId = String(formData.get("objectiveId") ?? "");
  try {
    await archiveStrategyDocument(ctx, documentId);
  } catch (e) {
    return toActionState(e);
  }
  revalidatePath(`/strategy/${objectiveId}`);
  return { success: "تم تنفيذ الإجراء" };
}

export async function updateStrategyDocumentAction(_prev: StrategyFormState, formData: FormData): Promise<StrategyFormState> {
  const ctx = await getAccessContext();
  if (!ctx) return { error: "غير مصرّح" };
  const documentId = String(formData.get("documentId") ?? "");
  const objectiveId = String(formData.get("objectiveId") ?? "");
  const payload = {
    titleAr: formData.get("titleAr"),
    documentType: formData.get("documentType"),
    description: formData.get("description") || undefined,
    documentDate: formData.get("documentDate") || undefined,
    approvalStatus: formData.get("approvalStatus") || "DRAFT",
    notes: formData.get("notes") || undefined,
  };
  try {
    await updateStrategyDocument(ctx, documentId, payload);
  } catch (e) {
    return toFormState(e);
  }
  revalidatePath(`/strategy/${objectiveId}`);
  redirect(`/strategy/${objectiveId}`);
}
