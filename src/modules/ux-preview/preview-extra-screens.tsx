import Link from "next/link";
import { FileCheck2, LockKeyhole } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { previewScenario as data } from "./fixtures";

export const EXTRA_PREVIEW_PATHS = ["/impact", "/evidence", "/partners", "/agreements", "/settings", "/admin/users/requests"] as const;

function PreviewButton({ children }: { children: string }) {
  const kind: Record<string,string> = {"إضافة قياس":"impact","رفع وثيقة":"evidence","إضافة جهة":"partner","إضافة اتفاقية":"agreement","حفظ التغييرات":"user","تحديث السجل":"activity"};
  return <Button asChild><Link href={`/preview-form/${kind[children]??"activity"}`}><LockKeyhole className="h-4 w-4" />{children}</Link></Button>;
}

function DataTable({ headers, rows, link }: { headers: string[]; rows: readonly (readonly string[])[]; link?: string }) {
  return <Card className="overflow-hidden"><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-start"><thead><tr className="border-b bg-slate-50 text-[11.5px] text-muted">{headers.map(h=><th className="px-4 py-3 text-start font-medium" key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((row,i)=><tr className="border-b last:border-0" key={`${row[0]}-${i}`}>{row.map((cell,j)=><td className="px-4 py-3 text-[12.5px]" key={`${i}-${j}`}>{j===0&&link&&i===0?<Link className="font-semibold text-primary hover:underline" href={link}>{cell}</Link>:cell}</td>)}</tr>)}</tbody></table></div></CardContent></Card>;
}

