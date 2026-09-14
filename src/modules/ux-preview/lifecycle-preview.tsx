import { ArrowLeft, BadgeCheck, Banknote, CheckCircle2, Lightbulb, ShieldCheck } from "lucide-react";
import { PreviewLink as Link } from "@/components/layout/preview-link";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { DEMO_LIFECYCLE } from "@/server/demo-data";

const stages = [
  { key: "validation", title: "التحقق", description: "نتائج اختبار الفكرة ومدى ملاءمتها للمستفيد.", icon: BadgeCheck, href: "/lifecycle/validation" },
  { key: "incubation", title: "الاحتضان", description: "معالم التطوير والمرشد المخصص للفكرة.", icon: Lightbulb, href: "/lifecycle/incubation" },
  { key: "ip", title: "الملكية الفكرية", description: "متابعة حالة طلب الحماية أو التسجيل.", icon: ShieldCheck, href: "/lifecycle/ip" },
  { key: "funding", title: "التمويل", description: "طلب التمويل والحالة الحالية للمراجعة.", icon: Banknote, href: "/lifecycle/funding" },
] as const;

export function LifecyclePreview({ stage }: { stage?: string }) {
  if (!stage) return <div className="space-y-5"><PageHeader title="دورة الابتكار" description="عرض مرئي لمراحل ما بعد الفكرة من التحقق إلى التمويل. جميع البيانات تجريبية."/><div className="grid gap-4 md:grid-cols-2">{stages.map((item) => { const Icon = item.icon; return <Card key={item.key}><CardContent className="p-5"><Icon className="h-6 w-6 text-primary"/><h2 className="mt-4 font-bold">{item.title}</h2><p className="mt-1 text-sm text-muted">{item.description}</p><Button asChild className="mt-4" size="sm" variant="outline"><Link href={item.href}>فتح المرحلة <ArrowLeft className="h-4 w-4"/></Link></Button></CardContent></Card>; })}</div></div>;
  if (stage === "validation") return <LifecycleShell title="التحقق" back="/lifecycle"><Card><CardHeader><CardTitle>نتائج اختبار الفكرة</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-3"><Metric label="الحالة" value={DEMO_LIFECYCLE.validation.status}/><Metric label="التقييم المبدئي" value={DEMO_LIFECYCLE.validation.score}/><Metric label="عينة الاختبار" value="18 مستفيدًا"/></CardContent></Card><Card><CardContent className="p-5 text-sm">{DEMO_LIFECYCLE.validation.result}<p className="mt-3 text-xs text-muted">النتيجة تجريبية للعرض وليست قرار اعتماد.</p></CardContent></Card></LifecycleShell>;
  if (stage === "incubation") return <LifecycleShell title="الاحتضان" back="/lifecycle"><Card><CardHeader><CardTitle>خطة الاحتضان</CardTitle></CardHeader><CardContent><Badge variant="primary">{DEMO_LIFECYCLE.incubation.status}</Badge><p className="mt-4 text-sm"><b>المرشد:</b> {DEMO_LIFECYCLE.incubation.mentor}</p><div className="mt-5 space-y-4">{DEMO_LIFECYCLE.incubation.milestones.map((milestone,index)=><div className="flex gap-3" key={milestone}><span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${index < 2 ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"}`}>{index < 2 ? "✓" : index + 1}</span><div className="flex-1"><p className="text-sm font-semibold">{milestone}</p><Progress className="mt-2" value={index < 2 ? 100 : index === 2 ? 55 : 0}/></div></div>)}</div></CardContent></Card></LifecycleShell>;
  if (stage === "ip") return <LifecycleShell title="الملكية الفكرية" back="/lifecycle"><Card><CardHeader><CardTitle>طلب حماية الملكية الفكرية</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-3"><Metric label="الحالة" value={DEMO_LIFECYCLE.ip.status}/><Metric label="الرقم المرجعي" value={DEMO_LIFECYCLE.ip.reference}/><Metric label="المسؤول" value={DEMO_LIFECYCLE.ip.owner}/></CardContent></Card><Notice>هذه بطاقة متابعة شكلية فقط؛ لا يتم إنشاء أو إرسال أي طلب تسجيل حقيقي.</Notice></LifecycleShell>;
  return <LifecycleShell title="التمويل" back="/lifecycle"><Card><CardHeader><CardTitle>طلب تمويل التجربة</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-3"><Metric label="الحالة" value={DEMO_LIFECYCLE.funding.status}/><Metric label="رقم الطلب" value={DEMO_LIFECYCLE.funding.reference}/><Metric label="المبلغ المطلوب" value={DEMO_LIFECYCLE.funding.amount}/></CardContent></Card><Notice>{DEMO_LIFECYCLE.funding.purpose} — بيانات معاينة فقط.</Notice></LifecycleShell>;
}

function LifecycleShell({ title, back, children }: { title: string; back: string; children: React.ReactNode }) { return <div className="mx-auto max-w-4xl space-y-5"><Link href={back} className="text-xs text-muted">العودة إلى دورة الابتكار</Link><PageHeader title={title} description="مساحة عرض تجريبية مرتبطة بدورة الابتكار."/>{children}</div>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border p-4"><p className="text-xs text-muted">{label}</p><p className="mt-2 text-sm font-semibold">{value}</p></div>; }
function Notice({ children }: { children: React.ReactNode }) { return <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{children}</div>; }
