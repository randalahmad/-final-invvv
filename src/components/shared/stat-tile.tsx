import Link from "next/link";

import { cn } from "@/lib/utils";

export interface StatTileProps {
  label: string;
  value: string;
  sub?: string;
  href?: string;
  hero?: boolean;
  danger?: boolean;
}

export function StatTile({ label, value, sub, href, hero, danger }: StatTileProps) {
  const content = (
    <div
      className={cn(
        "flex h-full flex-col gap-2 rounded-2xl border p-5 transition-shadow",
        hero
          ? "border-transparent bg-gradient-primary text-white"
          : "card-surface hover:shadow-card-hover",
      )}
    >
      <span className={cn("text-xs", hero ? "text-white/80" : "text-muted")}>{label}</span>
      <span
        className={cn(
          "text-2xl font-extrabold",
          hero ? "text-white" : danger ? "text-danger" : "text-slate-800 dark:text-slate-100",
        )}
      >
        {value}
      </span>
      {sub && <span className={cn("text-[11px]", hero ? "text-white/80" : "text-muted")}>{sub}</span>}
    </div>
  );

  return href ? (
    <Link href={href} className="block">
      {content}
    </Link>
  ) : (
    content
  );
}
