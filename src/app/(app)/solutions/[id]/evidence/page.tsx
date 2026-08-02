import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Plus } from "lucide-react";

import { requirePermission, getAccessContext, can } from "@/server/authz";
import { isAuthorizationError } from "@/server/authorization";
import { getSolutionById } from "@/modules/solutions/service";
import { listSolutionEvidence, computeEvidenceApprovalRate, EvidenceError } from "@/modules/evidence/service";
import { REVIEW_STATUS_LABELS } from "@/modules/evidence/schema";
import { EvidenceTable } from "@/modules/evidence/components/evidence-table";
import { EvidenceApprovalRateCard } from "@/modules/evidence/components/evidence-approval-rate-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "أدلة الحل" };

const FILTERS = [
  { value: "", label: "الكل" },
  { value: "DRAFT", label: "مسودة" },
  { value: "SUBMITTED", label: "مُقدّم" },
  { value: "UNDER_REVIEW", label: "قيد المراجعة" },
  { value: "APPROVED", label: "معتمد" },
  { value: "REJECTED", label: "مرفوض" },
];

export default async function SolutionEvidencePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { q?: string; status?: string; archived?: string };
}) {
  await requirePermission("evidence.view");
  const ctx = (await getAccessContext())!;

  let solution;
  try {
    solution = await getSolutionById(ctx, params.id);
  } catch (e) {
    if (isAuthorizationError(e) && (e.code === "NOT_FOUND" || e.code === "OUT_OF_SCOPE")) notFound();
    throw e;
  }

  const includeArchived = searchParams.archived === "1";
  const status = searchParams.status && searchParams.status in REVIEW_STATUS_LABELS ? searchParams.status : undefined;

  let rows;
  try {
    rows = await listSolutionEvidence(ctx, params.id, { q: searchParams.q, reviewStatus: status, includeArchived });
  } catch (e) {
    if (e instanceof EvidenceError && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  const approvalRate = await computeEvidenceApprovalRate(params.id);
  const canUpload = can(ctx, "evidence.upload");

  const qs = (patch: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    const merged = { q: searchParams.q, status: searchParams.status, archived: searchParams.archived, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) sp.set(k, v);
    const s = sp.toString();
    return `/solutions/${params.id}/evidence${s ? `?${s}` : ""}`;
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href={`/solutions/${params.id}`} className="inline-flex items-center gap-1 text-[12.5px] text-muted hover:text-primary">
          <ArrowRight className="h-3.5 w-3.5" />
          العودة إلى الحل
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">أدلة الحل</h1>
            <p className="mt-1 text-[13px] text-muted">{solution.nameAr}</p>
          </div>
          {canUpload && (
            <Button asChild>
              <Link href={`/solutions/${params.id}/evidence/new`}>
                <Plus className="h-4 w-4" />
                رفع دليل
              </Link>
            </Button>
          )}
        </div>
      </div>

      <EvidenceApprovalRateCard rate={approvalRate} />

      <Card>
        <CardContent className="flex flex-col gap-3 pt-5">
          <form method="get" className="flex flex-wrap items-end gap-2">
            {searchParams.status && <input type="hidden" name="status" value={searchParams.status} />}
            {searchParams.archived && <input type="hidden" name="archived" value={searchParams.archived} />}
            <div className="flex min-w-[220px] flex-1 flex-col gap-1">
              <label htmlFor="q" className="text-[11.5px] text-muted">
                بحث
              </label>
              <Input id="q" name="q" defaultValue={searchParams.q ?? ""} placeholder="ابحث بالعنوان أو اسم الملف" />
            </div>
            <Button type="submit" variant="outline" size="sm">
              بحث
            </Button>
          </form>

          <div className="flex flex-wrap items-center gap-1.5">
            {FILTERS.map((f) => {
              const active = (searchParams.status ?? "") === f.value;
              return (
                <Link
                  key={f.value}
                  href={qs({ status: f.value || undefined })}
                  className={cn(
                    "rounded-full px-3 py-1 text-[12.5px] transition-colors",
                    active ? "bg-primary text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-300",
                  )}
                >
                  {f.label}
                </Link>
              );
            })}
            <Link
              href={qs({ archived: includeArchived ? undefined : "1" })}
              className={cn(
                "rounded-full px-3 py-1 text-[12.5px] transition-colors",
                includeArchived ? "bg-secondary text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-300",
              )}
            >
              {includeArchived ? "إخفاء المؤرشف" : "تضمين المؤرشف"}
            </Link>
          </div>
        </CardContent>
      </Card>

      <EvidenceTable rows={rows} solutionId={params.id} />
    </div>
  );
}
