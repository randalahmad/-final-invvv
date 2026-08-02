"use server";

import { revalidatePath } from "next/cache";
import type { ImplementationStatus, MaturityStage, RecordStatus } from "@prisma/client";

import { getAccessContext } from "@/server/authz";
import { toActionState, type ActionState } from "./action-errors";
import {
  changeRecordStatus,
  changeImplementationStatus,
  changeMaturityStage,
  publishSolution,
  unpublishSolution,
} from "./lifecycle-service";

export type LifecycleActionState = ActionState;

function revalidate(id: string) {
  revalidatePath(`/solutions/${id}`);
  revalidatePath("/solutions");
  revalidatePath("/dashboard");
}

export async function changeRecordStatusAction(_p: LifecycleActionState, fd: FormData): Promise<LifecycleActionState> {
  const ctx = await getAccessContext();
  if (!ctx) return { error: "غير مصرّح" };
  const id = String(fd.get("solutionId") ?? "");
  try {
    await changeRecordStatus(ctx, id, String(fd.get("to") ?? "") as RecordStatus);
  } catch (e) {
    return toActionState(e);
  }
  revalidate(id);
  return { success: "تم تحديث حالة السجل" };
}

export async function changeImplementationAction(_p: LifecycleActionState, fd: FormData): Promise<LifecycleActionState> {
  const ctx = await getAccessContext();
  if (!ctx) return { error: "غير مصرّح" };
  const id = String(fd.get("solutionId") ?? "");
  try {
    await changeImplementationStatus(ctx, id, String(fd.get("to") ?? "") as ImplementationStatus);
  } catch (e) {
    return toActionState(e);
  }
  revalidate(id);
  return { success: "تم تحديث حالة التنفيذ" };
}

export async function changeMaturityAction(_p: LifecycleActionState, fd: FormData): Promise<LifecycleActionState> {
  const ctx = await getAccessContext();
  if (!ctx) return { error: "غير مصرّح" };
  const id = String(fd.get("solutionId") ?? "");
  try {
    await changeMaturityStage(ctx, id, String(fd.get("to") ?? "") as MaturityStage, String(fd.get("reason") ?? ""));
  } catch (e) {
    return toActionState(e);
  }
  revalidate(id);
  return { success: "تم تحديث مرحلة النضج" };
}

export async function publishSolutionAction(_p: LifecycleActionState, fd: FormData): Promise<LifecycleActionState> {
  const ctx = await getAccessContext();
  if (!ctx) return { error: "غير مصرّح" };
  const id = String(fd.get("solutionId") ?? "");
  try {
    await publishSolution(ctx, id);
  } catch (e) {
    return toActionState(e);
  }
  revalidate(id);
  return { success: "تم نشر الحل للاطّلاع" };
}

export async function unpublishSolutionAction(_p: LifecycleActionState, fd: FormData): Promise<LifecycleActionState> {
  const ctx = await getAccessContext();
  if (!ctx) return { error: "غير مصرّح" };
  const id = String(fd.get("solutionId") ?? "");
  try {
    await unpublishSolution(ctx, id);
  } catch (e) {
    return toActionState(e);
  }
  revalidate(id);
  return { success: "تم إلغاء النشر" };
}
