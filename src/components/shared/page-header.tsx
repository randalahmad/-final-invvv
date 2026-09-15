import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <div className="mb-1.5 h-1 w-8 rounded-full bg-primary/80" />
        <h1 className="text-xl font-bold tracking-tight text-slate-800 sm:text-2xl dark:text-slate-100">{title}</h1>
        {description && <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-muted">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
