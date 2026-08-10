import { cn } from "@/lib/utils";
import Link from "next/link";
import type { AlertItemData } from "@/modules/alerts/types";

export function AlertItem({ alert }: { alert: AlertItemData }) {
  const urgent = alert.severity === "urgent";
  return (
    <div
      className={cn(
        "mb-2.5 rounded-xl border-s-4 p-3.5 last:mb-0",
        urgent ? "border-s-danger bg-danger-bg" : "border-s-warning bg-warning-bg",
      )}
    >
      <div className="mb-1 flex items-center gap-2 text-[13px] font-bold text-slate-800">
        <span aria-hidden>{urgent ? "🚩" : "📄"}</span>
        {alert.title}
      </div>
      <p className="text-[11px] text-slate-600">{alert.detail}</p>
      <p className="mt-1.5 text-[10px] text-muted">{alert.tag}</p>
      {alert.dueDate && <p className="mt-1 text-[10px] text-muted">الموعد: {new Date(alert.dueDate).toLocaleDateString("ar-SA")}</p>}
      {alert.href && <Link className="mt-2 inline-block text-[11px] font-semibold text-primary" href={alert.href}>فتح السجل</Link>}
    </div>
  );
}
