import Link from "next/link";
import { ArrowLeft, BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { listImpactSolutions } from "@/modules/impact/service";
import { getAccessContext, requirePermission } from "@/server/authz";

export const metadata = { title: "قياس أثر الحلول" };
export default async function ImpactPage() {
  await requirePermission("impact.view"); const actor = (await getAccessContext())!; const solutions = await listImpactSolutions(actor);
  return <div className="flex flex-col gap-5"><PageHeader title="قياس أثر الحلول (5.24.2)" description="مساحة تشغيلية لربط مؤشرات الأثر المالي والتشغيلي وأثر المستفيدين بالحلول المسجلة. لا توجد في المرجع متطلبات تطبيق تفصيلية رسمية لهذه الوحدة."/>
    <Card><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full min-w-[800px] text-xs"><thead><tr className="border-b text-muted"><th className="p-3 text-start">الحل</th><th className="p-3 text-start">المالك</th><th className="p-3 text-start">المؤشرات</th><th className="p-3 text-start">آخر قياس</th><th className="p-3 text-start">التحقق</th><th/></tr></thead><tbody>{solutions.map((solution)=>{const measurements=solution.impactIndicators.flatMap(x=>x.measurements); return <tr key={solution.id} className="border-b last:border-0"><td className="p-3 font-semibold">{solution.nameAr}</td><td className="p-3 text-muted">{solution.owningDepartment ? `${solution.owningDepartment.organization.nameAr} / ${solution.owningDepartment.nameAr}` : "—"}</td><td className="p-3">{solution.impactIndicators.length}</td><td className="p-3">{measurements[0]?.periodEnd?.toLocaleDateString("ar-SA") ?? "لم يسجل"}</td><td className="p-3"><Badge variant={measurements.some(x=>x.verificationStatus === "VERIFIED") ? "success" : "neutral"}>{measurements.some(x=>x.verificationStatus === "VERIFIED") ? "تم التحقق" : "بانتظار القياس/التحقق"}</Badge></td><td className="p-3"><Link className="flex items-center gap-1 text-primary" href={`/impact/${solution.id}`}>فتح ملف الأثر<ArrowLeft className="h-4 w-4"/></Link></td></tr>})}{!solutions.length && <tr><td colSpan={6} className="p-12 text-center text-muted"><BarChart3 className="mx-auto mb-2 h-8 w-8"/>لا توجد حلول متاحة ضمن نطاقك.</td></tr>}</tbody></table></div></CardContent></Card>
  </div>;
}
