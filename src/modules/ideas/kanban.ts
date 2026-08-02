import type { IdeaStatus } from "@prisma/client";

import { prisma } from "@/server/db";
import type { AccessContext } from "@/server/access-context";
import { requirePermission, ideaScopeWhere } from "@/server/authorization";

/** Governance board columns (the approved workflow states). */
export const KANBAN_COLUMNS: { status: IdeaStatus; label: string }[] = [
  { status: "SUBMITTED", label: "مُقدّمة" },
  { status: "INITIAL_REVIEW", label: "مراجعة أولية" },
  { status: "TECHNICAL_REVIEW", label: "مراجعة فنية" },
  { status: "MORE_INFO_REQUESTED", label: "بانتظار معلومات" },
  { status: "APPROVED_FOR_PILOT", label: "معتمدة للتجريب" },
  { status: "REJECTED", label: "مرفوضة" },
  { status: "CONVERTED_TO_SOLUTION", label: "محوّلة إلى حل" },
];

const BOARD_STATUSES = KANBAN_COLUMNS.map((c) => c.status);

export interface KanbanCard {
  id: string;
  titleAr: string;
  status: IdeaStatus;
  departmentName: string | null;
  authorName: string | null;
  updatedAt: Date;
}

/**
 * Persisted, scope-filtered Kanban data. Reads real Idea rows through the
 * server-side scope filter — no mock data. DRAFT/WITHDRAWN/ARCHIVED are
 * outside the active governance board.
 */
export async function listKanbanIdeas(actor: AccessContext): Promise<Record<string, KanbanCard[]>> {
  requirePermission(actor, "idea.view");
  const rows = await prisma.idea.findMany({
    where: { AND: [ideaScopeWhere(actor), { status: { in: BOARD_STATUSES } }] },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      titleAr: true,
      status: true,
      updatedAt: true,
      department: { select: { nameAr: true } },
      submittedBy: { select: { name: true } },
    },
  });

  const grouped: Record<string, KanbanCard[]> = {};
  for (const col of BOARD_STATUSES) grouped[col] = [];
  for (const r of rows) {
    grouped[r.status]?.push({
      id: r.id,
      titleAr: r.titleAr,
      status: r.status,
      departmentName: r.department?.nameAr ?? null,
      authorName: r.submittedBy?.name ?? null,
      updatedAt: r.updatedAt,
    });
  }
  return grouped;
}
