import Link from "next/link";
import {ArrowLeft,CheckSquare} from "lucide-react";
import {PageHeader} from "@/components/shared/page-header";import {Badge} from "@/components/ui/badge";import {Card,CardContent} from "@/components/ui/card";
import {listMyTasks} from "@/modules/governance-workflow/service";import {requireUser} from "@/server/authz";import {requirementHref} from "@/modules/governance-workflow/links";

const typeLabels={PREPARE:"مطلوب مني إعداد",REVIEW:"مطلوب مني مراجعة",APPROVE:"مطلوب مني اعتماد",AMEND:"مطلوب مني تعديل",RESPOND:"مطلوب مني الرد",FOLLOW_UP:"متابعة"} as const;
const priorityLabels={LOW:"منخفضة",MEDIUM:"متوسطة",HIGH:"عالية",URGENT:"عاجلة"} as const;
const statusLabels:Record<string,string>={OPEN:"مفتوحة",IN_PROGRESS:"قيد التنفيذ",WAITING:"بانتظار طرف آخر",COMPLETED:"مكتملة",CANCELLED:"ملغاة"};

export default async function MyTasksPage(){
  const actor=await requireUser();const tasks=await listMyTasks(actor);
  return <div className="flex flex-col gap-5"><PageHeader title="مهامي" description="العمل القابل للتنفيذ المسند إليك، منفصل عن التنبيهات العامة."/><Card><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-xs"><thead><tr className="border-b text-muted">{["المهمة","المعيار والمتطلب","الإدارة","طالب الإجراء","الأولوية","الموعد","الحالة","الإجراء التالي"].map(x=><th key={x} className="p-3 text-start">{x}</th>)}</tr></thead><tbody>{tasks.map(task=>{
    const base=task.sectionContribution?`/my-contributions/${task.sectionContribution.id}`:requirementHref(task.assignment.requirement.code);
    const openInnovation=task.sourceKey?.startsWith("open-innovation:")?task.sourceKey.split(":"):null;
    const cooperationActivation=task.sourceKey?.startsWith("cooperation-activation:")?task.sourceKey.split(":"):null;
    const href=cooperationActivation?`/activities/requirements/5-23-2-r4/activations/${cooperationActivation[1]}#activation-${cooperationActivation[2]}`:openInnovation?`/activities/requirements/5-23-2-r3/events/${openInnovation[1]}#event-${openInnovation[2]}`:task.methodologyApplicationId?`${base}?methodologyCaseId=${task.methodologyApplicationId}#methodology-task-context`:task.activityId?`${base}?activityId=${task.activityId}#activity-tasks`:base;
    return <tr key={task.id} className="border-b"><td className="p-3"><Badge variant="primary">{typeLabels[task.type]}</Badge><p className="mt-1 font-semibold">{task.title}</p>{task.activity?<p className="text-muted">النشاط: {task.activity.nameAr}</p>:task.methodologyApplication?<p className="text-muted">حالة المنهجية: {task.methodologyApplication.nameAr}</p>:openInnovation?<p className="text-muted">فعالية ابتكار مفتوح</p>:null}</td><td className="p-3">{task.assignment.requirement.code}<br/>{task.assignment.requirement.titleAr}</td><td className="p-3">{task.assignment.department.nameAr}</td><td className="p-3">{task.requestedById}</td><td className="p-3">{priorityLabels[task.priority]}</td><td className="p-3">{task.dueDate?.toLocaleDateString("ar-SA")??"—"}</td><td className="p-3">{statusLabels[task.status]??task.status}</td><td className="p-3"><Link className="text-primary" href={href}>{task.nextAction??"فتح المتطلب"}<ArrowLeft className="inline h-4 w-4"/></Link></td></tr>;
  })}{!tasks.length?<tr><td colSpan={8} className="p-12 text-center text-muted"><CheckSquare className="mx-auto mb-2"/>لا توجد مهام مفتوحة مسندة إليك.</td></tr>:null}</tbody></table></div></CardContent></Card></div>;
}
