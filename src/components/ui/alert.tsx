import * as React from "react";
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

const styles = {
  info: "border-info/20 bg-info-bg/60 text-info",
  success: "border-success/20 bg-success-bg/70 text-success",
  warning: "border-warning/25 bg-warning-bg/70 text-warning",
  danger: "border-danger/20 bg-danger-bg/70 text-danger",
} as const;

const icons = { info: Info, success: CheckCircle2, warning: TriangleAlert, danger: AlertCircle };

export function Alert({ variant = "info", title, children, className }: { variant?: keyof typeof styles; title?: string; children: React.ReactNode; className?: string }) {
  const Icon = icons[variant];
  return <div role="alert" className={cn("flex gap-3 rounded-xl border p-3.5 text-sm", styles[variant], className)}><Icon className="mt-0.5 h-4 w-4 shrink-0" /><div className="min-w-0">{title && <p className="font-bold">{title}</p>}<div className={cn(title && "mt-1", "leading-relaxed opacity-90")}>{children}</div></div></div>;
}
