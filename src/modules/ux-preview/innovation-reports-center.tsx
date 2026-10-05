"use client";

import { useMemo, useState } from "react";
import { BarChart3, BriefcaseBusiness, Download, Eye, FileCheck2, Filter, Gauge, Lightbulb, Route, Target, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shared/page-header";
import { Progress } from "@/components/ui/progress";
import { DGA_TOTALS, DGA_UNITS } from "@/modules/dga/source-of-truth";
import { previewScenario } from "./fixtures";

type ReportKey = "executive" | "portfolio" | "journey" | "innovators" | "impact" | "readiness";
type ReportRow = { id: string; name: string; department: string; project: string; status: string; date: string; owner: string; stage: string; progress: number };

const reports: { key: ReportKey; label: string; icon: typeof BarChart3 }[] = [
  { key: "executive", label: "الملخص التنفيذي", icon: Gauge },
  { key: "portfolio", label: "محفظة الابتكار", icon: BriefcaseBusiness },
  { key: "journey", label: "رحلة الابتكار", icon: Route },
  { key: "innovators", label: "المبتكرون", icon: Users },
  { key: "impact", label: "قياس الأثر", icon: Target },
  { key: "readiness", label: "الجاهزية والامتثال", icon: FileCheck2 },
];

const dates = ["2026-07-12", "2026-07-28", "2026-08-04", "2026-08-15", "2026-09-01"];
const departments = ["إدارة تجربة المستفيد", "إدارة المرافق", "مركز الأبحاث", "إدارة الابتكار", "إدارة التحول المؤسسي"];
const portfolioRows: ReportRow[] = previewScenario.innovations.map((item, index) => ({
  id: `INN-${String(index + 1).padStart(3, "0")}`,
  name: item[0], project: item[1], owner: item[2], stage: item[3], status: index === 0 ? "قيد التنفيذ" : index === 2 ? "جاهز للتجربة" : index === 3 ? "مسودة" : "قيد التقييم",
  department: departments[index], date: dates[index], progress: [74, 52, 64, 28, 46][index],
}));

const selectClass = "h-10 rounded-lg border border-border bg-white px-3 text-sm outline-none focus:border-primary dark:bg-surface-dark";

function Kpi({ label, value, detail, icon: Icon }: { label: string; value: string; detail: string; icon: typeof BarChart3 }) {
  return <Card><CardContent className="p-5"><div className="flex items-start justify-between"><div><p className="text-xs text-muted">{label}</p><p className="mt-2 text-2xl font-black">{value}</p></div><span className="grid h-10 w-10 place-items-center rounded-xl bg-primary-50 text-primary"><Icon className="h-5 w-5"/></span></div><p className="mt-3 text-[11px] text-muted">{detail}</p></CardContent></Card>;
}

function Bars({ rows }: { rows: { label: string; value: number; total: number; color?: string }[] }) {
  return <div className="space-y-4">{rows.map((row) => <div key={row.label}><div className="mb-1.5 flex justify-between text-xs"><span>{row.label}</span><b>{row.value}</b></div><div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${row.color ?? "bg-primary"}`} style={{ width: `${Math.max(5, (row.value / Math.max(1, row.total)) * 100)}%` }}/></div></div>)}</div>;
}

function ReportTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-start"><thead><tr className="border-b bg-slate-50 text-[11px] text-muted">{headers.map((header) => <th key={header} className="px-4 py-3 text-start font-semibold">{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={`${row[0]}-${index}`} className="border-b border-border/60 last:border-0">{row.map((cell, cellIndex) => <td key={`${index}-${cellIndex}`} className={`px-4 py-3 text-xs ${cellIndex === 0 ? "font-semibold" : "text-slate-600"}`}>{cell}</td>)}</tr>)}</tbody></table></div>;
}

export function InnovationReportsCenter() {
  const [active, setActive] = useState<ReportKey>("executive");
  const [from, setFrom] = useState("2026-01-01");
  const [to, setTo] = useState("2026-12-31");
  const [department, setDepartment] = useState("الكل");
  const [project, setProject] = useState("الكل");
  const [status, setStatus] = useState("الكل");
  const [notice, setNotice] = useState("");

  const filtered = useMemo(() => portfolioRows.filter((row) => row.date >= from && row.date <= to && (department === "الكل" || row.department === department) && (project === "الكل" || row.project === project) && (status === "الكل" || row.status === status)), [department, from, project, status, to]);
  const reportLabel = reports.find((report) => report.key === active)?.label ?? "التقرير";

  function exportCsv() {
    const rows = [["المعرف", "السجل", "الإدارة", "البرنامج/المشروع", "الحالة", "المالك", "التاريخ"], ...filtered.map((row) => [row.id, row.name, row.department, row.project, row.status, row.owner, row.date])];
    const csv = `\uFEFF${rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `innovation-report-${active}.csv`; anchor.click(); URL.revokeObjectURL(url);
    setNotice(`تم تجهيز تصدير «${reportLabel}» وفق المرشحات الحالية.`);
  }

  function previewReport() { setNotice(`معاينة «${reportLabel}» جاهزة للطباعة وفق المرشحات الحالية.`); window.setTimeout(() => window.print(), 100); }

  return <div className="space-y-5 print:space-y-3">
    <PageHeader title="مركز تقارير الابتكار" description="تقارير مترابطة لقراءة المحفظة والرحلة والمبتكرين والأثر والجاهزية من بيانات المعاينة الحالية." action={<div className="flex gap-2"><Button variant="outline" onClick={previewReport}><Eye className="h-4 w-4"/>معاينة التقرير</Button><Button onClick={exportCsv}><Download className="h-4 w-4"/>تصدير CSV</Button></div>}/>
    {notice ? <div className="rounded-xl border border-primary/20 bg-primary-50 p-3 text-sm text-primary-800 print:hidden">{notice}</div> : null}

    <Card className="print:hidden"><CardContent className="p-4"><div className="mb-3 flex items-center gap-2 text-sm font-bold"><Filter className="h-4 w-4 text-primary"/>مرشحات التقرير</div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5"><label className="text-xs text-muted">من تاريخ<Input className="mt-1.5" type="date" value={from} onChange={(event) => setFrom(event.target.value)}/></label><label className="text-xs text-muted">إلى تاريخ<Input className="mt-1.5" type="date" value={to} onChange={(event) => setTo(event.target.value)}/></label><label className="text-xs text-muted">الإدارة<select className={`mt-1.5 w-full ${selectClass}`} value={department} onChange={(event) => setDepartment(event.target.value)}><option>الكل</option>{departments.map((item) => <option key={item}>{item}</option>)}</select></label><label className="text-xs text-muted">المشروع / البرنامج<select className={`mt-1.5 w-full ${selectClass}`} value={project} onChange={(event) => setProject(event.target.value)}><option>الكل</option>{Array.from(new Set(portfolioRows.map((row) => row.project))).map((item) => <option key={item}>{item}</option>)}</select></label><label className="text-xs text-muted">الحالة<select className={`mt-1.5 w-full ${selectClass}`} value={status} onChange={(event) => setStatus(event.target.value)}><option>الكل</option>{Array.from(new Set(portfolioRows.map((row) => row.status))).map((item) => <option key={item}>{item}</option>)}</select></label></div></CardContent></Card>

    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 print:hidden">{reports.map((report) => { const Icon = report.icon; return <button key={report.key} type="button" onClick={() => setActive(report.key)} className={`flex min-h-20 items-center gap-3 rounded-xl border p-3 text-start text-xs font-bold transition ${active === report.key ? "border-primary bg-primary-50 text-primary ring-1 ring-primary/10" : "bg-white hover:border-primary/40"}`}><Icon className="h-5 w-5 shrink-0"/>{report.label}</button>; })}</div>

    <div className="flex items-center justify-between"><div><Badge variant="primary">{reportLabel}</Badge><p className="mt-2 text-xs text-muted">الفترة: {from} — {to} · {filtered.length} سجلات مطابقة</p></div><Badge variant="neutral">بيانات معاينة</Badge></div>
    <ReportView report={active} rows={filtered}/>
    <p className="text-xs text-muted">هذه التقارير تشغيلية داخلية في وضع المعاينة ولا تمثل اعتمادًا رسميًا من هيئة الحكومة الرقمية.</p>
  </div>;
}

function ReportView({ report, rows }: { report: ReportKey; rows: ReportRow[] }) {
  if (report === "executive") return <><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Kpi label="سجلات الابتكار" value={String(rows.length)} detail="ضمن المرشحات الحالية" icon={Lightbulb}/><Kpi label="حلول قيد التنفيذ" value={String(rows.filter((row) => row.status === "قيد التنفيذ").length)} detail="تحتاج متابعة تشغيلية" icon={BriefcaseBusiness}/><Kpi label="المبتكرون" value={String(new Set(rows.map((row) => row.owner)).size)} detail="ملاك السجلات الظاهرة" icon={Users}/><Kpi label="الجاهزية المؤسسية" value={`${DGA_TOTALS.readiness}%`} detail="تقدير داخلي للوحدات الخمس" icon={Gauge}/></div><div className="grid gap-4 lg:grid-cols-2"><Card><CardHeader><CardTitle>توزيع المحفظة حسب الحالة</CardTitle></CardHeader><CardContent><Bars rows={["قيد التنفيذ", "قيد التقييم", "جاهز للتجربة", "مسودة"].map((label) => ({ label, value: rows.filter((row) => row.status === label).length, total: rows.length }))}/></CardContent></Card><Card><CardHeader><CardTitle>أبرز السجلات</CardTitle></CardHeader><CardContent className="p-0"><ReportTable headers={["السجل", "المالك", "الحالة", "التقدم"]} rows={rows.slice(0, 4).map((row) => [row.name, row.owner, row.status, `${row.progress}%`])}/></CardContent></Card></div></>;
  if (report === "portfolio") return <><div className="grid gap-4 sm:grid-cols-3"><Kpi label="إجمالي المحفظة" value={String(rows.length)} detail="فكرة ومخرج ابتكاري" icon={BriefcaseBusiness}/><Kpi label="متوسط التقدم" value={`${rows.length ? Math.round(rows.reduce((sum, row) => sum + row.progress, 0) / rows.length) : 0}%`} detail="عبر السجلات الظاهرة" icon={BarChart3}/><Kpi label="جاهزة للتجربة" value={String(rows.filter((row) => row.status === "جاهز للتجربة").length)} detail="يمكن نقلها للمرحلة التالية" icon={Target}/></div><Card><CardHeader><CardTitle>سجل محفظة الابتكار</CardTitle></CardHeader><CardContent className="p-0"><ReportTable headers={["السجل", "المصدر", "الإدارة", "المالك", "مرحلة النضج", "الحالة", "التقدم"]} rows={rows.map((row) => [row.name, row.project, row.department, row.owner, row.stage, row.status, `${row.progress}%`])}/></CardContent></Card></>;
  if (report === "journey") { const funnel = [{ label: "أفكار مستلمة", value: 18 }, { label: "اجتازت التقييم الأولي", value: 12 }, { label: "دخلت دورة الابتكار", value: 8 }, { label: "نماذج أولية", value: 5 }, { label: "حلول معتمدة للتجربة", value: 3 }, { label: "حلول متبناة", value: 2 }]; return <><div className="grid gap-4 sm:grid-cols-3"><Kpi label="معدل الانتقال للتجربة" value="17%" detail="3 من 18 فكرة" icon={Route}/><Kpi label="في دورة الابتكار" value="8" detail="أعلى تركّز في الرحلة" icon={Lightbulb}/><Kpi label="حلول متبناة" value="2" detail="11% من الأفكار المستلمة" icon={Target}/></div><Card><CardHeader><CardTitle>قمع مراحل رحلة الابتكار</CardTitle></CardHeader><CardContent className="space-y-3">{funnel.map((item, index) => <div key={item.label} className="mx-auto flex min-h-12 items-center justify-between rounded-xl bg-gradient-to-l from-primary to-secondary px-4 text-sm font-bold text-white" style={{ width: `${100 - index * 11}%` }}><span>{item.label}</span><span>{item.value}</span></div>)}</CardContent></Card></>; }
  if (report === "innovators") { const people = Array.from(new Map(rows.map((row) => [row.owner, row])).values()); return <><div className="grid gap-4 sm:grid-cols-3"><Kpi label="مبتكرون نشطون" value={String(people.length)} detail="لديهم سجلات ضمن الفترة" icon={Users}/><Kpi label="إدارات ممثلة" value={String(new Set(people.map((row) => row.department)).size)} detail="انتشار المشاركة المؤسسية" icon={BriefcaseBusiness}/><Kpi label="متوسط السجلات" value={people.length ? (rows.length / people.length).toFixed(1) : "0"} detail="لكل مبتكر" icon={Lightbulb}/></div><Card><CardHeader><CardTitle>مشاركة المبتكرين</CardTitle></CardHeader><CardContent className="p-0"><ReportTable headers={["المبتكر", "الإدارة", "السجل الحالي", "المرحلة", "الحالة", "التقدم"]} rows={people.map((row) => [row.owner, row.department, row.name, row.stage, row.status, `${row.progress}%`])}/></CardContent></Card></>; }
  if (report === "impact") return <><div className="grid gap-4 sm:grid-cols-3"><Kpi label="مؤشرات أثر" value={String(previewScenario.impacts.length)} detail="مرتبطة بحلول وبرامج" icon={Target}/><Kpi label="تم التحقق" value="1" detail="مؤشر موثق داخليًا" icon={FileCheck2}/><Kpi label="قيد التحقق" value="2" detail="تحتاج استكمال مصدر أو مراجعة" icon={Gauge}/></div><Card><CardHeader><CardTitle>نتائج قياس الأثر</CardTitle></CardHeader><CardContent className="p-0"><ReportTable headers={["الحل أو البرنامج", "الأثر المتوقع", "المؤشر", "خط الأساس", "المستهدف", "النتيجة", "الفترة", "التحقق"]} rows={previewScenario.impacts.map((row) => [...row])}/></CardContent></Card></>;
  return <><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Kpi label="الجاهزية العامة" value={`${DGA_TOTALS.readiness}%`} detail="تقدير تشغيلي داخلي" icon={Gauge}/><Kpi label="المتطلبات المكتملة" value={`${DGA_TOTALS.completed}/${DGA_TOTALS.requirements}`} detail="عبر الوحدات الخمس" icon={FileCheck2}/><Kpi label="الأدلة الناقصة" value={String(DGA_TOTALS.missingEvidence)} detail="تحتاج استكمال" icon={FileCheck2}/><Kpi label="إجراءات مطلوبة" value={String(DGA_TOTALS.actionRequired)} detail="تحتاج متابعة مالك المتطلب" icon={Target}/></div><Card><CardHeader><CardTitle>جاهزية الوحدات الخمس</CardTitle></CardHeader><CardContent className="space-y-4">{DGA_UNITS.map((unit) => <div key={unit.code} className="grid items-center gap-3 border-b pb-4 last:border-0 md:grid-cols-[1.5fr_2fr_auto]"><div><Badge variant="primary">{unit.code}</Badge><p className="mt-1 text-sm font-semibold">{unit.name}</p></div><div><Progress value={unit.readiness}/><p className="mt-1 text-[11px] text-muted">{unit.readiness}% جاهزية</p></div><Badge variant={unit.missingEvidence ? "warning" : "success"}>{unit.missingEvidence ? `${unit.missingEvidence} أدلة ناقصة` : "مكتملة الأدلة"}</Badge></div>)}</CardContent></Card></>;
}
