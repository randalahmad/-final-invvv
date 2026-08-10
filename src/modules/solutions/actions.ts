"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getAccessContext } from "@/server/authz";
import { isAuthorizationError } from "@/server/authorization";
import { createSolution, updateDraftSolution, archiveSolution, updateSharedSolutionFields, addSolutionAward, removeSolutionAward, SolutionError } from "./service";

export interface SolutionFormState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
}
export interface SolutionActionState {
  error?: string;
  success?: string;
}

const MSG: Record<string, string> = {
  FORBIDDEN: "لا تملك صلاحية تنفيذ هذا الإجراء",
  OUT_OF_SCOPE: "هذا الحل خارج نطاق صلاحياتك",
  NOT_FOUND: "الحل غير موجود",
  VALIDATION: "يرجى تصحيح الحقول المطلوبة",
  NOT_DRAFT: "يمكن تعديل المسودات فقط",
  INVALID_STATE: "لا يمكن تنفيذ هذا الإجراء على الحالة الحالية",
  BAD_REFERENCE: "أحد المراجع المرتبطة غير صالح",
  FIELD_FORBIDDEN: "أحد الحقول غير مسموح بتعديله ضمن المشاركة",
  SHARE_INACTIVE: "لا توجد مشاركة سارية لهذا الحل",
  ACTION_NOT_ALLOWED: "هذا الإجراء غير مسموح ضمن المشاركة",
};

function toFormState(e: unknown): SolutionFormState {
  if (e instanceof SolutionError) return { error: MSG[e.code] ?? "تعذّر تنفيذ الإجراء", fieldErrors: e.fieldErrors };
  if (isAuthorizationError(e)) return { error: MSG[e.code] ?? "غير مصرّح" };
  throw e;
}
function toActionState(e: unknown): SolutionActionState {
  if (e instanceof SolutionError) return { error: MSG[e.code] ?? "تعذّر تنفيذ الإجراء" };
  if (isAuthorizationError(e)) return { error: MSG[e.code] ?? "غير مصرّح" };
  throw e;
}

function payload(fd: FormData) {
  return {
    nameAr: fd.get("nameAr"),
    description: fd.get("description"),
    problemStatement: fd.get("problemStatement"),
    owningDepartmentId: fd.get("owningDepartmentId"),
    source: fd.get("source") || undefined,
    activityId: fd.get("activityId"),
    ownerUserId: fd.get("ownerUserId"),
    strategicObjectiveId: fd.get("strategicObjectiveId"),
    maturityStage: fd.get("maturityStage") || undefined,
    implementationStatus: fd.get("implementationStatus") || undefined,
    startDate: fd.get("startDate"),
    targetEndDate: fd.get("targetEndDate"),
    actualEndDate: fd.get("actualEndDate"),
    durationMonths: fd.get("durationMonths"),
    cost: fd.get("cost"),
    targetBeneficiaries: fd.get("targetBeneficiaries"),
    technologies: fd.get("technologies"),
    risks: fd.get("risks"),
    notes: fd.get("notes"),
    launchDate: fd.get("launchDate"),
    beneficiaryCount: fd.get("beneficiaryCount"),
    achievedOrExpectedImpact: fd.get("achievedOrExpectedImpact"),
    beneficiarySatisfactionPct: fd.get("beneficiarySatisfactionPct"),
    previouslySubmittedForMeasurement: fd.get("previouslySubmittedForMeasurement") ?? undefined,
    significantChangeNote: fd.get("significantChangeNote"),
    innovationMethodologySource: fd.get("innovationMethodologySource"),
    digitalTransformationPlanLink: fd.get("digitalTransformationPlanLink"),
    isSustained: fd.get("isSustained") ?? undefined,
    sustainabilityOwner: fd.get("sustainabilityOwner"),
    sustainabilityPlan: fd.get("sustainabilityPlan"),
  };
}

export async function createSolutionAction(_prev: SolutionFormState, formData: FormData): Promise<SolutionFormState> {
  const ctx = await getAccessContext();
  if (!ctx) return { error: "غير مصرّح" };
  let id: string;
  try {
    const created = await createSolution(ctx, payload(formData));
    id = created.id;
  } catch (e) {
    return toFormState(e);
  }
  revalidatePath("/solutions");
  redirect(`/solutions/${id}`);
}

export async function updateSolutionAction(_prev: SolutionFormState, formData: FormData): Promise<SolutionFormState> {
  const ctx = await getAccessContext();
  if (!ctx) return { error: "غير مصرّح" };
  const id = String(formData.get("solutionId") ?? "");
  try {
    await updateDraftSolution(ctx, id, payload(formData));
  } catch (e) {
    return toFormState(e);
  }
  revalidatePath(`/solutions/${id}`);
  redirect(`/solutions/${id}`);
}

export async function archiveSolutionAction(_prev: SolutionActionState, formData: FormData): Promise<SolutionActionState> {
  const ctx = await getAccessContext();
  if (!ctx) return { error: "غير مصرّح" };
  const id = String(formData.get("solutionId") ?? "");
  try {
    await archiveSolution(ctx, id);
  } catch (e) {
    return toActionState(e);
  }
  revalidatePath(`/solutions/${id}`);
  revalidatePath("/solutions");
  return { success: "تمت أرشفة الحل" };
}

/** Partner-only write of allow-listed shared fields. */
export async function updateSharedFieldsAction(_prev: SolutionActionState, formData: FormData): Promise<SolutionActionState> {
  const ctx = await getAccessContext();
  if (!ctx) return { error: "غير مصرّح" };
  const id = String(formData.get("solutionId") ?? "");
  const values: Record<string, string> = {};
  for (const key of ["notes", "description", "technologies", "targetBeneficiaries", "risks"]) {
    const v = formData.get(key);
    if (typeof v === "string") values[key] = v;
  }
  try {
    await updateSharedSolutionFields(ctx, id, values);
  } catch (e) {
    return toActionState(e);
  }
  revalidatePath(`/solutions/${id}`);
  return { success: "تم حفظ التعديلات المسموح بها" };
}

export async function addSolutionAwardAction(_prev: SolutionActionState, formData: FormData): Promise<SolutionActionState> {
  const ctx = await getAccessContext();
  if (!ctx) return { error: "غير مصرّح" };
  const solutionId = String(formData.get("solutionId") ?? "");
  const level = String(formData.get("level") ?? "LOCAL") as "LOCAL" | "REGIONAL" | "INTERNATIONAL";
  const awardedAtRaw = String(formData.get("awardedAt") ?? "");
  try {
    await addSolutionAward(ctx, {
      solutionId,
      nameAr: String(formData.get("nameAr") ?? ""),
      level,
      awardedAt: awardedAtRaw ? new Date(awardedAtRaw) : null,
      evidenceNote: String(formData.get("evidenceNote") ?? "") || null,
    });
  } catch (e) {
    return toActionState(e);
  }
  revalidatePath(`/solutions/${solutionId}`);
  return { success: "أُضيفت الجائزة" };
}

export async function removeSolutionAwardAction(_prev: SolutionActionState, formData: FormData): Promise<SolutionActionState> {
  const ctx = await getAccessContext();
  if (!ctx) return { error: "غير مصرّح" };
  const solutionId = String(formData.get("solutionId") ?? "");
  const awardId = String(formData.get("awardId") ?? "");
  try {
    await removeSolutionAward(ctx, solutionId, awardId);
  } catch (e) {
    return toActionState(e);
  }
  revalidatePath(`/solutions/${solutionId}`);
  return { success: "أُزيلت الجائزة" };
}
