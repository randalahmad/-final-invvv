import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("ar-SA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(d);
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("ar-SA").format(n);
}

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("");
}

/** Readiness/progress colour thresholds shared across the app. */
export function readinessColor(pct: number): string {
  if (pct >= 80) return "#16B364";
  if (pct >= 55) return "#F5A623";
  return "#EF4444";
}
