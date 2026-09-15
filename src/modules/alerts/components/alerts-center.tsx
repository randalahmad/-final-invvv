"use client";

import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { AlertItem } from "@/modules/alerts/components/alert-item";
import type { AlertItemData } from "@/modules/alerts/types";

type Filter = "all" | "urgent" | "reminder";

export function AlertsCenter({ alerts }: { alerts: AlertItemData[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const counts = useMemo(() => ({ all: alerts.length, urgent: alerts.filter((alert) => alert.severity === "urgent").length, reminder: alerts.filter((alert) => alert.severity === "reminder").length }), [alerts]);
  const visible = useMemo(() => filter === "all" ? alerts : alerts.filter((alert) => alert.severity === filter), [alerts, filter]);
  return <div className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex gap-1 rounded-xl border p-1">{(["all", "urgent", "reminder"] as Filter[]).map((item) => <button key={item} type="button" onClick={() => setFilter(item)} className={`rounded-lg px-3 py-2 text-xs font-semibold ${filter === item ? "bg-primary-50 text-primary" : "text-muted hover:bg-slate-50"}`}>{item === "all" ? "الكل" : item === "urgent" ? "عاجلة" : "تذكيرات"} ({counts[item]})</button>)}</div><p className="text-xs text-muted">مرتبة حسب الأولوية وتاريخ التنبيه المتاح.</p></div><Card><CardContent className="p-3">{visible.length ? visible.map((alert) => <AlertItem key={alert.id} alert={alert} />) : <p className="py-10 text-center text-sm text-muted">لا توجد تنبيهات في هذا التصنيف.</p>}</CardContent></Card></div>;
}
