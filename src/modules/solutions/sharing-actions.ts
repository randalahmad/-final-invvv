"use server";

import { revalidatePath } from "next/cache";

import { getAccessContext } from "@/server/authz";
import { toActionState, type ActionState } from "./action-errors";
import {
  grantSolutionShare,
  updateSolutionShare,
  revokeSolutionShare,
  addParticipatingOrganization,
  removeParticipatingOrganization,
} from "./sharing-service";

export type SharingActionState = ActionState;

function revalidate(id: string) {
  revalidatePath(`/solutions/${id}`);
  revalidatePath("/solutions");
}

function parseDate(v: FormDataEntryValue | null): Date | null {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function grantShareAction(_p: SharingActionState, fd: FormData): Promise<SharingActionState> {
  const ctx = await getAccessContext();
  if (!ctx) return { error: "غير مصرّح" };
  const id = String(fd.get("solutionId") ?? "");
  try {
    await grantSolutionShare(ctx, id, {
      userId: String(fd.get("userId") ?? ""),
      allowedActions: fd.getAll("allowedActions").map(String),
      allowedFields: fd.getAll("allowedFields").map(String),
      expiresAt: parseDate(fd.get("expiresAt")),
    });
  } catch (e) {
    return toActionState(e);
  }
  revalidate(id);
  return { success: "تم منح المشاركة" };
}

export async function updateShareAction(_p: SharingActionState, fd: FormData): Promise<SharingActionState> {
  const ctx = await getAccessContext();
  if (!ctx) return { error: "غير مصرّح" };
  const id = String(fd.get("solutionId") ?? "");
  try {
    await updateSolutionShare(ctx, String(fd.get("shareId") ?? ""), {
      allowedActions: fd.getAll("allowedActions").map(String),
      allowedFields: fd.getAll("allowedFields").map(String),
      expiresAt: parseDate(fd.get("expiresAt")),
    });
  } catch (e) {
    return toActionState(e);
  }
  revalidate(id);
  return { success: "تم تحديث المشاركة" };
}

export async function revokeShareAction(_p: SharingActionState, fd: FormData): Promise<SharingActionState> {
  const ctx = await getAccessContext();
  if (!ctx) return { error: "غير مصرّح" };
  const id = String(fd.get("solutionId") ?? "");
  try {
    await revokeSolutionShare(ctx, String(fd.get("shareId") ?? ""));
  } catch (e) {
    return toActionState(e);
  }
  revalidate(id);
  return { success: "تم إلغاء المشاركة" };
}

export async function addOrganizationAction(_p: SharingActionState, fd: FormData): Promise<SharingActionState> {
  const ctx = await getAccessContext();
  if (!ctx) return { error: "غير مصرّح" };
  const id = String(fd.get("solutionId") ?? "");
  try {
    await addParticipatingOrganization(ctx, id, String(fd.get("organizationId") ?? ""));
  } catch (e) {
    return toActionState(e);
  }
  revalidate(id);
  return { success: "تمت إضافة الجهة" };
}

export async function removeOrganizationAction(_p: SharingActionState, fd: FormData): Promise<SharingActionState> {
  const ctx = await getAccessContext();
  if (!ctx) return { error: "غير مصرّح" };
  const id = String(fd.get("solutionId") ?? "");
  try {
    await removeParticipatingOrganization(ctx, id, String(fd.get("organizationId") ?? ""));
  } catch (e) {
    return toActionState(e);
  }
  revalidate(id);
  return { success: "تمت إزالة الجهة" };
}
