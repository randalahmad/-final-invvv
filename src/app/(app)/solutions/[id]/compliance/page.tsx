import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { requirePermission, getAccessContext, can } from "@/server/authz";
import { isAuthorizationError } from "@/server/authorization";
import { getComplianceFile, ComplianceError } from "@/modules/compliance/service";
import { ComplianceFileView } from "@/modules/compliance/components/compliance-file";

export const metadata: Metadata = { title: "ملف الامتثال — الحل" };

export default async function SolutionCompliancePage({ params }: { params: { id: string } }) {
  await requirePermission("compliance.view");
  const ctx = (await getAccessContext())!;

  let file;
  try {
    file = await getComplianceFile(ctx, params.id);
  } catch (e) {
    // Not found, out of scope, or non-internal all resolve to a 404 — raw
    // compliance detail is never distinguishable to an unauthorized reader.
    if (e instanceof ComplianceError && (e.code === "NOT_FOUND" || e.code === "NOT_INTERNAL")) notFound();
    if (isAuthorizationError(e) && (e.code === "NOT_FOUND" || e.code === "OUT_OF_SCOPE")) notFound();
    throw e;
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="print:hidden">
        <Link href={`/solutions/${params.id}`} className="inline-flex items-center gap-1 text-[12.5px] text-muted hover:text-primary">
          <ArrowRight className="h-3.5 w-3.5" />
          العودة إلى الحل
        </Link>
        <h1 className="mt-2 text-lg font-bold text-slate-800 dark:text-slate-100">
          ملف الامتثال — {file.solution.nameAr}
        </h1>
        {file.solution.departmentAr && <p className="text-[12.5px] text-muted">{file.solution.departmentAr}</p>}
      </div>

      <ComplianceFileView
        file={file}
        canConfigure={can(ctx, "compliance.configure")}
        canExport={can(ctx, "compliance.export")}
      />
    </div>
  );
}
