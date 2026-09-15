"use client";

import Link from "next/link";
import { Bell, ChevronLeft, Flag, Info, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type { AlertItemData } from "@/modules/alerts/types";

type Filter = "all" | "urgent" | "reminder";

export function NotificationMenu({ alerts }: { alerts: AlertItemData[] }) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const counts = useMemo(() => ({ all: alerts.length, urgent: alerts.filter((alert) => alert.severity === "urgent").length, reminder: alerts.filter((alert) => alert.severity === "reminder").length }), [alerts]);
  const visible = useMemo(() => (filter === "all" ? alerts : alerts.filter((alert) => alert.severity === filter)).slice(0, 7), [alerts, filter]);
  return <div className="relative"><Button type="button" variant="ghost" size="icon" aria-label="فتح التنبيهات" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen((current) => !current)} className="relative rounded-xl hover:bg-primary-50 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary"><Bell className="h-4 w-4" /></Button>
    {open ? <div role="dialog" aria-label="التنبيهات" className="absolute left-0 top-[calc(100%+.5rem)] z-50 w-[min(24rem,calc(100vw-2rem))] rounded-2xl border border-border bg-surface p-3 shadow-xl"><div className="flex items-center justify-between gap-3 px-1 pb-3"><div><h2 className="font-bold">التنبيهات</h2><p className="mt-0.5 text-xs text-muted">{counts.all ? `${counts.all} تنبيه ضمن نطاقك` : "لا توجد تنبيهات"}</p></div></div><div className="mb-2 flex gap-1 border-b pb-2">{(["all", "urgent", "reminder"] as Filter[]).map((item) => <button key={item} type="button" onClick={() => setFilter(item)} className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${filter === item ? "bg-primary-50 text-primary" : "text-muted hover:bg-slate-50"}`}>{item === "all" ? "الكل" : item === "urgent" ? "عاجلة" : "تذكيرات"} ({counts[item]})</button>)}</div><div className="max-h-[24rem] overflow-y-auto">{visible.length ? visible.map((alert) => { const urgent = alert.severity === "urgent"; return <div key={alert.id} className={`flex gap-2 border-b px-1 py-3 last:border-0 ${urgent ? "border-s-2 border-s-danger" : ""}`}><span className={`mt-0.5 ${urgent ? "text-danger" : "text-primary"}`}>{urgent ? <TriangleAlert className="h-4 w-4"/> : <Info className="h-4 w-4"/>}</span><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><p className="text-xs font-bold">{alert.title}</p>{urgent ? <Flag className="h-3.5 w-3.5 shrink-0 text-danger"/> : null}</div><p className="mt-1 line-clamp-2 text-[11px] leading-5 text-muted">{alert.detail}</p><div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-muted"><span>{alert.tag}</span><span>{alert.dueDate ? new Date(alert.dueDate).toLocaleDateString("ar-SA") : ""}</span></div>{alert.href ? <Link onClick={() => setOpen(false)} href={alert.href} className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-primary">{alert.tag.includes("مهمة") ? "عرض المهمة" : "فتح الإجراء"}<ChevronLeft className="h-3.5 w-3.5"/></Link> : null}</div></div> }) : <p className="py-8 text-center text-sm text-muted">لا توجد تنبيهات في هذا التصنيف.</p>}</div><Link onClick={() => setOpen(false)} href="/alerts" className="mt-2 flex items-center justify-center gap-1 rounded-xl border px-3 py-2 text-xs font-semibold text-primary hover:bg-primary-50">عرض جميع التنبيهات<ChevronLeft className="h-3.5 w-3.5"/></Link></div> : null}
  </div>;
}
