import type { RequirementWorkspaceConfig } from "./workspace-config";

export type WorkspaceData = Record<string, Record<string, unknown> | Record<string, unknown>[]>;
export type OperationalStatus = "NOT_STARTED" | "IN_PROGRESS" | "AWAITING_EVIDENCE" | "COMPLETED";

const filled = (value: unknown) => typeof value === "number" || (typeof value === "string" && value.trim().length > 0);

export function missingWorkspaceFields(config: RequirementWorkspaceConfig, data: WorkspaceData): string[] {
  const missing: string[] = [];
  for (const section of config.sections) {
    const value = data[section.key];
    if (section.repeatable) {
      const rows = Array.isArray(value) ? value : [];
      const minimum = section.minItems ?? 1;
      if (rows.length < minimum) missing.push(`${section.title}: يلزم ${minimum} سجل على الأقل`);
      rows.forEach((row, index) => section.fields.filter((field) => field.required !== false && !filled(row[field.key])).forEach((field) => missing.push(`${section.title} — السجل ${index + 1}: ${field.label}`)));
    } else {
      const record = value && !Array.isArray(value) ? value : {};
      section.fields.filter((field) => field.required !== false && !filled(record[field.key])).forEach((field) => missing.push(`${section.title}: ${field.label}`));
    }
  }
  return missing;
}

export function missingEvidence(config: RequirementWorkspaceConfig, counts: Record<string, number>): string[] {
  return config.evidence.flatMap((rule) => (counts[rule.key] ?? 0) < rule.minCount ? [`${rule.title}: يلزم ${rule.minCount} ملف على الأقل`] : []);
}

export function deriveOperationalStatus(config: RequirementWorkspaceConfig, data: WorkspaceData, counts: Record<string, number>): OperationalStatus {
  const hasData = Object.values(data).some((section) => Array.isArray(section) ? section.some((row) => Object.values(row).some(filled)) : Object.values(section).some(filled));
  const hasEvidence = Object.values(counts).some((count) => count > 0);
  if (!hasData && !hasEvidence) return "NOT_STARTED";
  if (missingWorkspaceFields(config, data).length) return "IN_PROGRESS";
  if (missingEvidence(config, counts).length) return "AWAITING_EVIDENCE";
  return "COMPLETED";
}
