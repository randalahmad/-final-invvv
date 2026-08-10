import { prisma } from "@/server/db";
import type { AccessContext } from "@/server/access-context";
import { requirePermission } from "@/server/authorization";

const VIEW = "audit.view" as const;

export interface AuditLogRow {
  id: string;
  actorName: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  summary: string | null;
  createdAt: Date;
}

/** Most recent audit entries, platform-wide — SYSTEM_ADMIN only (audit.view). No department scoping: the audit trail is a platform-level governance record.
 * entityTypes/entityIds (optional) scope the log to specific records — used by the per-requirement Audit Trail card so it reuses this exact service instead of a parallel query. */
export async function listAuditLog(actor: AccessContext, opts?: { q?: string; action?: string; entityTypes?: string[]; entityIds?: string[] }): Promise<AuditLogRow[]> {
  requirePermission(actor, VIEW);
  const rows = await prisma.auditLog.findMany({
    where: {
      ...(opts?.action ? { action: opts.action } : {}),
      ...(opts?.q?.trim() ? { summary: { contains: opts.q.trim(), mode: "insensitive" } } : {}),
      ...(opts?.entityTypes?.length ? { entityType: { in: opts.entityTypes } } : {}),
      ...(opts?.entityIds?.length ? { entityId: { in: opts.entityIds } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      action: true,
      entityType: true,
      entityId: true,
      summary: true,
      createdAt: true,
      actor: { select: { name: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    actorName: r.actor?.name ?? null,
    action: r.action,
    entityType: r.entityType,
    entityId: r.entityId,
    summary: r.summary,
    createdAt: r.createdAt,
  }));
}

/** Distinct action values currently in the log — used to populate the filter dropdown from real data (no hardcoded list). */
export async function listDistinctAuditActions(actor: AccessContext): Promise<string[]> {
  requirePermission(actor, VIEW);
  const rows = await prisma.auditLog.findMany({ distinct: ["action"], select: { action: true }, orderBy: { action: "asc" } });
  return rows.map((r) => r.action);
}
