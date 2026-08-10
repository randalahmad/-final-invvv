import Link from "next/link";
import { ArrowLeft, Download, FileWarning } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getLiveReadiness } from "@/modules/dga/live-readiness";
import { can, getAccessContext, requirePermission } from "@/server/authz";
export const metadata={title:"ملف الجاهزية والامتثال"};
export default async function CompliancePage(){await requirePermission("compliance.view");const actor=(await getAccessContext())!;const data=await getLiveReadiness(actor);return <div className="flex flex-col gap-5"><PageHeader title="ملف الجاهزية والامتثال" description="ملف موحّد حي للوحدات الخمس، يعرض الاكتمال والنواقص ومصدر كل مؤشر ضمن نطاقك." action={can(actor,"compliance.export")?<Button asChild variant="outline"><Link href="/reports/export/readiness"><Download className="h-4 w-4"/>تصدير CSV</Link></Button>:undefined}/><div className="rounded-xl border border-warning/30 bg-warning/5 p-3 text-xs">اكتمال السجل داخل المنصة لا يمثل اعتماداً رسمياً من هيئة الحكومة الرقمية. الوحدتان 5.24.1 و5.24.2 تعرضان حقول المنتج المعتمدة فقط.</div><div className="grid gap-4">{data.units.map(unit=><Card key={unit.code}><CardContent className="grid items-center gap-4 p-5 md:grid-cols-[1.4fr_1fr_auto]"><div><div className="flex gap-2"><Badge variant="primary">{unit.code}</Badge><b>{unit.name}</b></div><p className="mt-2 text-xs text-muted">المصدر: {unit.code.startsWith("5.23")?"مساحات المتطلبات وارتباطات الأدلة":"سجلات المنتج التشغيلية"}</p></div><div><Progress value={unit.readiness}/><p className="mt-1 text-xs">{unit.readiness}% · {unit.completed}/{unit.total} مكتمل</p></div><div className="flex items-center gap-3 text-xs"><span className={unit.missingEvidence?"text-warning":"text-muted"}><FileWarning className="inline h-4 w-4"/> {unit.missingEvidence} دليل ناقص</span><Link href={unit.href} className="text-primary">معالجة<ArrowLeft className="inline h-4 w-4"/></Link></div></CardContent></Card>)}</div></div>}
