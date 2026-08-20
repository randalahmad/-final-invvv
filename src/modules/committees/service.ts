import type { Prisma } from "@prisma/client";

import { prisma } from "@/server/db";
import { writeAudit, AUDIT } from "@/server/audit";
import type { AccessContext } from "@/server/access-context";
import { requirePermission, effectiveScopes, AuthorizationError } from "@/server/authorization";
import { committeeSchema, committeeMemberSchema, committeeMeetingSchema } from "./schema";

const VIEW = "committee.view" as const;
const MANAGE = "committee.manage" as const;
const MEETING_MANAGE = "committee.meeting.manage" as const;

export type CommitteeErrorCode = "VALIDATION" | "NOT_FOUND" | "BAD_REFERENCE" | "ALREADY_ARCHIVED";
export class CommitteeError extends Error {
  code: CommitteeErrorCode;
  fieldErrors?: Record<string, string[]>;
  constructor(code: CommitteeErrorCode, message?: string, fieldErrors?: Record<string, string[]>) {
    super(message ?? code);
    this.name = "CommitteeError";
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

function committeeScopeWhere(ctx: AccessContext): Prisma.CommitteeWhereInput {
  const es = effectiveScopes(ctx);
  if (es.platform) return {};
  if (es.organizationIds.length) return { organizationId: { in: es.organizationIds } };
  return { id: "__none__" };
}

async function loadCommitteeInScope(actor: AccessContext, committeeId: string) {
  requirePermission(actor, VIEW);
  const committee = await prisma.committee.findUnique({
    where: { id: committeeId },
    select: { id: true, status: true, organizationId: true, archivedAt: true },
  });
  if (!committee) throw new CommitteeError("NOT_FOUND", "اللجنة غير موجودة");
  const es = effectiveScopes(actor);
  const inScope = es.platform || es.organizationIds.includes(committee.organizationId);
  if (!inScope) throw new AuthorizationError("OUT_OF_SCOPE");
  return committee;
}

export async function listOwnableOrganizations(actor: AccessContext) {
  const es = effectiveScopes(actor);
  if (es.platform) return prisma.organization.findMany({ orderBy: { nameAr: "asc" }, select: { id: true, nameAr: true } });
  if (!es.organizationIds.length) return [];
  return prisma.organization.findMany({
    where: { id: { in: es.organizationIds } },
    orderBy: { nameAr: "asc" },
    select: { id: true, nameAr: true },
  });
}

// ── Committee ────────────────────────────────────────────────────────────

export async function createCommittee(actor: AccessContext, raw: unknown): Promise<{ id: string }> {
  requirePermission(actor, MANAGE);
  const parsed = committeeSchema.safeParse(raw);
  if (!parsed.success) throw new CommitteeError("VALIDATION", "invalid", parsed.error.flatten().fieldErrors);
  const input = parsed.data;

  const org = await prisma.organization.findUnique({ where: { id: input.organizationId }, select: { id: true } });
  if (!org) throw new CommitteeError("BAD_REFERENCE", "الجهة/المنظمة المحددة غير موجودة");

  return prisma.$transaction(async (tx) => {
    const created = await tx.committee.create({ data: { ...input, status: "PROPOSED" }, select: { id: true } });
    await writeAudit(
      {
        actorUserId: actor.userId,
        action: AUDIT.COMMITTEE_CREATED,
        entityType: "COMMITTEE",
        entityId: created.id,
        summary: "تشكيل وحدة/لجنة ابتكار",
        after: { nameAr: input.nameAr, organizationId: input.organizationId, type: input.type },
      },
      tx,
    );
    if (input.decisionNumber || input.decisionDate) {
      await writeAudit(
        {
          actorUserId: actor.userId,
          action: AUDIT.COMMITTEE_DECISION_RECORDED,
          entityType: "COMMITTEE",
          entityId: created.id,
          summary: "توثيق قرار تشكيل",
          after: { decisionNumber: input.decisionNumber, decisionDate: input.decisionDate },
        },
        tx,
      );
    }
    return created;
  });
}

export async function updateCommittee(actor: AccessContext, committeeId: string, raw: unknown): Promise<void> {
  const current = await loadCommitteeInScope(actor, committeeId);
  requirePermission(actor, MANAGE);
  if (current.archivedAt) throw new CommitteeError("ALREADY_ARCHIVED", "لا يمكن تعديل لجنة مؤرشفة");
  const before = await prisma.committee.findUnique({ where: { id: committeeId }, select: { decisionNumber: true, decisionDate: true } });

  const parsed = committeeSchema.safeParse(raw);
  if (!parsed.success) throw new CommitteeError("VALIDATION", "invalid", parsed.error.flatten().fieldErrors);
  const input = parsed.data;

  const org = await prisma.organization.findUnique({ where: { id: input.organizationId }, select: { id: true } });
  if (!org) throw new CommitteeError("BAD_REFERENCE", "الجهة/المنظمة المحددة غير موجودة");

  await prisma.$transaction(async (tx) => {
    await tx.committee.update({ where: { id: committeeId }, data: input });
    await writeAudit(
      {
        actorUserId: actor.userId,
        action: AUDIT.COMMITTEE_UPDATED,
        entityType: "COMMITTEE",
        entityId: committeeId,
        summary: "تحديث بيانات وحدة/لجنة",
        after: { nameAr: input.nameAr },
      },
      tx,
    );
    const decisionChanged = before && (before.decisionNumber !== (input.decisionNumber ?? null) || before.decisionDate?.toISOString() !== (input.decisionDate?.toISOString() ?? null));
    if (decisionChanged && (input.decisionNumber || input.decisionDate)) {
      await writeAudit(
        {
          actorUserId: actor.userId,
          action: AUDIT.COMMITTEE_DECISION_RECORDED,
          entityType: "COMMITTEE",
          entityId: committeeId,
          summary: "تحديث قرار التشكيل",
          before: { decisionNumber: before?.decisionNumber ?? null, decisionDate: before?.decisionDate ?? null },
          after: { decisionNumber: input.decisionNumber, decisionDate: input.decisionDate },
        },
        tx,
      );
    }
  });
}

export async function archiveCommittee(actor: AccessContext, committeeId: string): Promise<void> {
  const current = await loadCommitteeInScope(actor, committeeId);
  requirePermission(actor, MANAGE);
  if (current.archivedAt) throw new CommitteeError("ALREADY_ARCHIVED", "اللجنة مؤرشفة بالفعل");

  await prisma.$transaction(async (tx) => {
    await tx.committee.update({ where: { id: committeeId }, data: { archivedAt: new Date(), archivedById: actor.userId } });
    await writeAudit(
      {
        actorUserId: actor.userId,
        action: AUDIT.COMMITTEE_ARCHIVED,
        entityType: "COMMITTEE",
        entityId: committeeId,
        summary: "أرشفة لجنة حوكمة",
      },
      tx,
    );
  });
}

export interface CommitteeListRow {
  id: string;
  nameAr: string;
  category: string | null;
  organizationName: string | null;
  status: string;
  memberCount: number;
  meetingCount: number;
  updatedAt: Date;
}

export async function listCommitteesInScope(actor: AccessContext, opts?: { includeArchived?: boolean; q?: string }): Promise<CommitteeListRow[]> {
  requirePermission(actor, VIEW);
  const scope = committeeScopeWhere(actor);
  const and: Prisma.CommitteeWhereInput[] = [scope];
  if (!opts?.includeArchived) and.push({ archivedAt: null });
  if (opts?.q?.trim()) and.push({ nameAr: { contains: opts.q.trim(), mode: "insensitive" } });

  const rows = await prisma.committee.findMany({
    where: { AND: and },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      nameAr: true,
      category: true,
      status: true,
      updatedAt: true,
      organization: { select: { nameAr: true } },
      _count: { select: { members: true, meetings: true } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    nameAr: r.nameAr,
    category: r.category,
    organizationName: r.organization?.nameAr ?? null,
    status: r.status,
    memberCount: r._count.members,
    meetingCount: r._count.meetings,
    updatedAt: r.updatedAt,
  }));
}

export async function getCommittee(actor: AccessContext, committeeId: string) {
  await loadCommitteeInScope(actor, committeeId);
  return prisma.committee.findUniqueOrThrow({
    where: { id: committeeId },
    include: {
      organization: { select: { id: true, nameAr: true } },
      members: { orderBy: { joinedAt: "asc" } },
      meetings: { orderBy: { sequenceNumber: "asc" } },
    },
  });
}

export function computeCommitteeFlags(actor: AccessContext, committee: { archivedAt: Date | null }) {
  const canManage = actor.permissions.has(MANAGE);
  const canManageMeetings = actor.permissions.has(MEETING_MANAGE);
  return {
    canEdit: canManage && !committee.archivedAt,
    canArchive: canManage && !committee.archivedAt,
    canManageMembers: canManage && !committee.archivedAt,
    canManageMeetings: canManageMeetings && !committee.archivedAt,
  };
}

// ── CommitteeMember ──────────────────────────────────────────────────────

export async function addCommitteeMember(actor: AccessContext, committeeId: string, raw: unknown): Promise<{ id: string }> {
  const committee = await loadCommitteeInScope(actor, committeeId);
  requirePermission(actor, MANAGE);
  if (committee.archivedAt) throw new CommitteeError("ALREADY_ARCHIVED", "لا يمكن إضافة أعضاء للجنة مؤرشفة");

  const parsed = committeeMemberSchema.safeParse(raw);
  if (!parsed.success) throw new CommitteeError("VALIDATION", "invalid", parsed.error.flatten().fieldErrors);
  const input = parsed.data;

  return prisma.$transaction(async (tx) => {
    const created = await tx.committeeMember.create({ data: { ...input, committeeId }, select: { id: true } });
    await writeAudit(
      {
        actorUserId: actor.userId,
        action: AUDIT.COMMITTEE_MEMBER_ADDED,
        entityType: "COMMITTEE",
        entityId: committeeId,
        summary: "إضافة عضو للجنة",
        after: { memberId: created.id, name: input.name },
      },
      tx,
    );
    return created;
  });
}

export async function updateCommitteeMember(actor: AccessContext, memberId: string, raw: unknown): Promise<void> {
  const member = await prisma.committeeMember.findUnique({
    where: { id: memberId },
    select: { id: true, committeeId: true, leftAt: true, roleInCommittee: true },
  });
  if (!member) throw new CommitteeError("NOT_FOUND", "العضو غير موجود");
  const committee = await loadCommitteeInScope(actor, member.committeeId);
  requirePermission(actor, MANAGE);
  if (committee.archivedAt) throw new CommitteeError("ALREADY_ARCHIVED", "اللجنة مؤرشفة");
  if (member.leftAt) throw new CommitteeError("ALREADY_ARCHIVED", "انتهت عضوية هذا العضو بالفعل");

  const parsed = committeeMemberSchema.safeParse(raw);
  if (!parsed.success) throw new CommitteeError("VALIDATION", "invalid", parsed.error.flatten().fieldErrors);
  const input = parsed.data;
  const roleChanged = (input.roleInCommittee ?? null) !== (member.roleInCommittee ?? null);

  await prisma.$transaction(async (tx) => {
    await tx.committeeMember.update({ where: { id: memberId }, data: input });
    await writeAudit(
      {
        actorUserId: actor.userId,
        action: AUDIT.COMMITTEE_MEMBER_UPDATED,
        entityType: "COMMITTEE",
        entityId: member.committeeId,
        summary: "تحديث بيانات عضو لجنة",
        after: { memberId, name: input.name },
      },
      tx,
    );
    if (roleChanged) {
      await writeAudit(
        {
          actorUserId: actor.userId,
          action: AUDIT.COMMITTEE_MEMBER_ROLE_UPDATED,
          entityType: "COMMITTEE",
          entityId: member.committeeId,
          summary: "تغيير دور عضو داخل اللجنة",
          before: { roleInCommittee: member.roleInCommittee },
          after: { memberId, roleInCommittee: input.roleInCommittee },
        },
        tx,
      );
    }
  });
}

export async function endCommitteeMembership(actor: AccessContext, memberId: string): Promise<void> {
  const member = await prisma.committeeMember.findUnique({
    where: { id: memberId },
    select: { id: true, committeeId: true, leftAt: true },
  });
  if (!member) throw new CommitteeError("NOT_FOUND", "العضو غير موجود");
  const committee = await loadCommitteeInScope(actor, member.committeeId);
  requirePermission(actor, MANAGE);
  if (committee.archivedAt) throw new CommitteeError("ALREADY_ARCHIVED", "اللجنة مؤرشفة");
  if (member.leftAt) throw new CommitteeError("ALREADY_ARCHIVED", "انتهت عضوية هذا العضو بالفعل");

  await prisma.$transaction(async (tx) => {
    await tx.committeeMember.update({ where: { id: memberId }, data: { leftAt: new Date(), status: "ENDED" } });
    await writeAudit(
      {
        actorUserId: actor.userId,
        action: AUDIT.COMMITTEE_MEMBER_REMOVED,
        entityType: "COMMITTEE",
        entityId: member.committeeId,
        summary: "إنهاء/أرشفة عضوية في وحدة/لجنة",
        after: { memberId },
      },
      tx,
    );
  });
}

// ── CommitteeMeeting ─────────────────────────────────────────────────────

/**
 * Business rule (not a DB constraint, per the frozen design): the first
 * meeting is what activates a PROPOSED committee. Sequence numbers are
 * computed from the max existing number (including archived meetings) so a
 * number is never reused.
 */
export async function createCommitteeMeeting(actor: AccessContext, committeeId: string, raw: unknown): Promise<{ id: string }> {
  const committee = await loadCommitteeInScope(actor, committeeId);
  requirePermission(actor, MEETING_MANAGE);
  if (committee.archivedAt) throw new CommitteeError("ALREADY_ARCHIVED", "لا يمكن توثيق اجتماع للجنة مؤرشفة");

  const parsed = committeeMeetingSchema.safeParse(raw);
  if (!parsed.success) throw new CommitteeError("VALIDATION", "invalid", parsed.error.flatten().fieldErrors);
  const input = parsed.data;

  return prisma.$transaction(async (tx) => {
    const last = await tx.committeeMeeting.findFirst({
      where: { committeeId },
      orderBy: { sequenceNumber: "desc" },
      select: { sequenceNumber: true },
    });
    const sequenceNumber = (last?.sequenceNumber ?? 0) + 1;

    const created = await tx.committeeMeeting.create({
      data: { ...input, committeeId, sequenceNumber },
      select: { id: true },
    });

    // First-meeting-mandatory rule: a HELD meeting #1 activates the committee.
    if (sequenceNumber === 1 && input.status === "HELD" && committee.status === "PROPOSED") {
      await tx.committee.update({ where: { id: committeeId }, data: { status: "ACTIVE" } });
    }

    await writeAudit(
      {
        actorUserId: actor.userId,
        action: AUDIT.COMMITTEE_MEETING_CREATED,
        entityType: "COMMITTEE_MEETING",
        entityId: created.id,
        summary: `توثيق اجتماع رقم ${sequenceNumber} للجنة`,
        after: { committeeId, sequenceNumber, status: input.status },
      },
      tx,
    );
    return created;
  });
}

export async function updateCommitteeMeeting(actor: AccessContext, meetingId: string, raw: unknown): Promise<void> {
  const meeting = await prisma.committeeMeeting.findUnique({
    where: { id: meetingId },
    select: { id: true, committeeId: true, sequenceNumber: true, archivedAt: true },
  });
  if (!meeting) throw new CommitteeError("NOT_FOUND", "الاجتماع غير موجود");
  const committee = await loadCommitteeInScope(actor, meeting.committeeId);
  requirePermission(actor, MEETING_MANAGE);
  if (meeting.archivedAt) throw new CommitteeError("ALREADY_ARCHIVED", "لا يمكن تعديل اجتماع مؤرشف");

  const parsed = committeeMeetingSchema.safeParse(raw);
  if (!parsed.success) throw new CommitteeError("VALIDATION", "invalid", parsed.error.flatten().fieldErrors);
  const input = parsed.data;

  await prisma.$transaction(async (tx) => {
    await tx.committeeMeeting.update({ where: { id: meetingId }, data: input });
    if (meeting.sequenceNumber === 1 && input.status === "HELD" && committee.status === "PROPOSED") {
      await tx.committee.update({ where: { id: meeting.committeeId }, data: { status: "ACTIVE" } });
    }
    await writeAudit(
      {
        actorUserId: actor.userId,
        action: AUDIT.COMMITTEE_MEETING_UPDATED,
        entityType: "COMMITTEE_MEETING",
        entityId: meetingId,
        summary: "تحديث بيانات اجتماع لجنة",
        after: { status: input.status },
      },
      tx,
    );
  });
}

export async function archiveCommitteeMeeting(actor: AccessContext, meetingId: string): Promise<void> {
  const meeting = await prisma.committeeMeeting.findUnique({
    where: { id: meetingId },
    select: { id: true, committeeId: true, archivedAt: true },
  });
  if (!meeting) throw new CommitteeError("NOT_FOUND", "الاجتماع غير موجود");
  await loadCommitteeInScope(actor, meeting.committeeId);
  requirePermission(actor, MEETING_MANAGE);
  if (meeting.archivedAt) throw new CommitteeError("ALREADY_ARCHIVED", "الاجتماع مؤرشف بالفعل");

  await prisma.$transaction(async (tx) => {
    await tx.committeeMeeting.update({ where: { id: meetingId }, data: { archivedAt: new Date(), archivedById: actor.userId } });
    await writeAudit(
      {
        actorUserId: actor.userId,
        action: AUDIT.COMMITTEE_MEETING_ARCHIVED,
        entityType: "COMMITTEE_MEETING",
        entityId: meetingId,
        summary: "أرشفة اجتماع لجنة (الرقم التسلسلي لا يُعاد استخدامه)",
      },
      tx,
    );
  });
}

/** Active vs. total (non-archived) committees in scope — used by the compliance overview screen (5.23.3). */
export interface CommitteeReadiness {
  active: number;
  total: number;
}
export async function getCommitteeReadiness(actor: AccessContext): Promise<CommitteeReadiness> {
  requirePermission(actor, VIEW);
  const scope = committeeScopeWhere(actor);
  const [active, total] = await Promise.all([
    prisma.committee.count({ where: { AND: [scope, { archivedAt: null, status: "ACTIVE" }] } }),
    prisma.committee.count({ where: { AND: [scope, { archivedAt: null }] } }),
  ]);
  return { active, total };
}
