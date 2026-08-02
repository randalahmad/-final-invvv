"use server";

import { revalidatePath } from "next/cache";

import { getAccessContext } from "@/server/authz";
import { isAuthorizationError } from "@/server/authorization";
import {
  approveForPilot,
  rejectIdea,
  reopenIdeaDecision,
  supersedeIdeaDecision,
  DecisionError,
} from "./decision-service";
import { convertApprovedIdeaToSolution } from "./conversion-service";

export interface DecisionActionState {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string[]>;
}

const MSG: Record<string, string> = {
  FORBIDDEN: "لا تملك صلاحية اتخاذ القرار",
  OUT_OF_SCOPE: "هذه الفكرة خارج نطاق صلاحياتك",
  NOT_FOUND: "الفكرة غير موجودة",
  VALIDATION: "يرجى تصحيح الحقول المطلوبة",
  INVALID_TRANSITION: "لا يمكن تنفيذ هذا القرار على حالة الفكرة الحالية",
  SELF_DECISION: "لا يمكن اتخاذ قرار على فكرتك الخاصة",
  NOT_FINALIZED: "القرار غير نهائي",
  NOT_APPROVED: "التحويل متاح فقط للأفكار المعتمدة للتجريب",
  ALREADY_CONVERTED: "تم تحويل هذه الفكرة إلى حل مسبقًا",
  IMMUTABLE: "القرار النهائي محمي من التعديل المباشر",
};

function toState(e: unknown): DecisionActionState {
  if (e instanceof DecisionError) return { error: MSG[e.code] ?? "تعذّر تنفيذ الإجراء", fieldErrors: e.fieldErrors };
  if (isAuthorizationError(e)) return { error: MSG[e.code] ?? "غير مصرّح" };
  throw e;
}

function revalidate(ideaId: string) {
  revalidatePath(`/governance/ideas/${ideaId}`);
  revalidatePath("/governance/ideas");
  revalidatePath("/governance");
}

export async function approveIdeaAction(_prev: DecisionActionState, formData: FormData): Promise<DecisionActionState> {
  const ctx = await getAccessContext();
  if (!ctx) return { error: "غير مصرّح" };
  const ideaId = String(formData.get("ideaId") ?? "");
  try {
    await approveForPilot(ctx, ideaId, { notes: formData.get("notes") || undefined });
  } catch (e) {
    return toState(e);
  }
  revalidate(ideaId);
  return { success: "تم اعتماد الفكرة للتجريب" };
}

export async function rejectIdeaAction(_prev: DecisionActionState, formData: FormData): Promise<DecisionActionState> {
  const ctx = await getAccessContext();
  if (!ctx) return { error: "غير مصرّح" };
  const ideaId = String(formData.get("ideaId") ?? "");
  try {
    await rejectIdea(ctx, ideaId, { notes: formData.get("notes") || undefined });
  } catch (e) {
    return toState(e);
  }
  revalidate(ideaId);
  return { success: "تم رفض الفكرة" };
}

export async function convertIdeaAction(_prev: DecisionActionState, formData: FormData): Promise<DecisionActionState> {
  const ctx = await getAccessContext();
  if (!ctx) return { error: "غير مصرّح" };
  const ideaId = String(formData.get("ideaId") ?? "");
  try {
    await convertApprovedIdeaToSolution(ctx, ideaId);
  } catch (e) {
    return toState(e);
  }
  revalidate(ideaId);
  return { success: "تم تحويل الفكرة إلى حل ابتكاري" };
}

export async function reopenDecisionAction(_prev: DecisionActionState, formData: FormData): Promise<DecisionActionState> {
  const ctx = await getAccessContext();
  if (!ctx) return { error: "غير مصرّح" };
  const ideaId = String(formData.get("ideaId") ?? "");
  const decisionId = String(formData.get("decisionId") ?? "");
  try {
    await reopenIdeaDecision(ctx, ideaId, decisionId, { reason: formData.get("reason") ?? "" });
  } catch (e) {
    return toState(e);
  }
  revalidate(ideaId);
  return { success: "تمت إعادة فتح القرار" };
}

export async function supersedeDecisionAction(_prev: DecisionActionState, formData: FormData): Promise<DecisionActionState> {
  const ctx = await getAccessContext();
  if (!ctx) return { error: "غير مصرّح" };
  const ideaId = String(formData.get("ideaId") ?? "");
  const decisionId = String(formData.get("decisionId") ?? "");
  try {
    await supersedeIdeaDecision(ctx, ideaId, decisionId, {
      decision: formData.get("decision") ?? "",
      reason: formData.get("reason") ?? "",
    });
  } catch (e) {
    return toState(e);
  }
  revalidate(ideaId);
  return { success: "تم إصدار قرار مُصحّح" };
}
