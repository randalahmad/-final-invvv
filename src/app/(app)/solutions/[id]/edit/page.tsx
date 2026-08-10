import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { requirePermission, getAccessContext } from "@/server/authz";
import { isAuthorizationError } from "@/server/authorization";
import { prisma } from "@/server/db";
import { getSolutionById, listOwnableDepartments } from "@/modules/solutions/service";
import { SolutionForm } from "@/modules/solutions/components/solution-form";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "تعديل الحل" };

const day = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : null);

export default async function EditSolutionPage({ params }: { params: { id: string } }) {
  await requirePermission("solution.update");
  const ctx = (await getAccessContext())!;

  let solution;
  try {
    solution = await getSolutionById(ctx, params.id);
  } catch (e) {
    if (isAuthorizationError(e) && (e.code === "NOT_FOUND" || e.code === "OUT_OF_SCOPE")) notFound();
    throw e;
  }
  // Only DRAFT solutions are freely editable.
  if (solution.status !== "DRAFT") notFound();

  const [departments, activities, objectives, owners] = await Promise.all([
    listOwnableDepartments(ctx),
    prisma.innovationActivity.findMany({ orderBy: { nameAr: "asc" }, select: { id: true, nameAr: true } }),
    prisma.strategicObjective.findMany({ orderBy: { titleAr: "asc" }, select: { id: true, titleAr: true } }),
    prisma.user.findMany({
      where: { status: "ACTIVE", registrationStatus: "APPROVED" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href={`/solutions/${solution.id}`} className="inline-flex items-center gap-1 text-[12.5px] text-muted hover:text-primary">
          <ArrowRight className="h-3.5 w-3.5" />
          العودة إلى التفاصيل
        </Link>
        <h1 className="mt-2 text-lg font-bold text-slate-800 dark:text-slate-100">تعديل مسودة الحل</h1>
      </div>

      <Card>
        <CardContent className="pt-6">
          <SolutionForm
            mode="edit"
            departments={departments.map((d) => ({ id: d.id, label: d.nameAr }))}
            activities={activities.map((a) => ({ id: a.id, label: a.nameAr }))}
            objectives={objectives.map((o) => ({ id: o.id, label: o.titleAr }))}
            owners={owners.map((u) => ({ id: u.id, label: u.name }))}
            initial={{
              solutionId: solution.id,
              nameAr: solution.nameAr,
              description: solution.description,
              problemStatement: solution.problemStatement,
              owningDepartmentId: solution.owningDepartmentId,
              source: solution.source,
              activityId: solution.activityId,
              ownerUserId: solution.ownerUserId,
              strategicObjectiveId: solution.strategicObjectiveId,
              maturityStage: solution.maturityStage,
              implementationStatus: solution.implementationStatus,
              startDate: day(solution.startDate),
              targetEndDate: day(solution.targetEndDate),
              actualEndDate: day(solution.actualEndDate),
              durationMonths: solution.durationMonths,
              cost: solution.cost ? String(solution.cost) : null,
              targetBeneficiaries: solution.targetBeneficiaries,
              technologies: solution.technologies,
              risks: solution.risks,
              notes: solution.notes,
              launchDate: day(solution.launchDate),
              beneficiaryCount: solution.beneficiaryCount,
              achievedOrExpectedImpact: solution.achievedOrExpectedImpact,
              beneficiarySatisfactionPct: solution.beneficiarySatisfactionPct,
              previouslySubmittedForMeasurement: solution.previouslySubmittedForMeasurement,
              significantChangeNote: solution.significantChangeNote,
              innovationMethodologySource: solution.innovationMethodologySource,
              digitalTransformationPlanLink: solution.digitalTransformationPlanLink,
              isSustained: solution.isSustained,
              sustainabilityOwner: solution.sustainabilityOwner,
              sustainabilityPlan: solution.sustainabilityPlan,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
