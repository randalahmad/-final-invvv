"use server";

import { revalidatePath } from "next/cache";

import { getAccessContext } from "@/server/authz";
import { isAuthorizationError } from "@/server/authorization";
import { naRequestSchema, naDecisionSchema } from "./schema";
import { requestNA, approveNA, rejectNA, revokeNA, ComplianceError } from "./service";

export interface ComplianceActionState {
  error?: string;
  success?: string;
}

const MSG: Record<string, string> = {
  FORBIDDEN: "لا تملك صلاحية تنفيذ هذا الإجراء",
  OUT_OF_SCOPE: "هذا الحل خارج نطاق صلاحياتك",
  NOT_FOUND: "السجل غير موجود",
  NOT_INTERNAL: "ملف الامتثال متاح للفريق الداخلي فقط",
  NA_NOT_ALLOWED: "لا يسمح هذا المتطلب باستثناء عدم الانطباق",
  NA_INVALID_STATE: "لا يمكن تنفيذ هذا الإجراء على حالة الاستثناء الحالية",
  PLATFORM_REQUIRED: "يتطلب هذا الإجراء نطاقًا على مستوى المنصة",
  VALIDATION: "بيانات غير صالحة",
};

function message(e: unknown): string {
  if (e instanceof ComplianceError) return MSG[e.code] ?? "تعذّر تنفيذ الإجراء";
  if (isAuthorizationError(e)) return MSG[e.code] ?? "غير مصرّح";
  throw e;
}

function revalidate(solutionId: string) {
  revalidatePath(`/solutions/${solutionId}/compliance`);
  revalidatePath(`/compliance`);
}

export async function requestNAAction(_p: ComplianceActionState, fd: FormData): Promise<ComplianceActionState> {
  const ctx = await getAccessContext();
  if (!ctx) return { error: "غير مصرّح" };
  const parsed = naRequestSchema.safeParse({
    requirementId: String(fd.get("requirementId") ?? ""),
    solutionId: String(fd.get("solutionId") ?? ""),
    reason: String(fd.get("reason") ?? ""),
  });
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors.reason?.[0] ?? MSG.VALIDATION };
  try {
    await requestNA(ctx, parsed.data);
    revalidate(parsed.data.solutionId);
    return { success: "تم تقديم طلب استثناء عدم الانطباق (بانتظار الاعتماد)" };
  } catch (e) {
    return { error: message(e) };
  }
}

type NAOp = "approve" | "reject" | "revoke";

async function naDecisionAction(op: NAOp, fd: FormData): Promise<ComplianceActionState> {
  const ctx = await getAccessContext();
  if (!ctx) return { error: "غير مصرّح" };
  const parsed = naDecisionSchema.safeParse({ naId: String(fd.get("naId") ?? ""), solutionId: String(fd.get("solutionId") ?? "") });
  if (!parsed.success) return { error: MSG.VALIDATION };
  const { naId, solutionId } = parsed.data;
  try {
    if (op === "approve") await approveNA(ctx, naId, solutionId);
    else if (op === "reject") await rejectNA(ctx, naId, solutionId);
    else await revokeNA(ctx, naId, solutionId);
    revalidate(solutionId);
    return { success: op === "approve" ? "تم اعتماد الاستثناء" : op === "reject" ? "تم رفض الطلب" : "تم إلغاء الاستثناء" };
  } catch (e) {
    return { error: message(e) };
  }
}

export async function approveNAAction(_p: ComplianceActionState, fd: FormData): Promise<ComplianceActionState> {
  return naDecisionAction("approve", fd);
}
export async function rejectNAAction(_p: ComplianceActionState, fd: FormData): Promise<ComplianceActionState> {
  return naDecisionAction("reject", fd);
}
export async function revokeNAAction(_p: ComplianceActionState, fd: FormData): Promise<ComplianceActionState> {
  return naDecisionAction("revoke", fd);
}
