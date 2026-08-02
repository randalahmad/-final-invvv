import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { requirePermission, getAccessContext } from "@/server/authz";
import { isAuthorizationError } from "@/server/authorization";
import { getChallenge, listOwnableDepartments } from "@/modules/challenges/service";
import { ChallengeForm } from "@/modules/challenges/components/challenge-form";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "تعديل التحدي" };

export default async function EditChallengePage({ params }: { params: { id: string } }) {
  await requirePermission("challenge.update");
  const ctx = (await getAccessContext())!;

  let challenge;
  try {
    challenge = await getChallenge(ctx, params.id);
  } catch (e) {
    if (isAuthorizationError(e) && (e.code === "NOT_FOUND" || e.code === "OUT_OF_SCOPE")) notFound();
    throw e;
  }
  if (challenge.archivedAt) notFound();

  const departments = await listOwnableDepartments(ctx);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href={`/challenges/${challenge.id}`} className="inline-flex items-center gap-1 text-[12.5px] text-muted hover:text-primary">
          <ArrowRight className="h-3.5 w-3.5" />
          العودة إلى التفاصيل
        </Link>
        <h1 className="mt-2 text-lg font-bold text-slate-800 dark:text-slate-100">تعديل التحدي</h1>
      </div>
      <Card>
        <CardContent className="pt-6">
          <ChallengeForm
            mode="edit"
            departments={departments.map((d: { id: string; nameAr: string }) => ({ id: d.id, label: d.nameAr }))}
            initial={{
              challengeId: challenge.id,
              titleAr: challenge.titleAr,
              description: challenge.description,
              departmentId: challenge.departmentId,
              category: challenge.category,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
