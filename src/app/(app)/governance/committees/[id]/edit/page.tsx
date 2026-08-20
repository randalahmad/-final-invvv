import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { requirePermission, getAccessContext } from "@/server/authz";
import { isAuthorizationError } from "@/server/authorization";
import { getCommittee, listOwnableOrganizations } from "@/modules/committees/service";
import { CommitteeForm } from "@/modules/committees/components/committee-form";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "تعديل اللجنة" };

const day = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : "");

export default async function EditCommitteePage({ params }: { params: { id: string } }) {
  await requirePermission("committee.manage");
  const ctx = (await getAccessContext())!;

  let committee;
  try {
    committee = await getCommittee(ctx, params.id);
  } catch (e) {
    if (isAuthorizationError(e) && (e.code === "NOT_FOUND" || e.code === "OUT_OF_SCOPE")) notFound();
    throw e;
  }
  if (committee.archivedAt) notFound();

  const organizations = await listOwnableOrganizations(ctx);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href={`/governance/committees/${committee.id}`} className="inline-flex items-center gap-1 text-[12.5px] text-muted hover:text-primary">
          <ArrowRight className="h-3.5 w-3.5" />
          العودة إلى التفاصيل
        </Link>
        <h1 className="mt-2 text-lg font-bold text-slate-800 dark:text-slate-100">تعديل اللجنة</h1>
      </div>
      <Card>
        <CardContent className="pt-6">
          <CommitteeForm
            mode="edit"
            organizations={organizations.map((o: { id: string; nameAr: string }) => ({ id: o.id, label: o.nameAr }))}
            initial={{
              committeeId: committee.id,
              nameAr: committee.nameAr,
              category: committee.category,
              type: committee.type,
              purpose: committee.purpose,
              organizationId: committee.organizationId,
              decisionNumber: committee.decisionNumber,
              decisionDate: day(committee.decisionDate),
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
