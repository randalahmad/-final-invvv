"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getAccessContext } from "@/server/authz";
import { isAuthorizationError } from "@/server/authorization";
import {
  createCommittee,
  updateCommittee,
  archiveCommittee,
  addCommitteeMember,
  updateCommitteeMember,
  endCommitteeMembership,
  createCommitteeMeeting,
  updateCommitteeMeeting,
  archiveCommitteeMeeting,
  CommitteeError,
} from "./service";

export interface CommitteeFormState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
}
export interface CommitteeActionState {
  error?: string;
  success?: string;
}

const MSG: Record<string, string> = {
  FORBIDDEN: "لا تملك صلاحية الوصول لحوكمة الابتكار",
  OUT_OF_SCOPE: "هذا السجل خارج نطاق صلاحياتك",
  NOT_FOUND: "السجل غير موجود",
  VALIDATION: "يرجى تصحيح الحقول المطلوبة",
  BAD_REFERENCE: "الجهة المحددة غير موجودة",
  ALREADY_ARCHIVED: "هذا السجل مؤرشف بالفعل أو لا يمكن تعديله",
};

function toFormState(e: unknown): CommitteeFormState {
  if (e instanceof CommitteeError) return { error: MSG[e.code] ?? "تعذّر تنفيذ الإجراء", fieldErrors: e.fieldErrors };
  if (isAuthorizationError(e)) return { error: MSG[e.code] ?? "غير مصرّح" };
  throw e;
}
function toActionState(e: unknown): CommitteeActionState {
  if (e instanceof CommitteeError) return { error: MSG[e.code] ?? "تعذّر تنفيذ الإجراء" };
  if (isAuthorizationError(e)) return { error: MSG[e.code] ?? "غير مصرّح" };
  throw e;
}

// ── Committee ────────────────────────────────────────────────────────────

function committeePayload(formData: FormData) {
  return {
    nameAr: formData.get("nameAr"),
    category: formData.get("category") || undefined,
    type: formData.get("type") || undefined,
    purpose: formData.get("purpose") || undefined,
    organizationId: formData.get("organizationId"),
    decisionNumber: formData.get("decisionNumber") || undefined,
    decisionDate: formData.get("decisionDate") || undefined,
  };
}

export async function createCommitteeAction(_prev: CommitteeFormState, formData: FormData): Promise<CommitteeFormState> {
  const ctx = await getAccessContext();
  if (!ctx) return { error: "غير مصرّح" };
  let newId: string;
  try {
    const created = await createCommittee(ctx, committeePayload(formData));
    newId = created.id;
  } catch (e) {
    return toFormState(e);
  }
  revalidatePath("/governance/committees");
  redirect(`/governance/committees/${newId}`);
}

export async function archiveCommitteeAction(_prev: CommitteeActionState, formData: FormData): Promise<CommitteeActionState> {
  const ctx = await getAccessContext();
  if (!ctx) return { error: "غير مصرّح" };
  const id = String(formData.get("committeeId") ?? "");
  try {
    await archiveCommittee(ctx, id);
  } catch (e) {
    return toActionState(e);
  }
  revalidatePath(`/governance/committees/${id}`);
  revalidatePath("/governance/committees");
  return { success: "تم تنفيذ الإجراء" };
}

export async function updateCommitteeAction(_prev: CommitteeFormState, formData: FormData): Promise<CommitteeFormState> {
  const ctx = await getAccessContext();
  if (!ctx) return { error: "غير مصرّح" };
  const id = String(formData.get("committeeId") ?? "");
  try {
    await updateCommittee(ctx, id, committeePayload(formData));
  } catch (e) {
    return toFormState(e);
  }
  revalidatePath(`/governance/committees/${id}`);
  redirect(`/governance/committees/${id}`);
}

// ── Members ──────────────────────────────────────────────────────────────

