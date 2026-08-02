"use client";

import { useMemo, useState } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertItem } from "@/modules/alerts/components/alert-item";
import type { AlertItemData } from "@/modules/alerts/types";

type Filter = "all" | "urgent" | "reminder";

export function AlertsCenter({ alerts }: { alerts: AlertItemData[] }) {
  const [filter, setFilter] = useState<Filter>("all");

  const counts = useMemo(
    () => ({
      all: alerts.length,
      urgent: alerts.filter((a) => a.severity === "urgent").length,
      reminder: alerts.filter((a) => a.severity === "reminder").length,
    }),
    [alerts],
  );

  const filtered = useMemo(
    () => (filter === "all" ? alerts : alerts.filter((a) => a.severity === filter)),
    [alerts, filter],
  );

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="pt-5 text-[12.5px] leading-relaxed text-muted">
          يبني النظام تلقائيًا المحدّدات الزمنية من قاعدة البيانات (مواعيد الاجتماعات الدورية،
          انتهاء الاتفاقيات، وتجاوز نوافذ قياس الأثر).
        </CardContent>
      </Card>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
        <TabsList>
          <TabsTrigger value="all">الكل ({counts.all})</TabsTrigger>
          <TabsTrigger value="urgent">عاجلة ({counts.urgent})</TabsTrigger>
          <TabsTrigger value="reminder">تذكيرات ({counts.reminder})</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardContent className="pt-5">
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-[12.5px] text-muted">لا توجد تنبيهات في هذا التصنيف</p>
          ) : (
            filtered.map((alert) => <AlertItem key={alert.id} alert={alert} />)
          )}
        </CardContent>
      </Card>
    </div>
  );
}
