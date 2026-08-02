import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { requirePermission, getAccessContext } from "@/server/authz";
import { listOwnableDepartments } from "@/modules/challenges/service";
import { ChallengeForm } from "@/modules/challenges/components/challenge-form";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "تسجيل تحدٍّ جديد" };

export default async function NewChallengePage() {
  await requirePermission("challenge.create");
  const ctx = (await getAccessContext())!;
  const departments = await listOwnableDepartments(ctx);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href="/challenges" className="inline-flex items-center gap-1 text-[12.5px] text-muted hover:text-primary">
          <ArrowRight className="h-3.5 w-3.5" />
          العودة إلى إدارة التحديات
        </Link>
        <h1 className="mt-2 text-lg font-bold text-slate-800 dark:text-slate-100">تسجيل تحدٍّ جديد</h1>
      </div>
      <Card>
        <CardContent className="pt-6">
          <ChallengeForm mode="create" departments={departments.map((d: { id: string; nameAr: string }) => ({ id: d.id, label: d.nameAr }))} />
        </CardContent>
      </Card>
    </div>
  );
}
