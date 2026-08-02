import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { requirePermission, getAccessContext } from "@/server/authz";
import { isAuthorizationError } from "@/server/authorization";
import { getChallenge, computeChallengeFlags } from "@/modules/challenges/service";
import { listSolutionsInScope } from "@/modules/solutions/service";
import { CHALLENGE_STATUS_LABELS } from "@/modules/challenges/schema";
import { ChallengeActionBar } from "@/modules/challenges/components/challenge-actions";
import { LinkedSolutionsList, LinkSolutionForm } from "@/modules/challenges/components/solution-link-panel";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "تفاصيل التحدي" };

const STATUS_VARIANT: Record<string, "success" | "neutral" | "warning" | "primary" | "danger"> = {
  NEW: "neutral",
  UNDER_REVIEW: "warning",
  SOLUTION_PROPOSED: "primary",
  IN_PROGRESS: "warning",
  RESOLVED: "success",
  CLOSED_WITHOUT_SOLUTION: "danger",
};

export default async function ChallengeDetailPage({ params }: { params: { id: string } }) {
  await requirePermission("challenge.view");
  const ctx = (await getAccessContext())!;

  let challenge;
  try {
    challenge = await getChallenge(ctx, params.id);
  } catch (e) {
    if (isAuthorizationError(e) && (e.code === "NOT_FOUND" || e.code === "OUT_OF_SCOPE")) notFound();
    throw e;
  }

  const flags = computeChallengeFlags(ctx, { archivedAt: challenge.archivedAt, departmentId: challenge.departmentId });
  const linkedIds = new Set(challenge.solutions.map((s: { solutionId: string }) => s.solutionId));

  const solutionOptions = flags.canLinkSolution
    ? (await listSolutionsInScope(ctx, {}))
        .filter((s: { id: string }) => !linkedIds.has(s.id))
        .map((s: { id: string; nameAr: string }) => ({ id: s.id, nameAr: s.nameAr }))
    : [];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/challenges" className="inline-flex items-center gap-1 text-[12.5px] text-muted hover:text-primary">
            <ArrowRight className="h-3.5 w-3.5" />
            العودة إلى إدارة التحديات
          </Link>
          <h1 className="mt-2 text-lg font-bold text-slate-800 dark:text-slate-100">{challenge.titleAr}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant={STATUS_VARIANT[challenge.status] ?? "neutral"}>{CHALLENGE_STATUS_LABELS[challenge.status] ?? challenge.status}</Badge>
            {challenge.category && <Badge variant="neutral">{challenge.category}</Badge>}
            {challenge.archivedAt && <Badge variant="neutral">مؤرشف</Badge>}
          </div>
        </div>
        <ChallengeActionBar challengeId={challenge.id} status={challenge.status} flags={flags} />
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <div className="flex flex-col gap-1">
            <dt className="text-[11.5px] text-muted">الإدارة المالكة</dt>
            <dd className="text-[13.5px] text-slate-800 dark:text-slate-100">{challenge.department?.nameAr ?? "—"}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-[11.5px] text-muted">وصف التحدي</dt>
            <dd className="text-[13.5px] text-slate-800 dark:text-slate-100">{challenge.description ?? "—"}</dd>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-4 px-5 py-4">
          <h2 className="text-[13.5px] font-bold text-slate-800 dark:text-slate-100">الحلول المقترحة لهذا التحدي</h2>
          <LinkedSolutionsList
            challengeId={challenge.id}
            solutions={challenge.solutions.map((s: { solutionId: string; solution: { nameAr: string; maturityStage: string; implementationStatus: string } }) => ({
              solutionId: s.solutionId,
              nameAr: s.solution.nameAr,
              maturityStage: s.solution.maturityStage,
              implementationStatus: s.solution.implementationStatus,
            }))}
            canManage={flags.canLinkSolution}
          />
          {flags.canLinkSolution && solutionOptions.length > 0 && <LinkSolutionForm challengeId={challenge.id} options={solutionOptions} />}
        </CardContent>
      </Card>
    </div>
  );
}
