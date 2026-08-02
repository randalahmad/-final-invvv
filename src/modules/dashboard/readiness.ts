import type { ComplianceOverviewRow } from "@/modules/compliance/service";

/** Equal-weighted average of real, scored solutions visible to the caller. */
export function estimatedReadiness(rows: ComplianceOverviewRow[]): number | null {
  const scored = rows.flatMap((row) => (row.overallReadiness === null ? [] : [row.overallReadiness]));
  if (scored.length === 0) return null;
  return Math.round(scored.reduce((sum, value) => sum + value, 0) / scored.length);
}