export async function addCommitteeMemberAction(_prev: CommitteeFormState, formData: FormData): Promise<CommitteeFormState> {
  const ctx = await getAccessContext();
  if (!ctx) return { error: "غير مصرّح" };
  const committeeId = String(formData.get("committeeId") ?? "");
  try {
    await addCommitteeMember(ctx, committeeId, {
      name: formData.get("name"),
      title: formData.get("title") || undefined,
      email: formData.get("email") || undefined,
      category: formData.get("category") || undefined,
    });
  } catch (e) {
    return toFormState(e);
  }
  revalidatePath(`/governance/committees/${committeeId}`);
  return {};
}

export async function updateCommitteeMemberAction(_prev: CommitteeFormState, formData: FormData): Promise<CommitteeFormState> {
  const ctx = await getAccessContext();
  if (!ctx) return { error: "غير مصرّح" };
  const memberId = String(formData.get("memberId") ?? "");
  const committeeId = String(formData.get("committeeId") ?? "");
  try {
    await updateCommitteeMember(ctx, memberId, {
      name: formData.get("name"),
      title: formData.get("title") || undefined,
      email: formData.get("email") || undefined,
      category: formData.get("category") || undefined,
    });
  } catch (e) {
    return toFormState(e);
  }
  revalidatePath(`/governance/committees/${committeeId}`);
  return {};
}

export async function endCommitteeMembershipAction(_prev: CommitteeActionState, formData: FormData): Promise<CommitteeActionState> {
  const ctx = await getAccessContext();
  if (!ctx) return { error: "غير مصرّح" };
  const memberId = String(formData.get("memberId") ?? "");
  const committeeId = String(formData.get("committeeId") ?? "");
  try {
    await endCommitteeMembership(ctx, memberId);
  } catch (e) {
    return toActionState(e);
  }
  revalidatePath(`/governance/committees/${committeeId}`);
  return { success: "تم إنهاء العضوية" };
}

// ── Meetings ─────────────────────────────────────────────────────────────

function meetingPayload(formData: FormData) {
  return {
    meetingDate: formData.get("meetingDate"),
    status: formData.get("status") || "SCHEDULED",
    agenda: formData.get("agenda") || undefined,
    topicsDiscussed: formData.get("topicsDiscussed") || undefined,
    decisionsAndRecommendations: formData.get("decisionsAndRecommendations") || undefined,
  };
}

export async function createCommitteeMeetingAction(_prev: CommitteeFormState, formData: FormData): Promise<CommitteeFormState> {
  const ctx = await getAccessContext();
  if (!ctx) return { error: "غير مصرّح" };
  const committeeId = String(formData.get("committeeId") ?? "");
  try {
    await createCommitteeMeeting(ctx, committeeId, meetingPayload(formData));
  } catch (e) {
    return toFormState(e);
  }
  revalidatePath(`/governance/committees/${committeeId}`);
  redirect(`/governance/committees/${committeeId}`);
}

export async function updateCommitteeMeetingAction(_prev: CommitteeFormState, formData: FormData): Promise<CommitteeFormState> {
  const ctx = await getAccessContext();
  if (!ctx) return { error: "غير مصرّح" };
  const meetingId = String(formData.get("meetingId") ?? "");
  const committeeId = String(formData.get("committeeId") ?? "");
  try {
    await updateCommitteeMeeting(ctx, meetingId, meetingPayload(formData));
  } catch (e) {
    return toFormState(e);
  }
  revalidatePath(`/governance/committees/${committeeId}`);
  redirect(`/governance/committees/${committeeId}`);
}

export async function archiveCommitteeMeetingAction(_prev: CommitteeActionState, formData: FormData): Promise<CommitteeActionState> {
  const ctx = await getAccessContext();
  if (!ctx) return { error: "غير مصرّح" };
  const meetingId = String(formData.get("meetingId") ?? "");
  const committeeId = String(formData.get("committeeId") ?? "");
  try {
    await archiveCommitteeMeeting(ctx, meetingId);
  } catch (e) {
    return toActionState(e);
  }
  revalidatePath(`/governance/committees/${committeeId}`);
  return { success: "تم تنفيذ الإجراء" };
}
