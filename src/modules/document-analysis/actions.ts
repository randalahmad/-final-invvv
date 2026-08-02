"use server";

import { revalidatePath } from "next/cache";

import { getAccessContext } from "@/server/authz";
import { isAuthorizationError } from "@/server/authorization";
import { runEvidenceAnalysis, reviewSuggestion, acceptHighConfidence, AnalysisError } from "./service";

export interface AnalysisActionState {
  error?: string;
  success?: string;
}

const MSG: Record<string, string> = {
  FORBIDDEN: "لا تملك صلاحية تنفيذ هذا الإجراء",
  OUT_OF_SCOPE: "هذا السجل خارج نطاق صلاحياتك",
  NOT_FOUND: "السجل غير موجود",
  UNSUPPORTED_FORMAT: "صيغة الملف غير مدعومة للتحليل",
  EVIDENCE_LOCKED: "لا يمكن تحليل دليل معتمد أو مؤرشف",
  NO_BINARY: "لا يوجد ملف مخزّن للتحليل",
  NOT_READY: "التحليل غير جاهز بعد",
  INVALID_OUTCOME: "نتيجة مراجعة غير صالحة",
  VALIDATION: "بيانات غير صالحة",
};

function message(e: unknown): string {
  if (e instanceof AnalysisError) return MSG[e.code] ?? "تعذّر تنفيذ الإجراء";
  if (isAuthorizationError(e)) return MSG[e.code] ?? "غير مصرّح";
  throw e;
}

function revalidate(solutionId: string, evidenceId: string) {
  revalidatePath(`/solutions/${solutionId}/evidence/${evidenceId}`);
}

export async function runAnalysisAction(_p: AnalysisActionState, fd: FormData): Promise<AnalysisActionState> {
  const ctx = await getAccessContext();
  if (!ctx) return { error: "غير مصرّح" };
  const evidenceId = String(fd.get("evidenceId") ?? "");
  const solutionId = String(fd.get("solutionId") ?? "");
  try {
    const result = await runEvidenceAnalysis(ctx, evidenceId);
    revalidate(solutionId, evidenceId);
    return result.status === "COMPLETED"
      ? { success: `اكتمل التحليل — ${result.suggestions} اقتراحًا جاهزًا للمراجعة` }
      : { error: "فشل التحليل — المطابقة اليدوية متاحة" };
  } catch (e) {
    return { error: message(e) };
  }
}

export async function reviewSuggestionAction(_p: AnalysisActionState, fd: FormData): Promise<AnalysisActionState> {
  const ctx = await getAccessContext();
  if (!ctx) return { error: "غير مصرّح" };
  const evidenceId = String(fd.get("evidenceId") ?? "");
  const solutionId = String(fd.get("solutionId") ?? "");
  const outcomeRaw = String(fd.get("outcome") ?? "");
  if (!["ACCEPTED", "EDITED", "REJECTED"].includes(outcomeRaw)) return { error: MSG.INVALID_OUTCOME };
  const editedRaw = fd.get("editedValue");
  try {
    await reviewSuggestion(ctx, String(fd.get("suggestionId") ?? ""), {
      outcome: outcomeRaw as "ACCEPTED" | "EDITED" | "REJECTED",
      editedValue: editedRaw != null && String(editedRaw).trim() !== "" ? String(editedRaw) : undefined,
    });
  } catch (e) {
    return { error: message(e) };
  }
  revalidate(solutionId, evidenceId);
  return { success: "تم تسجيل المراجعة" };
}

export async function acceptHighConfidenceAction(_p: AnalysisActionState, fd: FormData): Promise<AnalysisActionState> {
  const ctx = await getAccessContext();
  if (!ctx) return { error: "غير مصرّح" };
  const evidenceId = String(fd.get("evidenceId") ?? "");
  const solutionId = String(fd.get("solutionId") ?? "");
  try {
    const { accepted } = await acceptHighConfidence(ctx, evidenceId);
    revalidate(solutionId, evidenceId);
    return { success: `تم قبول ${accepted} اقتراحًا عالي الثقة` };
  } catch (e) {
    return { error: message(e) };
  }
}
