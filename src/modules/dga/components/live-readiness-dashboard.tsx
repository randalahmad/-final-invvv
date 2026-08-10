import Link from "next/link";
import { ArrowLeft, BellRing, CheckCircle2, FileWarning, ListChecks } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { LiveReadiness } from "../live-readiness";

export function LiveReadinessDashboard({ data }: { data: LiveReadiness }) {
  const metrics = [["الجاهزية التشغيلية", `${data.overall}%`, ListChecks], ["السجلات المكتملة", String(data.completed), CheckCircle2], ["الأدلة الناقصة", String(data.missingEvidence), FileWarning], ["المواعيد المتأخرة", String(data.overdue), BellRing]] as const;
  return <div className="space-y-6"><section className="rounded-2xl border border-primary/15 bg-gradient-to-l from-primary-50 to-white p-6 dark:from-primary/10 dark:to-surface-dark"><Badge variant="primary">جاهزية الابتكار المؤسسي</Badge><h1 className="mt-3 text-2xl font-bold">ما الذي يحتاج إلى إجراء الآن؟</h1><p className="mt-2 text-sm text-muted">قراءة حية من بيانات المتطلبات والحلول وقياسات الأثر ضمن نطاق صلاحياتك.</p></section>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(([label,value,Icon])=><Card key={label}><CardContent className="p-5"><Icon className="h-5 w-5 text-primary"/><p className="mt-4 text-xs text-muted">{label}</p><p className="text-2xl font-bold">{value}</p></CardContent></Card>)}</div>
    <section><div className="mb-3 flex items-center justify-between"><div><h2 className="text-lg font-bold">الوحدات الخمس</h2><p className="text-xs text-muted">اكتمال تشغيلي داخلي، ولا يمثل اعتماداً رسمياً من هيئة الحكومة الرقمية.</p></div><ButtonLink/></div><div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">{data.units.map(unit=><Link key={unit.code} href={unit.href}><Card className="h-full hover:border-primary/40"><CardHeader><div className="flex justify-between"><div><Badge variant="primary">{unit.code}</Badge><CardTitle className="mt-2 text-base">{unit.name}</CardTitle></div><b className="text-2xl text-primary">{unit.readiness}%</b></div></CardHeader><CardContent className="space-y-3"><Progress value={unit.readiness}/><div className="grid grid-cols-3 gap-2 text-center text-xs"><span>{unit.completed}/{unit.total}<small className="block text-muted">مكتمل</small></span><span>{unit.missingEvidence}<small className="block text-muted">أدلة ناقصة</small></span><span>{unit.overdue}<small className="block text-muted">متأخر</small></span></div><div className="flex justify-end"><ArrowLeft className="h-4 w-4"/></div></CardContent></Card></Link>)}</div></section>
  </div>;
}
function ButtonLink(){return <Link href="/compliance" className="text-xs font-semibold text-primary">فتح ملف الامتثال</Link>}