function Workspace({ title, back, tabs }: { title: string; back: string; tabs: string[] }) {
  return <div className="space-y-5"><Link href={back} className="text-xs text-muted hover:text-primary">العودة إلى القائمة</Link><PageHeader title={title} description="مساحة عمل مترابطة لعرض السجل، المسؤول، الحالة، الإجراء التالي والسجلات ذات الصلة." action={<PreviewButton>تحديث السجل</PreviewButton>}/><Tabs defaultValue={tabs[0]} dir="rtl"><TabsList className="h-auto flex-wrap justify-start">{tabs.map(t=><TabsTrigger key={t} value={t}>{t}</TabsTrigger>)}</TabsList>{tabs.map((t,i)=><TabsContent key={t} value={t}><Card><CardHeader><CardTitle>{t}</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-3"><div><p className="text-xs text-muted">المسؤول</p><p className="mt-1 text-sm font-medium">نورة العتيبي</p></div><div><p className="text-xs text-muted">الحالة</p><Badge className="mt-1" variant="primary">قيد المتابعة</Badge></div><div><p className="text-xs text-muted">الإجراء التالي</p><p className="mt-1 text-sm font-medium">{i % 2 ? "مراجعة الوثائق المرتبطة" : "اعتماد مخرجات المرحلة"}</p></div><div className="md:col-span-3 rounded-xl border bg-slate-50 p-4 text-sm text-slate-600">يعرض هذا القسم بيانات المعاينة المترابطة للسجل دون حفظ أو تنفيذ أي إجراء تشغيلي.</div></CardContent></Card></TabsContent>)}</Tabs></div>;
}

export function ExtraPreviewScreen({ path }: { path: string }) {
  if (path === "/impact") return <div className="space-y-5"><PageHeader title="قياس الأثر" description="متابعة الأثر المتوقع والنتائج الفعلية وحالة التحقق." action={<PreviewButton>إضافة قياس</PreviewButton>}/><DataTable headers={["الحل أو البرنامج","الأثر المتوقع","المؤشر","خط الأساس","المستهدف","النتيجة","فترة القياس","التحقق"]} rows={data.impacts}/></div>;
  if (path === "/evidence") return <div className="space-y-5"><PageHeader title="الأدلة والوثائق" description="مستودع موحد يربط الوثيقة بسجلها التشغيلي ومتطلب الامتثال." action={<PreviewButton>رفع وثيقة</PreviewButton>}/><DataTable headers={["الدليل أو الوثيقة","السجل المصدر","النوع","حالة المراجعة","متطلب الامتثال","المسؤول","التاريخ"]} rows={data.evidence}/></div>;
  if (path === "/partners") return <div className="space-y-5"><PageHeader title="الجهات والشركاء" description="العلاقات المؤسسية والبرامج والحلول والاتفاقيات المرتبطة بكل جهة." action={<PreviewButton>إضافة جهة</PreviewButton>}/><DataTable headers={["الجهة","نوع العلاقة","البرامج المرتبطة","الحلول المرتبطة","الاتفاقيات النشطة","الإجراء التالي"]} rows={data.partners}/></div>;
  if (path === "/agreements") return <div className="space-y-5"><PageHeader title="الاتفاقيات والتعاون" description="متابعة الالتزامات والوثائق ومواعيد التجديد للتعاون المؤسسي." action={<PreviewButton>إضافة اتفاقية</PreviewButton>}/><DataTable headers={["الاتفاقية","الجهة","الحالة","تاريخ البدء","تاريخ الانتهاء","الالتزامات","التجديد"]} rows={data.agreements}/></div>;
  if (path === "/admin/users/requests") return <div className="space-y-5"><PageHeader title="طلبات التسجيل" description="طلبات الوصول الجديدة وحالة المراجعة والدور المقترح."/><DataTable headers={["مقدم الطلب","الجهة","الفئة المطلوبة","تاريخ الطلب","الحالة","الإجراء"]} rows={[["ريم الشهري","مركز الأبحاث","مستخدم داخلي","8 أغسطس 2026","بانتظار المراجعة","مراجعة الطلب"],["عبدالله السبيعي","جامعة شريكة","شريك خارجي","7 أغسطس 2026","معلومات ناقصة","طلب استكمال"]]}/></div>;
  if (path === "/settings") return <div className="space-y-5"><PageHeader title="الإعدادات" description="إعدادات منصة المعاينة على مستوى الجهة. الحفظ معطّل."/><div className="grid gap-4 lg:grid-cols-3">{[["بيانات الجهة","مركز الابتكار المؤسسي","اسم الجهة وشعارها وبيانات التواصل"],["إعدادات التنبيهات","تنبيهات المواعيد والمراجعات مفعّلة","تفضيلات الإشعارات الافتراضية"],["المصطلحات والتصنيفات","5 مراحل نضج · 4 فئات ابتكار","التصنيفات الأساسية المستخدمة في السجلات"]].map(([t,v,d])=><Card key={t}><CardHeader><FileCheck2 className="h-5 w-5 text-primary"/><CardTitle>{t}</CardTitle></CardHeader><CardContent><p className="text-sm font-medium">{v}</p><p className="mt-2 text-xs text-muted">{d}</p></CardContent></Card>)}</div></div>;
  if (path.startsWith("/activities/")) return <Workspace title="هاكاثون المدن المستدامة 2026" back="/activities" tabs={["نظرة عامة","الخطة والجدول","الفريق والمشاركون","اللجنة والتقييم","المشاركات والمخرجات","الأدلة والوثائق","المتابعة","التقرير النهائي"]}/>;
  if (path.startsWith("/challenges/")) return <Workspace title="خفض زمن معالجة طلبات المستفيدين" back="/challenges" tabs={["نظرة عامة","المخرجات المقدمة","ملخص التقييم","السجلات المرتبطة"]}/>;
  if (path.startsWith("/governance/ideas/")) return <Workspace title="مساعد ذكي لتوجيه المستفيد" back="/governance/ideas" tabs={["الملخص","النضج والجاهزية","الفجوات","احتياجات الدعم","القرار والخطوة التالية"]}/>;
  if (path.startsWith("/governance/committees/")) return <Workspace title="لجنة تقييم مخرجات الهاكاثون" back="/governance" tabs={["بيانات اللجنة","الأعضاء","التقييمات المسندة","حالة التقييم","القرارات"]}/>;
  return null;
}
