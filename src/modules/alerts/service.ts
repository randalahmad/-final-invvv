import { prisma } from "@/server/db";
import type { AccessContext } from "@/server/access-context";
import { requirePermission, effectiveScopes } from "@/server/authorization";
import type { AlertItemData } from "./types";

const VIEW = "alert.view" as const;

const ALERT_TYPE_LABELS: Record<string, string> = {
  MEETING_OVERDUE: "اجتماع متأخر",
  MEETING_UPCOMING: "اجتماع قادم",
  AGREEMENT_EXPIRY: "انتهاء اتفاقية",
  AGREEMENT_RENEWAL: "تجديد اتفاقية",
  MISSING_EVIDENCE: "شواهد ناقصة",
  INCOMPLETE_SOLUTION: "بيانات حل ناقصة",
  IMPACT_WINDOW: "نافذة قياس أثر",
  EVALUATION_DEADLINE: "موعد تقييم",
  APPROVAL_TASK: "مهمة اعتماد",
};

/**
 * Alerts visible to the caller: platform-scope actors (SYSTEM_ADMIN) see all
 * open/acknowledged alerts; everyone else sees only alerts assigned to them.
 * `Alert` has no direct department/organization column (it targets an
 * arbitrary entity via entityType/entityId), so per-department scoping
 * would require resolving each entity's owner — not needed for this: no
 * alert-generation logic exists yet anywhere in the codebase, so this is a
 * correct, honest scoping rule for whatever alerts do get created.
 */
export async function listAlertsInScope(actor: AccessContext): Promise<AlertItemData[]> {
  requirePermission(actor, VIEW);
  const es = effectiveScopes(actor);

  const rows = await prisma.alert.findMany({
    where: {
      status: { in: ["OPEN", "ACKNOWLEDGED"] },
      ...(es.platform ? {} : { assignedToUserId: actor.userId }),
    },
    orderBy: [{ severity: "desc" }, { openedAt: "desc" }],
    select: { id: true, type: true, severity: true, title: true, message: true, source: true, dueDate: true },
  });

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    detail: r.message ?? "—",
    tag: ALERT_TYPE_LABELS[r.type] ?? r.type,
    severity: r.severity === "CRITICAL" ? "urgent" : "reminder",
  }));
}
