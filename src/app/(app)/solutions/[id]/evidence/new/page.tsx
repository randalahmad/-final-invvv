import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { requirePermission, getAccessContext } from "@/server/authz";
import { isAuthorizationError } from "@/server/authorization";
import { getSolutionById } from "@/modules/solutions/service";
import { EvidenceUploadForm } from "@/modules/evidence/components/evidence-upload-form";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "رفع دليل" };

export default async function NewEvidencePage({ params }: { params: { id: string } }) {
  // Upload permission is required to reach the form; the action re-enforces it
  // (and the partner share `evidence.create` requirement) server-side.
  await requirePermission("evidence.upload");
  const ctx = (await getAccessContext())!;

  let solution;
  try {
    solution = await getSolutionById(ctx, params.id);
  } catch (e) {
    if (isAuthorizationError(e) && (e.code === "NOT_FOUND" || e.code === "OUT_OF_SCOPE")) notFound();
    throw e;
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link
          href={`/solutions/${params.id}/evidence`}
          className="inline-flex items-center gap-1 text-[12.5px] text-muted hover:text-primary"
        >
          <ArrowRight className="h-3.5 w-3.5" />
          العودة إلى الأدلة
        </Link>
        <h1 className="mt-2 text-lg font-bold text-slate-800 dark:text-slate-100">رفع دليل جديد</h1>
        <p className="mt-1 text-[13px] text-muted">{solution.nameAr} — يُحفظ الدليل كمسودة ثم يُقدَّم للمراجعة.</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <EvidenceUploadForm solutionId={params.id} />
        </CardContent>
      </Card>
    </div>
  );
}
