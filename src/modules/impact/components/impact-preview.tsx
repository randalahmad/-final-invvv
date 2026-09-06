"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, CalendarClock, CheckCircle2, FileWarning, ListTodo, Plus } from "lucide-react";
import { PreviewLink as Link } from "@/components/layout/preview-link";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import type { PreviewPersonaKey } from "@/lib/ux-preview";
import { deriveImpactSummary, IMPACT_SOLUTIONS, PREVIEW_IMPACT_MEASUREMENTS, progressTowardTarget, type ImpactCategory, type PreviewImpactMeasurement } from "../preview-data";

const categories: ImpactCategory[] = ["مالي / خفض تكاليف","تشغيلي / وقت وجهد","رضا المستفيدين","عدد المستفيدين","جودة الخدمة","أثر رقمي","فئة أخرى"];
const field = "mt-1.5 h-10 w-full rounded-lg border bg-transparent px-3 text-sm";

export function ImpactPortfolioPreview({persona}:{persona:PreviewPersonaKey}) {
  const summary=deriveImpactSummary();
  const editable=persona!=="viewer";
  const cards=[
    ["حلول تم قياسها",String(summary.measuredSolutions)],
    ["بانتظار القياس",String(summary.awaitingMeasurement)],
    ["إجمالي المستفيدين",summary.beneficiaries?summary.beneficiaries.toLocaleString("ar-SA"):"لا توجد قيمة"],
    ["خفض التكاليف المسجل",summary.costReduction?summary.costReduction.toLocaleString("ar-SA"):"لا توجد قيمة"],
    ["مؤشرات الرضا",String(summary.satisfactionIndicators)],
    ["أدلة قياس ناقصة",String(summary.missingEvidence)],
  ];
  return <div className="space-y-5"><PageHeader title="قياس أثر الحلول" description="مساحة عملية لقياس النتائج الفعلية للحلول المقبولة والتشغيلية ومتابعة النواقص ومواعيد القياس."/>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{cards.map(([label,value])=><Card key={label}><CardContent className="p-4"><p className="text-xs text-muted">{label}</p><p className="mt-2 text-xl font-bold">{value}</p></CardContent></Card>)}</div>
    <Card><CardHeader><CardTitle>الحلول الجاهزة للقياس</CardTitle></CardHeader><CardContent className="space-y-3">{IMPACT_SOLUTIONS.map(solution=>{const rows=PREVIEW_IMPACT_MEASUREMENTS.filter(item=>item.solutionId===solution.id);const missing=rows.filter(item=>item.actual===null||!item.evidence).length;return <div key={solution.id} className="grid gap-3 rounded-xl border p-4 md:grid-cols-[1fr_auto_auto] md:items-center"><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-bold">{solution.name}</h2><Badge variant="neutral">{solution.status}</Badge></div><p className="mt-1 text-xs text-muted">الأثر المتوقع: {solution.expectedImpact}</p><p className="mt-2 text-xs">{rows.length} مؤشرات · {missing?`${missing} نواقص قياس أو إثبات`:"القياسات موثقة"}</p></div><Badge variant={missing?"warning":"success"}>{missing?"تحتاج متابعة":"مقاسة"}</Badge><Button asChild size="sm" variant="outline"><Link href={`/impact/${solution.id}`}>{editable?"فتح مساحة القياس":"عرض القياسات"}<ArrowLeft className="h-4 w-4"/></Link></Button></div>})}</CardContent></Card>
  </div>;
}

export function ImpactWorkspacePreview({solutionId,persona}:{solutionId:string;persona:PreviewPersonaKey}) {
  const solution=IMPACT_SOLUTIONS.find(item=>item.id===solutionId)??IMPACT_SOLUTIONS[0];
  const [measurements,setMeasurements]=useState(()=>PREVIEW_IMPACT_MEASUREMENTS.filter(item=>item.solutionId===solution.id));
  const [showForm,setShowForm]=useState(false); const [notice,setNotice]=useState("");
  const editable=persona!=="viewer";
  const average=useMemo(()=>measurements.length?Math.round(measurements.reduce((sum,item)=>sum+progressTowardTarget(item),0)/measurements.length):0,[measurements]);
  function addMeasurement(formData:FormData){const now=new Date();const next:PreviewImpactMeasurement={id:crypto.randomUUID(),solutionId:solution.id,indicator:String(formData.get("indicator")),description:String(formData.get("description")),category:String(formData.get("category")) as ImpactCategory,baseline:Number(formData.get("baseline")),target:Number(formData.get("target")),actual:null,unit:String(formData.get("unit")),period:String(formData.get("period")),source:String(formData.get("source")),owner:String(formData.get("owner")),verification:"لم يبدأ",notes:String(formData.get("notes")),evidence:null,lastMeasuredAt:null,nextMeasuredAt:String(formData.get("nextMeasuredAt"))||now.toLocaleDateString("ar-SA")};setMeasurements(rows=>[...rows,next]);setShowForm(false);setNotice("أضيف مؤشر القياس في وضع المعاينة.");}
  function updateActual(id:string){setMeasurements(rows=>rows.map(item=>item.id===id?{...item,actual:item.actual??Math.round((item.baseline+item.target)/2),lastMeasuredAt:"اليوم",verification:"بانتظار التحقق"}:item));setNotice("حُدثت النتيجة الفعلية وأضيفت إلى سجل القياس.");}
  function linkEvidence(id:string){setMeasurements(rows=>rows.map(item=>item.id===id?{...item,evidence:"دليل قياس تجريبي.pdf"}:item));setNotice("رُبط دليل القياس بالمؤشر — ملف معاينة فقط.");}
  return <div className="space-y-5"><Link href="/impact" className="text-xs font-semibold text-primary">العودة إلى قياس أثر الحلول</Link><PageHeader title={solution.name} description={`الأثر المتوقع: ${solution.expectedImpact}`} action={editable?<Button onClick={()=>setShowForm(value=>!value)}><Plus className="h-4 w-4"/>إضافة قياس</Button>:<Badge variant="neutral">للقراءة فقط</Badge>}/>
    {notice?<p className="rounded-xl bg-primary-50 p-3 text-sm text-primary-700">{notice} لا يُحفظ تشغيليًا.</p>:null}
    <div className="grid gap-3 sm:grid-cols-3"><Card><CardContent className="p-4"><p className="text-xs text-muted">التقدم نحو المستهدفات</p><p className="mt-2 text-2xl font-bold">{average}%</p><Progress className="mt-2" value={average}/></CardContent></Card><Card><CardContent className="p-4"><p className="text-xs text-muted">مؤشرات القياس</p><p className="mt-2 text-2xl font-bold">{measurements.length}</p></CardContent></Card><Card><CardContent className="p-4"><p className="text-xs text-muted">النواقص</p><p className="mt-2 text-2xl font-bold">{measurements.filter(item=>item.actual===null||!item.evidence).length}</p></CardContent></Card></div>
    {showForm?<Card><CardHeader><CardTitle>قياس أثر جديد</CardTitle></CardHeader><CardContent><form action={addMeasurement} className="grid gap-4 md:grid-cols-2">{[["indicator","اسم المؤشر"],["description","وصف المؤشر"],["baseline","خط الأساس"],["target","المستهدف"],["unit","وحدة القياس"],["period","فترة القياس"],["source","مصدر البيانات"],["owner","المسؤول عن القياس"],["nextMeasuredAt","تاريخ القياس التالي"],["notes","ملاحظات"]].map(([name,label])=><label key={name} className={name==="description"||name==="notes"?"md:col-span-2":""}><span className="text-xs font-semibold">{label}</span><Input required={!["notes"].includes(name)} name={name} type={["baseline","target"].includes(name)?"number":"text"}/></label>)}<label><span className="text-xs font-semibold">نوع الأثر</span><select name="category" className={field}>{categories.map(item=><option key={item}>{item}</option>)}</select></label><div className="flex items-end"><Button type="submit">حفظ القياس</Button></div></form></CardContent></Card>:null}
    <div className="space-y-4">{measurements.length?measurements.map(item=><Card key={item.id}><CardContent className="p-5"><div className="flex flex-wrap justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-bold">{item.indicator}</h2><Badge variant="neutral">{item.category}</Badge><Badge variant={item.verification==="تم التحقق"?"success":"warning"}>{item.verification}</Badge></div><p className="mt-1 text-xs text-muted">{item.description}</p></div><b className="text-xl text-primary">{progressTowardTarget(item)}%</b></div><Progress className="my-4" value={progressTowardTarget(item)}/><div className="grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">{[["قبل التنفيذ",`${item.baseline} ${item.unit}`],["المستهدف",`${item.target} ${item.unit}`],["المتحقق",item.actual===null?"لم يُسجل":`${item.actual} ${item.unit}`],["فترة القياس",item.period],["مصدر البيانات",item.source],["مسؤول القياس",item.owner],["آخر قياس",item.lastMeasuredAt??"لم يتم"],["القياس التالي",item.nextMeasuredAt]].map(([label,value])=><div key={label} className="rounded-lg bg-slate-50 p-3"><span className="text-muted">{label}</span><b className="mt-1 block">{value}</b></div>)}</div><div className="mt-4 flex flex-wrap items-center gap-2">{item.evidence?<span className="flex items-center gap-1 text-xs text-success"><CheckCircle2 className="h-4 w-4"/>{item.evidence}</span>:<span className="flex items-center gap-1 text-xs text-warning"><FileWarning className="h-4 w-4"/>دليل القياس مفقود</span>}{editable?<><Button size="sm" variant="outline" onClick={()=>updateActual(item.id)}>تحديث النتيجة الفعلية</Button><Button size="sm" variant="outline" onClick={()=>linkEvidence(item.id)}>ربط دليل القياس</Button><Button size="sm" variant="outline" onClick={()=>setNotice(`أُسندت مهمة القياس إلى ${item.owner} وموعدها ${item.nextMeasuredAt}.`)}><ListTodo className="h-4 w-4"/>إسناد مهمة قياس</Button></>:null}<span className="mr-auto flex items-center gap-1 text-xs text-muted"><CalendarClock className="h-4 w-4"/>{item.notes||"لا توجد ملاحظات"}</span></div></CardContent></Card>):<Card><CardContent className="p-8 text-center"><p className="font-semibold">لم يبدأ قياس هذا الحل</p><p className="mt-1 text-sm text-muted">أضف أول مؤشر وحدد خط الأساس والمستهدف ومصدر البيانات.</p></CardContent></Card>}</div>
  </div>;
}
