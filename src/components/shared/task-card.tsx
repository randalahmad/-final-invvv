import Link from "next/link";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function TaskCard({ title, count, href, tone = "neutral", description }: { title: string; count: number; href: string; tone?: "neutral" | "warning" | "danger" | "primary"; description?: string }) {
  const toneClass = { neutral: "border-border", warning: "border-warning/30 bg-warning-bg/35", danger: "border-danger/30 bg-danger-bg/35", primary: "border-primary/25 bg-primary-50/45" }[tone];
  return <Link href={href} className={cn("group flex min-h-20 flex-col justify-between rounded-xl border p-3.5 transition hover:-translate-y-0.5 hover:shadow-card-hover", toneClass)}><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold text-foreground dark:text-slate-100">{title}</p>{description && <p className="mt-0.5 text-[11px] text-muted">{description}</p>}</div><Badge variant={tone === "danger" ? "danger" : tone === "warning" ? "warning" : tone === "primary" ? "primary" : "neutral"}>{count}</Badge></div><span className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-primary">فتح الإجراء <ArrowLeft className="h-3.5 w-3.5 transition group-hover:-translate-x-0.5" /></span></Link>;
}
