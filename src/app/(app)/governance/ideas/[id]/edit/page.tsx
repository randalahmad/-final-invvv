import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { requirePermission, getAccessContext } from "@/server/authz";
import { isAuthorizationError } from "@/server/authorization";
import { prisma } from "@/server/db";
import { getIdeaById, listOwnableDepartments } from "@/modules/ideas/service";
import { IdeaForm } from "@/modules/ideas/components/idea-form";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "تعديل الفكرة" };

export default async function EditIdeaPage({ params }: { params: { id: string } }) {
  await requirePermission("idea.view");
  const ctx = (await getAccessContext())!;

  let idea;
  try {
    idea = await getIdeaById(ctx, params.id);
  } catch (e) {
    if (isAuthorizationError(e) && (e.code === "NOT_FOUND" || e.code === "OUT_OF_SCOPE")) notFound();
    throw e;
  }
  // Only DRAFT ideas are editable; anything else → back to details (no edit surface).
  if (idea.status !== "DRAFT") notFound();

  const [departments, activities] = await Promise.all([
    listOwnableDepartments(ctx),
    prisma.innovationActivity.findMany({ orderBy: { nameAr: "asc" }, select: { id: true, nameAr: true } }),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href={`/governance/ideas/${idea.id}`} className="inline-flex items-center gap-1 text-[12.5px] text-muted hover:text-primary">
          <ArrowRight className="h-3.5 w-3.5" />
          العودة إلى التفاصيل
        </Link>
        <h1 className="mt-2 text-lg font-bold text-slate-800 dark:text-slate-100">تعديل المسودة</h1>
      </div>

      <Card>
        <CardContent className="pt-6">
          <IdeaForm
            mode="edit"
            departments={departments}
            activities={activities}
            initial={{ ideaId: idea.id, titleAr: idea.titleAr, description: idea.description, departmentId: idea.departmentId, activityId: idea.activityId }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
