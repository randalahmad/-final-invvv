import { DEFAULT_ROLE_PERMISSIONS, ROLE_KEYS, type PermissionKey } from "@/modules/auth/permissions";

/** Explicit, non-production switch for stakeholder interface review. */
export function isUxPreviewMode(): boolean {
  return process.env.UX_PREVIEW_MODE === "true" && process.env.VERCEL_ENV !== "production";
}

export const UX_PREVIEW_PERSONAS = {
  admin: { label: "مدير النظام", name: "مدير النظام", email: "admin@innovation.local", role: ROLE_KEYS.SYSTEM_ADMIN },
  internal: { label: "مسؤول الابتكار", name: "مسؤول الابتكار الداخلي", email: "editor@innovation.local", role: ROLE_KEYS.INTERNAL_EDITOR },
  partner: { label: "شريك خارجي", name: "منسّق الشراكة الخارجية", email: "partner@innovation.local", role: ROLE_KEYS.EXTERNAL_PARTNER },
  viewer: { label: "مطّلع / قيادة", name: "مطّلع قيادي", email: "viewer@innovation.local", role: ROLE_KEYS.VIEWER },
} as const;

export type PreviewPersonaKey = keyof typeof UX_PREVIEW_PERSONAS;

export function previewPersonaFromSearch(value: string | null | undefined): PreviewPersonaKey {
  return value && value in UX_PREVIEW_PERSONAS ? (value as PreviewPersonaKey) : "internal";
}

export function permissionsForPreviewPersona(key: PreviewPersonaKey): PermissionKey[] {
  return DEFAULT_ROLE_PERMISSIONS[UX_PREVIEW_PERSONAS[key].role];
}

/** Preview-only route guard used to keep persona switching out of dead-end screens. */
export function canPreviewPersonaAccessPath(key: PreviewPersonaKey, path: string): boolean {
  if (path === "/" || path === "/dashboard") return true;
  const permissions = new Set(permissionsForPreviewPersona(key));
  if (path.startsWith("/admin/users")) return permissions.has("user.manage");
  if (path === "/audit" || path.startsWith("/audit/")) return permissions.has("audit.view");
  if (path.startsWith("/governance/ideas")) return permissions.has("idea.view");
  if (path === "/governance" || path.startsWith("/governance/committees")) {
    return permissions.has("committee.view") || permissions.has("idea.view");
  }
  if (path.startsWith("/strategy")) return permissions.has("strategy.objective.view");
  if (path.startsWith("/activities")) return permissions.has("activity.view");
  if (path.startsWith("/challenges")) return permissions.has("challenge.view");
  if (path.startsWith("/solutions")) return permissions.has("solution.view");
  if (path.startsWith("/compliance")) return permissions.has("compliance.view");
  if (path.startsWith("/alerts")) return permissions.has("alert.view");
  if (path.startsWith("/reports")) return permissions.has("compliance.view");
  return false;
}
