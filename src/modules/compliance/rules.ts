/**
 * Pure, deterministic evaluation of a single `RequirementFieldRule.rule` string
 * against a record value. No database, no I/O — unit-testable in isolation.
 *
 * The rule vocabulary is intentionally small and DATA-DRIVEN: rules live on
 * `RequirementFieldRule` rows, not in code. Adding a requirement/field never
 * touches this file; only introducing a genuinely new *rule kind* does.
 *
 * Supported rule grammar (compliance-rules.md §1):
 *   "required"      → the value must be present (non-null, non-blank, non-empty)
 *   "minLength:N"   → a string value must have length ≥ N (after trim)
 *   "min:N"         → a numeric value must be ≥ N
 *   "optional"      → always satisfied (optional items never reduce a score)
 *   anything else   → treated as "required" (safe default; never silently passes)
 */

export interface FieldRuleResult {
  satisfied: boolean;
  /** Arabic reason shown in the gap report when unsatisfied. */
  reason: string | null;
}

/** True when a scalar value counts as "present" (not null/undefined/blank). */
export function isPresent(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return !Number.isNaN(value);
  if (Array.isArray(value)) return value.length > 0;
  // Prisma Decimal and other objects stringify to a non-empty value when set.
  if (typeof value === "object") return String(value).trim().length > 0;
  return true;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isNaN(value) ? null : value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isNaN(n) ? null : n;
  }
  // Prisma Decimal → string → number.
  if (value != null && typeof value === "object") {
    const n = Number(String(value));
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

/**
 * Evaluate one field rule. Returns whether it is satisfied plus an Arabic reason
 * when not. `optional` rules always pass (and callers must also exclude optional
 * items from scoring weights — see scoring.ts).
 */
export function evaluateFieldRule(rule: string, value: unknown): FieldRuleResult {
  const trimmed = (rule ?? "").trim();

  if (trimmed === "optional") return { satisfied: true, reason: null };

  if (trimmed.startsWith("minLength:")) {
    const n = Number(trimmed.slice("minLength:".length));
    const len = asString(value).trim().length;
    if (!isPresent(value)) return { satisfied: false, reason: "الحقل غير مُعبّأ" };
    if (Number.isFinite(n) && len < n) return { satisfied: false, reason: `أقل من ${n} حرفًا` };
    return { satisfied: true, reason: null };
  }

  if (trimmed.startsWith("min:")) {
    const n = Number(trimmed.slice("min:".length));
    const num = asNumber(value);
    if (num === null) return { satisfied: false, reason: "قيمة رقمية غير مُعبّأة" };
    if (Number.isFinite(n) && num < n) return { satisfied: false, reason: `أقل من ${n}` };
    return { satisfied: true, reason: null };
  }

  // "required" and any unknown rule → require presence (never silently pass).
  return isPresent(value) ? { satisfied: true, reason: null } : { satisfied: false, reason: "الحقل غير مُعبّأ" };
}
