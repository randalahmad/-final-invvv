import * as React from "react";

import { cn } from "@/lib/utils";

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  color?: string;
  height?: number;
}

/** Lightweight RTL-safe progress bar. `color` overrides the default fill. */
export function Progress({ value, color, height = 6, className, ...props }: ProgressProps) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700", className)}
      style={{ height }}
      {...props}
    >
      <div
        className="h-full rounded-full transition-[width] duration-300"
        style={{ width: `${clamped}%`, background: color ?? "#4F46E5" }}
      />
    </div>
  );
}
