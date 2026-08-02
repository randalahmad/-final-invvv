import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { requirePermission, getAccessContext } from "@/server/authz";
import { listOwnableOrganizations } from "@/modules/committees/service";
import { CommitteeForm } from "@/modules/committees/components/committee-form";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "تشكيل لجنة جديدة" };

export default async function NewCommitteePage() {
  await requirePermission("committee.manage");
  const ctx = (await getAccessContext())!;
  const organizations = await listOwnableOrganizations(ctx);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href="/governance/committees" className="inline-flex items-center gap-1 text-[12.5px] text-muted hover:text-primary">
          <ArrowRight className="h-3.5 w-3.5" />
          العودة إلى لجان الحوكمة
        </Link>
        <h1 className="mt-2 text-lg font-bold text-slate-800 dark:text-slate-100">تشكيل لجنة جديدة</h1>
      </div>
      <Card>
        <CardContent className="pt-6">
          <CommitteeForm mode="create" organizations={organizations.map((o: { id: string; nameAr: string }) => ({ id: o.id, label: o.nameAr }))} />
        </CardContent>
      </Card>
    </div>
  );
}
