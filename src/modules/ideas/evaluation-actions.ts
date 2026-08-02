"use server";

import { revalidatePath } from "next/cache";

import { getAccessContext } from "@/server/authz";
import { isAuthorizationError } from "@/server/authorization";
import {
  startInitialReview,
  submitInitialEvaluation,
  advanceToTechnicalReview,
  submitTechnicalEvaluation,
  requestMoreInformation,
  resubmitRequestedInformation,
  EvaluationError,
} from "./evaluation-service";

export interface EvalFormState {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string[]>;
}

const MSG: Record<string, string> = {
  FORBIDDEN: "لا تملك صلاحية المراجعة",
  OUT_OF_SCOPE: "هذه الفكرة خارج نطاق صلاحياتك",
  NOT_FOUND: "غير موجود",
  VALIDATION: "يرجى تصحيح الحقول المطلوبة",
  INVALID_TRANSITION: "لا يمكن تنفيذ هذا الإجراء على حالة الفكرة الحالية",
  INVALID_STAGE: "هذا التقييم غير متاح في المرحلة الحالية",
  SELF_EVALUATION: "لا يمكن لصاحب الفكرة تقييم فكرته",
  NOT_AUTHOR: "هذا الإجراء من صلاحية صاحب الفكرة",
  NO_OPEN_REQUEST: "لا يوجد طلب معلومات مفتوح",
};

function toState(e: unknown): EvalFormState {
  if (e instanceof EvaluationError) return { error: MSG[e.code] ?? "تعذّر تنفيذ الإجراء", fieldErrors: e.fieldErrors };
  if (isAuthorizationError(e)) return { error: MSG[e.code] ?? "غير مصرّح" };
  throw e;
}

function ideaIdOf(fd: FormData): string {
  return String(fd.get("ideaId") ?? "");
}

async function run(fd: FormData, fn: (ctx: NonNullable<Awaited<ReturnType<typeof getAccessContext>>>, id: string) => Promise<unknown>): Promise<EvalFormState> {
  const ctx = await getAccessContext();
  if (!ctx) return { error: "غير مصرّح" };
  const id = ideaIdOf(fd);
  try {
    await fn(ctx, id);
  } catch (e) {
    return toState(e);
  }
  revalidatePath(`/governance/ideas/${id}`);
  return { success: "تم تنفيذ الإجراء" };
}

export async function startInitialReviewAction(_p: EvalFormState, fd: FormData): Promise<EvalFormState> {
  return run(fd, (ctx, id) => startInitialReview(ctx, id));
}
export async function advanceToTechnicalReviewAction(_p: EvalFormState, fd: FormData): Promise<EvalFormState> {
  return run(fd, (ctx, id) => advanceToTechnicalReview(ctx, id));
}
export async function submitInitialEvaluationAction(_p: EvalFormState, fd: FormData): Promise<EvalFormState> {
  const raw = { comments: fd.get("comments"), score: fd.get("score") ?? "" };
  return run(fd, (ctx, id) => submitInitialEvaluation(ctx, id, raw));
}
export async function submitTechnicalEvaluationAction(_p: EvalFormState, fd: FormData): Promise<EvalFormState> {
  const raw = { comments: fd.get("comments"), score: fd.get("score") ?? "" };
  return run(fd, (ctx, id) => submitTechnicalEvaluation(ctx, id, raw));
}
export async function requestMoreInformationAction(_p: EvalFormState, fd: FormData): Promise<EvalFormState> {
  const raw = { requestedInfo: fd.get("requestedInfo") };
  return run(fd, (ctx, id) => requestMoreInformation(ctx, id, raw));
}
export async function resubmitInfoAction(_p: EvalFormState, fd: FormData): Promise<EvalFormState> {
  const raw = { responseText: fd.get("responseText") };
  return run(fd, (ctx, id) => resubmitRequestedInformation(ctx, id, raw));
}
