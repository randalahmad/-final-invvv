import { Badge } from "@/components/ui/badge";
import type { DgaRequirementStatus } from "../types";

const labels = { NOT_STARTED: "لم تبدأ", IN_PROGRESS: "قيد التنفيذ", AWAITING_EVIDENCE: "بانتظار الإثبات", COMPLETED: "مكتملة" } as const;
const variants = { NOT_STARTED: "neutral", IN_PROGRESS: "info", AWAITING_EVIDENCE: "warning", COMPLETED: "success" } as const;

export function RequirementStatusBadge({ status }: { status: DgaRequirementStatus }) {
  return <Badge variant={variants[status]}>{labels[status]}</Badge>;
}
