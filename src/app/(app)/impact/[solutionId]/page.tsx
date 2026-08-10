import Link from "next/link";
import { ArrowRight, FileText } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ImpactForm } from "@/modules/impact/components/impact-form";
import { IMPACT_TYPE_LABELS } from "@/modules/impact/schema";
import { getImpactWorkspace, checkMeasurementEligibility } from "@/modules/impact/service";
import { can, getAccessContext, requirePermission } from "@/server/authz";

const value = (x: { toString(): string } | null, unit?: string | null) => x === null ? "—" : `${x.toString()} ${unit ?? ""}`;
export default async function ImpactWorkspacePage({ params }: { params: { solutionId: string } }) {
  await requirePermission("impact.view"); const actor=(await getAccessContext())!; const solution=await getImpactWorkspace(actor,params.solutionId);
  const eligibility = solution.impactIndicators.length ? null : checkMeasurementEligibility(solution);
  return <div className="flex flex-col gap-5"><Link href="/impact" className="flex items-center gap-1 text-xs text-muted"><ArrowRight className="h-4 w-4"/>العودة إلى سجل الأثر</Link>
    <PageHeader title={`ملف أثر: ${solution.nameAr}`} description={`${solution.owningDepartment?.organization.nameAr ?? ""} ${solution.owningDepartment ? `— ${solution.owningDepartment.nameAr}` : ""}`} action={<div className="flex gap-2"><Button asChild variant="outline"><Link href={`/solutions/${solution.id}`}><FileText className="h-4 w-4"/>تفاصيل الحل وأدلته</Link></Button>{can(actor,"evidence.upload")&&<Button asChild variant="outline"><Link href={`/solutions/${solution.id}/evidence/new`}>رفع دليل قياس</Link></Button>}</div>}/>
    {eligibility && !eligibility.eligible && <Card className="border-warning/40 bg-warning-bg/30"><CardContent className="p-4 text-xs leading-6 text-warning"><b className="block text-sm">هذا الحل لا يستوفي بعد شروط الأهلية الرسمية لتقديمه لقياس الأثر وفق معيار 5.24.1:</b><ul className="mt-2 list-disc space-y-1 pr-4">{eligibility.reasons.map((r)=><li key={r}>{r}</li>)}</ul></CardContent></Card>}
    <div className="grid gap-4 lg:grid-cols-3">{solution.impactIndicators.map((indicator)=>{const measurement=indicator.measurements[0]; return <Card key={indicator.id}><CardHeader><CardTitle className="flex justify-between gap-2"><span>{indicator.nameAr}</span><Badge variant="neutral">{IMPACT_TYPE_LABELS[indicator.type]}</Badge></CardTitle></CardHeader><CardContent className="space-y-2 text-xs"><p>خط الأساس: <b>{value(indicator.baselineValue,indicator.unit)}</b></p><p>المستهدف: <b>{value(indicator.targetValue,indicator.unit)}</b></p><p>الفعلي: <b>{value(measurement?.actualValue ?? null,indicator.unit)}</b></p><p>الفترة: {measurement?.periodStart?.toLocaleDateString("ar-SA") ?? "—"} — {measurement?.periodEnd?.toLocaleDateString("ar-SA") ?? "—"}</p><p>مصدر البيانات: {measurement?.dataSource ?? "غير محدد"}</p><Badge variant={measurement?.verificationStatus === "VERIFIED" ? "success" : "warning"}>{measurement?.verificationStatus === "VERIFIED" ? "تم التحقق" : "غير متحقق"}</Badge></CardContent></Card>})}{!solution.impactIndicators.length && <Card className="lg:col-span-3"><CardContent className="p-8 text-center text-sm text-muted">لم تُسجل مؤشرات لهذا الحل بعد.</CardContent></Card>}</div>
    {can(actor,"impact.update") && <Card><CardHeader><CardTitle>إضافة مؤشر وقياس</CardTitle></CardHeader><CardContent><ImpactForm solutionId={solution.id}/></CardContent></Card>}
    <p className="text-xs text-muted">الأرقام المعروضة قياسات تشغيلية داخلية وليست حكماً رسمياً على الامتثال.</p>
  </div>;
}
