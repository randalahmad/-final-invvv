import Link from "next/link";
import { ChevronLeft, Info, TriangleAlert } from "lucide-react";
import type { AlertItemData } from "@/modules/alerts/types";

export function AlertItem({ alert }: { alert: AlertItemData }) {
  const urgent = alert.severity === "urgent";
  return <article className={`flex gap-3 border-b px-1 py-3.5 last:border-0 ${urgent ? "border-s-2 border-s-danger" : ""}`}><span className={`mt-0.5 ${urgent ? "text-danger" : "text-primary"}`}>{urgent ? <TriangleAlert className="h-4 w-4"/> : <Info className="h-4 w-4"/>}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-bold">{alert.title}</h2><span className={`text-[10px] font-semibold ${urgent ? "text-danger" : "text-muted"}`}>{urgent ? "عاجل" : alert.tag}</span></div><p className="mt-1 text-xs leading-5 text-muted">{alert.detail}</p><div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-muted"><span>{alert.tag}</span>{alert.dueDate ? <span>{new Date(alert.dueDate).toLocaleDateString("ar-SA")}</span> : null}</div>{alert.href ? <Link href={alert.href} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">{alert.tag.includes("مهمة") ? "عرض المهمة" : "فتح الإجراء"}<ChevronLeft className="h-3.5 w-3.5"/></Link> : null}</div></article>;
}
